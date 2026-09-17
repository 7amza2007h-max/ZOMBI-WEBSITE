const DISCORD_API = 'https://discord.com/api/v10';
const DISCORD_TOKEN_URL = 'https://discord.com/api/oauth2/token';

function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      'x-zombi-proxy-version': '2026-09-18-ratelimit-fix',
      ...extraHeaders
    }
  });
}

async function sha256Hex(value) {
  const bytes = new TextEncoder().encode(String(value || ''));
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join('');
}

async function authCandidates(env) {
  const values = [];
  if (env.PROXY_SECRET) values.push(String(env.PROXY_SECRET));
  if (env.DISCORD_CLIENT_SECRET) values.push(await sha256Hex(`ZOMBI_PROXY:${env.DISCORD_CLIENT_SECRET}`));
  return [...new Set(values.filter(Boolean))];
}

async function authorized(request, env) {
  const provided = String(request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim();
  if (!provided) return false;
  const candidates = await authCandidates(env);
  return candidates.some(value => value === provided);
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

function retryMs(response, data) {
  const raw = data?.retry_after ?? response.headers.get('retry-after') ?? 0;
  const seconds = Number(raw || 0);
  return Number.isFinite(seconds) && seconds > 0 ? Math.ceil(seconds * 1000) : 0;
}

async function discordRequest(url, options = {}) {
  for (let attempt = 0; attempt < 3; attempt++) {
    const response = await fetch(url, options);
    if (response.status !== 429) return response;
    const parsed = await readDiscordResponse(response.clone());
    const wait = retryMs(response, parsed.data);
    if (!wait || wait > 5000 || attempt === 2) return response;
    await new Promise(resolve => setTimeout(resolve, wait + 150));
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === 'GET' && url.pathname === '/health') {
      return json({
        ok: true,
        service: 'zombi-discord-proxy',
        version: '2026-09-18-ratelimit-fix',
        oauthConfigured: Boolean(env.DISCORD_CLIENT_ID && env.DISCORD_CLIENT_SECRET),
        botConfigured: Boolean(env.BOT_TOKEN),
        legacySecretConfigured: Boolean(env.PROXY_SECRET),
        derivedAuthAvailable: Boolean(env.DISCORD_CLIENT_SECRET)
      });
    }

    if (!(await authorized(request, env))) {
      return json({ ok: false, error: 'Unauthorized' }, 401);
    }

    // OAuth code exchange + user + guild list.
    if (request.method === 'POST' && (url.pathname === '/oauth/exchange' || url.pathname === '/')) {
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
        return json({
          ok: false,
          stage: 'token',
          status: tokenResponse.status,
          error: tokenParsed.data?.error_description || tokenParsed.data?.message || tokenParsed.data?.error || 'Discord OAuth token exchange failed',
          retry_after: retryAfter
        }, tokenResponse.status, retryAfter ? { 'retry-after': String(retryAfter) } : {});
      }

      const accessToken = tokenParsed.data?.access_token;
      if (!accessToken) {
        return json({ ok: false, stage: 'token', error: 'Discord did not return an access token' }, 502);
      }

      const authHeaders = { authorization: `Bearer ${accessToken}`, accept: 'application/json' };

      // Sequential instead of parallel to reduce bursts on Discord REST.
      const userResponse = await discordRequest(`${DISCORD_API}/users/@me`, { headers: authHeaders });
      const userParsed = await readDiscordResponse(userResponse);
      if (!userResponse.ok) {
        const retryAfter = userResponse.headers.get('retry-after') || userParsed.data?.retry_after || null;
        return json({ ok: false, stage: 'user', status: userResponse.status, error: userParsed.data?.message || 'Discord user profile request failed', retry_after: retryAfter }, userResponse.status, retryAfter ? { 'retry-after': String(retryAfter) } : {});
      }

      await new Promise(resolve => setTimeout(resolve, 75));
      const guildsResponse = await discordRequest(`${DISCORD_API}/users/@me/guilds`, { headers: authHeaders });
      const guildsParsed = await readDiscordResponse(guildsResponse);
      if (!guildsResponse.ok) {
        const retryAfter = guildsResponse.headers.get('retry-after') || guildsParsed.data?.retry_after || null;
        return json({ ok: false, stage: 'guilds', status: guildsResponse.status, error: guildsParsed.data?.message || 'Discord guild list request failed', retry_after: retryAfter }, guildsResponse.status, retryAfter ? { 'retry-after': String(retryAfter) } : {});
      }

      return json({ ok: true, user: userParsed.data, guilds: Array.isArray(guildsParsed.data) ? guildsParsed.data : [] });
    }

    // Proxy Discord Bot REST calls so Render can avoid shared-IP rate limiting.
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

      const headers = { authorization: `Bot ${String(env.BOT_TOKEN)}`, accept: 'application/json' };
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

      if (response.status === 204) return json({ ok: true, status: 204, data: null });

      const parsed = await readDiscordResponse(response);
      if (!response.ok) {
        const retryAfter = response.headers.get('retry-after') || parsed.data?.retry_after || null;
        return json({ ok: false, status: response.status, error: parsed.data?.message || `Discord API ${response.status}`, data: parsed.data, retry_after: retryAfter }, response.status, retryAfter ? { 'retry-after': String(retryAfter) } : {});
      }

      return json({ ok: true, status: response.status, data: parsed.data });
    }

    return json({ ok: false, error: 'Not found' }, 404);
  }
};
