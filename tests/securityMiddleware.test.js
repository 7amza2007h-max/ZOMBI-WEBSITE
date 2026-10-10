'use strict';
const assert = require('node:assert/strict');
const { safeReturnTo, rateLimit, securityHeaders } = require('../dashboard/securityMiddleware');

assert.equal(safeReturnTo('/dashboard'), '/dashboard');
assert.equal(safeReturnTo('/dashboard?tab=roles'), '/dashboard?tab=roles');
assert.equal(safeReturnTo('https://attacker.example'), '/dashboard');
assert.equal(safeReturnTo('//attacker.example'), '/dashboard');
assert.equal(safeReturnTo('/\\attacker.example'), '/dashboard');

function response() {
  return { headers: {}, statusCode: 200, setHeader(k, v) { this.headers[k] = v; }, status(n) { this.statusCode = n; return this; }, json(body) { this.body = body; return this; } };
}
let advanced = false;
const req = { ip: 'test-client', path: '/auth/discord', method: 'GET', socket: {} };
const limiter = rateLimit({ windowMs: 60_000, max: 2, keyPrefix: 'test' });
for (let i = 0; i < 2; i++) { const res = response(); limiter(req, res, () => { advanced = true; }); assert.equal(res.statusCode, 200); }
const blocked = response(); limiter(req, blocked, () => { throw new Error('limit should block'); });
assert.equal(blocked.statusCode, 429);
assert.equal(blocked.body.error, 'RATE_LIMITED');
const headerRes = response(); securityHeaders({ secure: true }, headerRes, () => {});
assert.equal(headerRes.headers['X-Content-Type-Options'], 'nosniff');
assert.equal(headerRes.headers['X-Frame-Options'], 'DENY');
assert.ok(headerRes.headers['Strict-Transport-Security']);
console.log('securityMiddleware tests: PASS');
