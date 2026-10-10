"use strict";

// Small dependency-free security middleware for the existing Express 5 app.
// Rate-limit state is process-local; use a shared store if Render runs multiple instances.
const buckets = new Map();
function securityHeaders(req, res, next) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin-allow-popups');
  if (req.secure) res.setHeader('Strict-Transport-Security', 'max-age=15552000; includeSubDomains');
  next();
}
function rateLimit({ windowMs = 60_000, max = 100, keyPrefix = 'general' } = {}) {
  return (req, res, next) => {
    const now = Date.now();
    // Opportunistic cleanup; no timer keeps the process alive.
    if (buckets.size > 5000) for (const [key, item] of buckets) if (item.resetAt <= now) buckets.delete(key);
    const key = `${keyPrefix}:${req.ip || req.socket?.remoteAddress || 'unknown'}`;
    let item = buckets.get(key);
    if (!item || item.resetAt <= now) { item = { count: 0, resetAt: now + windowMs }; buckets.set(key, item); }
    item.count += 1;
    res.setHeader('RateLimit-Limit', String(max));
    res.setHeader('RateLimit-Remaining', String(Math.max(0, max - item.count)));
    res.setHeader('RateLimit-Reset', String(Math.ceil(item.resetAt / 1000)));
    if (item.count > max) {
      res.setHeader('Retry-After', String(Math.max(1, Math.ceil((item.resetAt - now) / 1000))));
      console.warn(JSON.stringify({ event: 'rate_limit', path: String(req.path || '').slice(0, 120), method: req.method, outcome: 'blocked' }));
      return res.status(429).json({ ok: false, error: 'RATE_LIMITED' });
    }
    next();
  };
}
function safeReturnTo(value) {
  const s = String(value || '');
  return s.startsWith('/') && !s.startsWith('//') && !s.includes('\\') && !/[\r\n]/.test(s) ? s : '/dashboard';
}
function securityEvent(event, req, outcome = 'blocked') {
  // Never log cookies, auth headers, request bodies, tokens, or query strings.
  console.warn(JSON.stringify({ event, method: String(req?.method || '').slice(0, 12), path: String(req?.path || '').slice(0, 120), outcome, at: new Date().toISOString() }));
}
module.exports = { securityHeaders, rateLimit, safeReturnTo, securityEvent };
