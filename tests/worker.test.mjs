import test from 'node:test';
import assert from 'node:assert/strict';
import app from '../worker.js';
const request = (path, init) => new Request('https://iconly.test'+path, init);
const env = { OPENAI_API_KEY: 'mock-not-real', STUDIO_ACCESS_CODE: 'a-secure-owner-code-that-is-not-public' };
test('Homepage serves Hebrew with a nonce', async () => {
  const res = await app.fetch(request('/'), {});
  assert.equal(res.status, 200);
  assert.match(res.headers.get('Content-Security-Policy'), /nonce-/);
  assert.match(await res.text(), /Iconly|iconl/);
});
test('Health reveals setup flags, not secrets', async () => {
  const res = await app.fetch(request('/api/health'), env);
  const b = await res.json();
  assert.equal(b.ok, true);
  assert.equal(b.aiConfigured, true);
  assert.equal(b.privateStudioConfigured, true);
  assert.ok(!JSON.stringify(b).includes(env.OPENAI_API_KEY));
});
test('Paid API is disabled when no secrets exist', async () => {
  assert.equal((await app.fetch(request('/api/icon', {method:'POST'}), {})).status, 503);
});
test('Paid API rejects missing owner code', async () => {
  assert.equal((await app.fetch(request('/api/icon', {method:'POST',headers:{'content-type':'application/json'},body:'{}'}), env)).status, 401);
});
test('Unknown origins cannot call paid API', async () => {
  const res = await app.fetch(request('/api/icon', {method:'POST',headers:{origin:'https://evil.example','content-type':'application/json','x-studio-access':env.STUDIO_ACCESS_CODE},body:'{}'}), env);
  assert.equal(res.status, 403);
});
test('Bad uploads are rejected before model calls', async () => {
  const res = await app.fetch(request('/api/analyze', {method:'POST',headers:{'content-type':'application/json','x-studio-access':env.STUDIO_ACCESS_CODE},body:JSON.stringify({mode:'logo',colors:['#123456'],logoData:'data:text/html;base64,abcd'})}), env);
  assert.equal(res.status, 400);
});
test('Internal URL sources are blocked', async () => {
  const res = await app.fetch(request('/api/analyze', {method:'POST',headers:{'content-type':'application/json','x-studio-access':env.STUDIO_ACCESS_CODE},body:JSON.stringify({mode:'url',colors:['#123456'],siteUrl:'https://localhost/admin'})}), env);
  assert.equal(res.status, 400);
});
test('CORS preflight permits only our GitHub Pages origin', async () => {
  const ok = await app.fetch(request('/api/icon',{method:'OPTIONS',headers:{origin:'https://huxhkuh.github.io'}}),env);
  assert.equal(ok.status,204);
  assert.equal(ok.headers.get('Access-Control-Allow-Origin'),'https://huxhkuh.github.io');
  const bad = await app.fetch(request('/api/icon',{method:'OPTIONS',headers:{origin:'https://evil.example'}}),env);
  assert.equal(bad.status,403);
});
test('Owner code remains required on GitHub Pages origin', async () => {
  const res = await app.fetch(request('/api/icon',{method:'POST',headers:{origin:'https://huxhkuh.github.io','content-type':'application/json'},body:'{}'}),env);
  assert.equal(res.status,401);
  assert.equal(res.headers.get('Access-Control-Allow-Origin'),'https://huxhkuh.github.io');
});
