import test from 'node:test';
import assert from 'node:assert/strict';
import app from '../worker.js';
const request = (path, init={}) => new Request('https://iconly.test'+path, init);
const db={prepare:()=>({bind:()=>({first:async()=>({used:1})})})};
const env={OPENAI_API_KEY:'mock-not-real',STUDIO_ACCESS_CODE:'test-only-server-side-salt',QUOTAS:db};
test('Homepage serves Hebrew with CSP nonce',async()=>{
  const r=await app.fetch(request('/'),env);
  assert.equal(r.status,200);
  assert.match(r.headers.get('Content-Security-Policy'),/nonce-/);
  const body=await r.text();assert.match(body,/Iconly|iconl/);
});
test('Health reports public generation without secrets',async()=>{
  const r=await app.fetch(request('/api/health'),env);
  const b=await r.json();
  assert.equal(b.ok,true);assert.equal(b.aiConfigured,true);
  assert.equal(b.privateStudioConfigured,false);assert.equal(b.publicGeneration,true);
  assert.ok(!JSON.stringify(b).includes(env.OPENAI_API_KEY));
});
test('Paid API disabled if missing secrets and quota storage',async()=>{
  const r=await app.fetch(request('/api/icon',{method:'POST'}),{});
  assert.equal(r.status,503);
});
test('Public API does not require password',async()=>{
  const r=await app.fetch(request('/api/icon',{method:'POST',headers:{'content-type':'application/json'},body:'{}'}),env);
  assert.equal(r.status,400);
});
test('Unknown browser origins are rejected',async()=>{
  const r=await app.fetch(request('/api/icon',{method:'POST',headers:{origin:'https://evil.example','content-type':'application/json'},body:'{}'}),env);
  assert.equal(r.status,403);
});
test('Bad uploads rejected after quota check, before model',async()=>{
  const r=await app.fetch(request('/api/analyze',{method:'POST',headers:{'content-type':'application/json','CF-Connecting-IP':'203.0.113.45'},body:JSON.stringify({mode:'logo',colors:['#123456'],logoData:'data:text/html;base64,abcd'})}),env);
  assert.equal(r.status,400);
});
test('Internal website URLs blocked',async()=>{
  const r=await app.fetch(request('/api/analyze',{method:'POST',headers:{'content-type':'application/json','CF-Connecting-IP':'203.0.113.45'},body:JSON.stringify({mode:'url',colors:['#123456'],siteUrl:'https://localhost/admin'})}),env);
  assert.equal(r.status,400);
});
test('CORS permits GitHub Pages origin',async()=>{
  const r=await app.fetch(request('/api/icon',{method:'OPTIONS',headers:{origin:'https://huxhkuh.github.io'}}),env);
  assert.equal(r.status,204);
  assert.equal(r.headers.get('Access-Control-Allow-Origin'),'https://huxhkuh.github.io');
});
test('Unrecognized preflight origin denied',async()=>{
  const r=await app.fetch(request('/api/icon',{method:'OPTIONS',headers:{origin:'https://evil.example'}}),env);
  assert.equal(r.status,403);
});
