const DISCORD_API = 'https://discord.com/api/v10';
const DISCORD_TOKEN_URL = 'https://discord.com/api/oauth2/token';

function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      ...extraHeaders
    }
  });
}

async function readDiscordResponse(response) {
  const raw = await response.text();
  let data = null;
  try {
    data = raw ? JSON.parse(raw) : {};
  } catch {
    data = { message: raw.slice(0, 300) || `HTTP ${response.status}` };
  }
  return { data, raw };
}

function authorized(request, env) {
  const provided = String(request.headers.get('authorization') || '');
  const expected = `Bearer ${String(env.PROXY_SECRET || '')}`;
  return Boolean(env.PROXY_SECRET && provided === expected);
}

async function discordRequest(url, options = {}) {
  let response = await fetch(url, options);
  if (response.status !== 429) return response;

  const parsed = await readDiscordResponse(response.clone());
  const retryRaw = response.headers.get('retry-after') || parsed.data?.retry_after || 0;
  const retrySeconds = Number(retryRaw || 0);
  const retryMs = retrySeconds > 0 ? Math.ceil(retrySeconds * 1000) : 0;

  // One short retry only. Long limits are returned to the caller.
  if (retryMs > 0 && retryMs <= 2500) {
    await new Promise(resolve => setTimeout(resolve, retryMs + 100));
    response = await fetch(url, options);
  }
  return response;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === 'GET' && url.pathname === '/health') {
      return json({
        ok: true,
        service: 'zombi-discord-proxy',
        oauthConfigured: Boolean(env.DISCORD_CLIENT_ID && env.DISCORD_CLIENT_SECRET),
        botConfigured: Boolean(env.BOT_TOKEN)
      });
    }

    if (!authorized(request, env)) {
      return json({ ok: false, error: 'Unauthorized' }, 401);
    }

    // OAuth code exchange + user + guild list.
    if (request.method === 'POST' && url.pathname === '/oauth/exchange') {
      if (!env.DISCORD_CLIENT_ID || !env.DISCORD_CLIENT_SECRET) {
        return json({ ok: false, error: 'Worker OAuth secrets are not configured' }, 500);
      }

      let body;
      try {
        body = await request.json();
      } catch {
        return json({ ok: false, error: 'Invalid JSON body' }, 400);
      }

      const code = String(body?.code || '').trim();
      const redirectUri = String(body?.redirect_uri || '').trim();
      if (!code || !redirectUri) {
        return json({ ok: false, error: 'Missing code or redirect_uri' }, 400);
      }

      if (env.DISCORD_REDIRECT_URI && redirectUri !== String(env.DISCORD_REDIRECT_URI)) {
        return json({ ok: false, error: 'redirect_uri mismatch' }, 400);
      }

      const form = new URLSearchParams({
        client_id: String(env.DISCORD_CLIENT_ID),
        client_secret: String(env.DISCORD_CLIENT_SECRET),
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri
      });

      let tokenResponse;
      try {
        tokenResponse = await discordRequest(DISCORD_TOKEN_URL, {
          method: 'POST',
          headers: {
            'content-type': 'application/x-www-form-urlencoded',
            'accept': 'application/json'
          },
          body: form.toString()
        });
      } catch (error) {
        return json({ ok: false, error: 'Discord token request failed', detail: String(error?.message || error) }, 502);
      }

      const tokenParsed = await readDiscordResponse(tokenResponse);
      if (!tokenResponse.ok) {
        const retryAfter = tokenResponse.headers.get('retry-after') || tokenParsed.data?.retry_after || null;
        const headers = retryAfter ? { 'retry-after': String(retryAfter) } : {};
        return json({
          ok: false,
          stage: 'token',
          status: tokenResponse.status,
          error: tokenParsed.data?.error_description || tokenParsed.data?.message || tokenParsed.data?.error || 'Discord OAuth token exchange failed',
          retry_after: retryAfter
        }, tokenResponse.status, headers);
      }

      const accessToken = tokenParsed.data?.access_token;
      if (!accessToken) {
        return json({ ok: false, stage: 'token', error: 'Discord did not return an access token' }, 502);
      }

      const authHeaders = {
        authorization: `Bearer ${accessToken}`,
        accept: 'application/json'
      };

      const [userResponse, guildsResponse] = await Promise.all([
        discordRequest(`${DISCORD_API}/users/@me`, { headers: authHeaders }),
        discordRequest(`${DISCORD_API}/users/@me/guilds`, { headers: authHeaders })
      ]);

      const userParsed = await readDiscordResponse(userResponse);
      const guildsParsed = await readDiscordResponse(guildsResponse);

      if (!userResponse.ok) {
        return json({
          ok: false,
          stage: 'user',
          status: userResponse.status,
          error: userParsed.data?.message || 'Discord user profile request failed',
          retry_after: userResponse.headers.get('retry-after') || userParsed.data?.retry_after || null
        }, userResponse.status);
      }

      if (!guildsResponse.ok) {
        return json({
          ok: false,
          stage: 'guilds',
          status: guildsResponse.status,
          error: guildsParsed.data?.message || 'Discord guild list request failed',
          retry_after: guildsResponse.headers.get('retry-after') || guildsParsed.data?.retry_after || null
        }, guildsResponse.status);
      }

      return json({
        ok: true,
        user: userParsed.data,
        guilds: Array.isArray(guildsParsed.data) ? guildsParsed.data : []
      });
    }

    // Proxy Discord Bot REST calls so Render never calls Discord directly.
    if (request.method === 'POST' && url.pathname === '/bot/request') {
      if (!env.BOT_TOKEN) {
        return json({ ok: false, error: 'BOT_TOKEN is not configured on the Worker' }, 500);
      }

      let body;
      try {
        body = await request.json();
      } catch {
        return json({ ok: false, error: 'Invalid JSON body' }, 400);
      }

      const route = String(body?.route || '').trim();
      const method = String(body?.method || 'GET').toUpperCase();
      const allowedMethods = new Set(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']);
      if (!route.startsWith('/') || route.startsWith('//') || route.includes('://')) {
        return json({ ok: false, error: 'Invalid Discord route' }, 400);
      }
      if (!allowedMethods.has(method)) {
        return json({ ok: false, error: 'Invalid method' }, 400);
      }

      const headers = {
        authorization: `Bot ${String(env.BOT_TOKEN)}`,
        accept: 'application/json'
      };
      const fetchOptions = { method, headers };
      if (body?.body !== undefined && body?.body !== null && method !== 'GET') {
        headers['content-type'] = 'application/json';
        fetchOptions.body = typeof body.body === 'string' ? body.body : JSON.stringify(body.body);
      }

      let response;
      try {
        response = await discordRequest(`${DISCORD_API}${route}`, fetchOptions);
      } catch (error) {
        return json({ ok: false, error: 'Discord bot request failed', detail: String(error?.message || error) }, 502);
      }

      if (response.status === 204) {
        return json({ ok: true, status: 204, data: null });
      }

      const parsed = await readDiscordResponse(response);
      if (!response.ok) {
        const retryAfter = response.headers.get('retry-after') || parsed.data?.retry_after || null;
        const headersOut = retryAfter ? { 'retry-after': String(retryAfter) } : {};
        return json({
          ok: false,
          status: response.status,
          error: parsed.data?.message || `Discord API ${response.status}`,
          data: parsed.data,
          retry_after: retryAfter
        }, response.status, headersOut);
      }

      return json({ ok: true, status: response.status, data: parsed.data });
    }

    return json({ ok: false, error: 'Not found' }, 404);
  }
};
