import test from 'node:test';import assert from 'node:assert/strict';import app from '../worker.js';
const req=(path,init={})=>new Request('https://iconly.example'+path,init);
const env={OPENAI_API_KEY:'fake',STUDIO_ACCESS_CODE:'salt',QUOTAS:{prepare:()=>({bind:()=>({first:async()=>({used:1})})})}};
test('public page lacks code field',async()=>{const r=await app.fetch(req('/'),env);const t=await r.text();assert.equal(r.status,200);assert.ok(!t.includes('id="access"'));assert.ok(t.includes('יצירה פתוחה לכולם'))});
test('health reports public generation',async()=>{const r=await app.fetch(req('/api/health'),env);const j=await r.json();assert.equal(j.publicGeneration,true);assert.equal(j.dailyIconsPerVisitor,4)});
test('without quota storage requests fail closed',async()=>{const r=await app.fetch(req('/api/icon',{method:'POST',headers:{'content-type':'application/json'},body:'{}'}),{OPENAI_API_KEY:'fake'});assert.equal(r.status,503)});
test('preflight allows public GitHub pages',async()=>{const r=await app.fetch(req('/api/icon',{method:'OPTIONS',headers:{origin:'https://huxhkuh.github.io'}}),env);assert.equal(r.status,204);assert.ok(!r.headers.get('Access-Control-Allow-Headers').includes('x-studio-access'))});
test('unknown origin rejected',async()=>{const r=await app.fetch(req('/api/icon',{method:'OPTIONS',headers:{origin:'https://unknown.site'}}),env);assert.equal(r.status,403)});
test('missing user IP returns quota error',async()=>{const r=await app.fetch(req('/api/icon',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({name:'Star',brand:{colors:['#123456','#654321']}})}),env);assert.equal(r.status,429)});
