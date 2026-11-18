import test from 'node:test';
import assert from 'node:assert/strict';
import app from '../worker.js';
const request = (path, init={}) => new Request('https://iconly.test'+path, init);
const env={OPENAI_API_KEY:'mock-not-real'};
test('Homepage serves Hebrew with CSP nonce',async()=>{
  const r=await app.fetch(request('/'),env);
  assert.equal(r.status,200);
  assert.match(r.headers.get('Content-Security-Policy'),/nonce-/);
  const body=await r.text();assert.match(body,/Iconly|iconl/);
});
test('Health reports public generation without disclosing secrets',async()=>{
  const r=await app.fetch(request('/api/health'),env);
  const b=await r.json();
  assert.equal(b.ok,true);assert.equal(b.aiConfigured,true);
  assert.equal(b.privateStudioConfigured,false);assert.equal(b.publicGeneration,true);
  assert.ok(!JSON.stringify(b).includes(env.OPENAI_API_KEY));
});
test('Paid API disabled if missing the API key',async()=>{
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
test('Bad uploads rejected before model',async()=>{
  const r=await app.fetch(request('/api/analyze',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({mode:'logo',colors:['#123456'],logoData:'data:text/html;base64,abcd'})}),env);
  assert.equal(r.status,400);
});
test('Internal website URLs blocked',async()=>{
  const r=await app.fetch(request('/api/analyze',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({mode:'url',colors:['#123456'],siteUrl:'https://localhost/admin'})}),env);
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
test('Icon requests continue past four generations without quota bindings',async(t)=>{
  const svg='<svg xmlns="http://www.w3.org/2000/svg"><path d="M2 2h20v20H2z"/></svg>';
  const upstream=t.mock.method(globalThis,'fetch',async(url,init)=>{
    assert.equal(url,'https://api.openai.com/v1/images/generations');
    assert.match(JSON.parse(init.body).prompt,/mobile app toolbar/);
    return Response.json({data:[{b64_json:btoa(svg)}]});
  });
  for(let i=0;i<5;i++){
    const r=await app.fetch(request('/api/icon',{
      method:'POST',
      headers:{'content-type':'application/json'},
      body:JSON.stringify({name:'Star',brand:{colors:['#123456','#654321']}})
    }),env);
    assert.equal(r.status,200);
    assert.equal((await r.json()).svg,svg);
  }
  assert.equal(upstream.mock.callCount(),5);
});
