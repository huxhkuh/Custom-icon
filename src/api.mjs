// Iconly — brand-aware SVG icon studio. Cloudflare Workers module.
// Secrets (NEVER commit actual values): OPENAI_API_KEY, STUDIO_ACCESS_CODE
const HEADER = { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer', 'Cross-Origin-Resource-Policy': 'same-origin' };
const MAX_BODY = 2_900_000;
const GITHUB_PAGES_ORIGIN = 'https://huxhkuh.github.io';
const names = { rounded: 'friendly rounded filled vector shapes and gentle accent areas', outline: 'clean open line icons with rounded line caps, consistent 3px stroke', duotone: 'minimal two-tone geometric icons with a single accent color' };
const reply = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { ...HEADER, 'Content-Type': 'application/json;charset=utf-8' } });
function validColors(raw) { return Array.isArray(raw) ? raw.filter(x => /^#[0-9a-f]{6}$/i.test(x)).slice(0, 3) : [] }
const DAILY_LIMITS = {analyze:{personal:8,global:80},icon:{personal:4,global:20}};
async function consumeQuota(request, env, kind) {
  if (!env.QUOTAS || !env.STUDIO_ACCESS_CODE) throw new Error('מנגנון ההגנה על השימוש אינו זמין');
  const ip = request.headers.get('CF-Connecting-IP');
  if (!ip || ip.length > 80) return false;
  const day = new Date().toISOString().slice(0,10);
  const input = new TextEncoder().encode(env.STUDIO_ACCESS_CODE + ':' + day + ':' + ip);
  const digest = await crypto.subtle.digest('SHA-256',input);
  const hash=Array.from(new Uint8Array(digest),x=>x.toString(16).padStart(2,'0')).join('');
  const plan=DAILY_LIMITS[kind];
  const sql="INSERT INTO quota_counters (id, used, day) VALUES (?,1,?) ON CONFLICT(id) DO UPDATE SET used=used+1 WHERE used < ? RETURNING used";
  const user=await env.QUOTAS.prepare(sql).bind(day+':'+kind+':ip:'+hash,day,plan.personal).first();
  if (!user) return false;
  const total=await env.QUOTAS.prepare(sql).bind(day+':'+kind+':global',day,plan.global).first();
  return !!total;
}
function safeSiteUrl(raw) {
  const u = new URL(raw); const h = u.hostname.toLowerCase().replace(/\.$/, '');
  if (u.protocol !== 'https:' || u.username || u.password || u.port && u.port !== '443' || h.length > 253 || !h.includes('.') || /(^|\.)(localhost|local|internal|test|invalid)$/.test(h) || /(^|\.)(localhost|local|internal|test|invalid)\./.test(h) || /^\d+(\.\d+){3}$/.test(h) || /^\[|:$/.test(h) || h.includes(':') || !/^[a-z0-9.-]+$/.test(h)) throw new Error('יש להזין כתובת HTTPS של אתר ציבורי.');
  return u;
}
function extractJSON(text) { const s = text.indexOf('{'), e = text.lastIndexOf('}'); if (s === -1 || e <= s) throw new Error('ניתוח המותג לא החזיר JSON'); return JSON.parse(text.slice(s, e + 1)) }
async function openai(url, body, env) {
  const c = new AbortController(); const timeout = setTimeout(() => c.abort(), 115000);
  try {
    const r = await fetch(url, { method: 'POST', headers: { 'Authorization': 'Bearer ' + env.OPENAI_API_KEY, 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: c.signal });
    const text = await r.text(); let json; try { json = JSON.parse(text) } catch { throw new Error('שירות ה־AI החזיר תשובה לא צפויה') }
    if (!r.ok) throw new Error('שירות ה־AI החזיר שגיאה (' + r.status + '): ' + (json.error?.message || 'כדאי לנסות שוב').slice(0, 140));
    return json;
  } finally { clearTimeout(timeout) }
}
function outputText(j) { return (j.output || []).flatMap(x => x.content || []).filter(x => x.type === 'output_text').map(x => x.text).join('\n') || j.output_text || ''; }
async function analyze(body, env) {
  const colors = validColors(body.colors); if (colors.length < 1) return reply({ error: 'נדרשים צבעים תקינים' }, 400);
  const mode = body.mode === 'url' ? 'url' : 'logo';
  let prompt = 'Analyze this brand identity for a coherent downloadable SVG icon set. Return ONLY JSON with name, description (under 120 chars), geometry, stroke, colors (array of exactly 3 6-digit hex strings). Never copy the logo itself into icons. Keep the result suitable for the user brand. Preferred palette: ' + colors.join(', ') + '. Style: ' + (names[body.style] || names.rounded) + '. ';
  let content = [{ type: 'input_text', text: prompt }], ref;
  if (mode === 'logo') {
    const image = String(body.logoData || '');
    if (!/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(image) || image.length > 2_800_000) return reply({ error: 'קובץ הלוגו לא תקין או גדול מדי' }, 400);
    ref = String(body.logoName || 'logo').replace(/[<>\\/]/g, '').slice(0, 60);
    content.push({ type: 'input_image', image_url: image });
  } else {
    let u; try { u = safeSiteUrl(String(body.siteUrl || '')) } catch (e) { return reply({ error: e.message }, 400) }
    ref = u.origin;
    let html = '';
    try {
      const c = new AbortController(), t = setTimeout(() => c.abort(), 9000);
      try {
        const resp = await fetch(u.toString(), { redirect: 'manual', signal: c.signal, headers: { Accept: 'text/html' } });
        if (!resp.ok || !/text\/html/i.test(resp.headers.get('content-type') || '')) throw new Error('האתר לא החזיר דף HTML ציבורי');
        const reader = resp.body.getReader(); let bytes = 0; const chunks = [];
        while (bytes < 170000) { const { done, value } = await reader.read(); if (done) break; bytes += value.length; chunks.push(value) } await reader.cancel();
        html = new TextDecoder().decode(new Uint8Array(chunks.flatMap(c => [...c])).slice(0, 120000));
      } finally { clearTimeout(t) }
    } catch { return reply({ error: 'לא הצלחנו לקרוא את האתר. נסה להעלות לוגו במקום.' }, 422) }
    const title = /<title[^>]*>([^<]{1,100})/i.exec(html)?.[1] || u.hostname;
    const theme = /<meta[^>]+name=["']theme-color["'][^>]+content=["']([^"']+)/i.exec(html)?.[1] || '';
    const found = [...html.matchAll(/#[0-9a-fA-F]{6}\b/g)].slice(0, 100).map(x => x[0]);
    content[0].text += '\nWebsite: ' + u.hostname + '\nTitle: ' + title.replace(/[<>]/g, '') + '\nTheme: ' + theme.slice(0, 30) + '\nSample CSS colors: ' + found.slice(0, 40).join(', ') + '\nFirst HTML snippet: ' + html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '').slice(0, 4500);
  }
  const result = await openai('https://api.openai.com/v1/responses', { model: 'gpt-5-mini', max_output_tokens: 400, input: [{ role: 'user', content }] }, env);
  let b; try { b = extractJSON(outputText(result)) } catch { b = {} }
  const proposed = validColors(b.colors); const normalized = { name: String(b.name || ref).slice(0, 100), reference: ref, description: String(b.description || 'Contemporary cohesive identity').slice(0, 160), geometry: String(b.geometry || 'rounded geometric').slice(0, 140), stroke: String(b.stroke || 'uniform').slice(0, 80), colors: proposed.length === 3 ? proposed : colors, source: mode };
  return reply({ brand: normalized });
}
function safeSVG(svg) {
  if (typeof svg !== 'string' || svg.length > 420000 || !/^\s*(<\?xml[^>]*>\s*)?<svg\s[\s\S]*<\/svg>\s*$/i.test(svg)) return false;
  if (/<\s*(script|foreignObject|iframe|object|embed|image|use|a|style|animate|set|audio|video|filter)\b|<!\s*(DOCTYPE|ENTITY)|\bon[a-z]+\s*=|\b(?:href|xlink:href)\s*=|@import|javascript:|data:|https?:\/\//i.test(svg.replace(/xmlns=(['"])http:\/\/www\.w3\.org\/2000\/svg\1/gi,''))) return false;
  // A local url(#id) gradient reference is safe; all other CSS url() references are rejected.
  const withoutLocal = svg.replace(/url\(\s*['"]?#[A-Za-z][\w-]*['"]?\s*\)/gi, '');
  if (/url\s*\(/i.test(withoutLocal)) return false;
  return true;
}
async function icon(body, env) {
  const name = String(body.name || '').trim().slice(0, 45), style = names[body.style] ? body.style : 'rounded';
  if (!name || /[<>\r\n]/.test(name)) return reply({ error: 'שם אייקון לא תקין' }, 400);
  const b = body.brand || {}, colors = validColors(b.colors);
  if (colors.length < 2) return reply({ error: 'חסרה פלטת צבעים' }, 400);
  const prompt = `Design ONE independent original professional SVG icon depicting "${name}" for the brand "${String(b.name || '').slice(0, 60)}". Brand direction: ${String(b.description || '').slice(0, 150)}. Geometric language: ${String(b.geometry || '').slice(0, 120)}. Style: ${names[style]}. Color palette: ${colors.join(', ')} ONLY. Maintain consistent silhouette, volume, proportions, optical balance, 12% padding and rounded edges. Icon visually readable at 32px. Centered isolated icon, transparent background, no text, no letters, no logo, no watermark, no photography, no scene, no shadow outside the shape. Clean editable native SVG vector paths, not an embedded raster image.`;
  const j = await openai('https://api.openai.com/v1/images/generations', { model: 'gpt-image-2.6-flare', prompt, output_format: 'svg', svg: { model: 'gpt-5-mini', reasoning: { effort: 'low' } }, n: 1, size: '1024x1024', quality: 'low', complexity: 'low' }, env);
  const encoded = j.data?.[0]?.b64_json;
  if (!encoded || encoded.length > 1000000) throw new Error('לא התקבל SVG');
  const bytes = Uint8Array.from(atob(encoded), ch => ch.charCodeAt(0));
  const svg = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  if (!safeSVG(svg)) throw new Error('תוצאת SVG לא עברה בדיקת בטיחות. נסה שוב.');
  return reply({ svg, prompt });
}
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === 'GET' && (url.pathname === '/' || url.pathname === '/index.html')) {
      const nonce = crypto.randomUUID().replaceAll('-', '');
      const headers = { ...HEADER, 'Content-Type': 'text/html;charset=utf-8', 'Content-Security-Policy': `default-src 'none'; script-src 'nonce-${nonce}'; style-src 'nonce-${nonce}'; img-src data: blob:; connect-src 'self'; object-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'`, 'X-Frame-Options': 'DENY' };
      return new Response(SITE.replaceAll('__NONCE__', nonce), { headers });
    }
    if (request.method === 'OPTIONS' && (url.pathname === '/api/analyze' || url.pathname === '/api/icon')) {
      if (request.headers.get('origin') !== GITHUB_PAGES_ORIGIN) return new Response(null, { status: 403, headers: HEADER });
      return new Response(null, { status: 204, headers: { ...HEADER, 'Access-Control-Allow-Origin': GITHUB_PAGES_ORIGIN, 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'content-type', 'Access-Control-Max-Age': '600', 'Vary': 'Origin' } });
    }
    if (request.method === 'GET' && url.pathname === '/api/health') return reply({ ok: true, aiConfigured: Boolean(env.OPENAI_API_KEY), privateStudioConfigured: false, publicGeneration: Boolean(env.OPENAI_API_KEY && env.QUOTAS), dailyIconsPerVisitor: 4, version: '2.1.0' });
    if (request.method === 'POST' && (url.pathname === '/api/analyze' || url.pathname === '/api/icon')) {
      const origin = request.headers.get('origin');
      const cors = (response) => {
        if (origin !== GITHUB_PAGES_ORIGIN) return response;
        const headers = new Headers(response.headers);
        headers.set('Access-Control-Allow-Origin', GITHUB_PAGES_ORIGIN);
        headers.set('Vary', 'Origin');
        headers.set('Cross-Origin-Resource-Policy', 'cross-origin');
        return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
      };
      if (origin && origin !== url.origin && origin !== GITHUB_PAGES_ORIGIN) return reply({ error: 'Origin not allowed' }, 403);
      if (!env.OPENAI_API_KEY || !env.QUOTAS) return cors(reply({ error: 'השירות עדיין אינו מוכן ליצירה' }, 503));
      if (!/^application\/json\b/i.test(request.headers.get('content-type') || '')) return cors(reply({ error: 'יש לשלוח JSON' }, 415));
      if (+request.headers.get('content-length') > MAX_BODY) return cors(reply({ error: 'בקשה גדולה מדי' }, 413));
      try {
        const txt = await request.text(); if (txt.length > MAX_BODY) return cors(reply({ error: 'בקשה גדולה מדי' }, 413));
        const body=JSON.parse(txt);
        const kind=url.pathname === '/api/analyze'?'analyze':'icon';
        if(kind==='icon'&&(!String(body?.name||'').trim()||validColors(body?.brand?.colors).length<2))return cors(reply({error:'חסר שם או צבעים לאייקון'},400));
        if(kind==='analyze'&&(validColors(body?.colors).length===0||(body?.mode==='logo'&&!body?.logoData)||(body?.mode==='url'&&!body?.siteUrl)))return cors(reply({error:'חסרים לוגו או אתר וצבעים'},400));
        if(!await consumeQuota(request,env,kind))return cors(reply({error:'מכסת היצירה להיום הסתיימה. אפשר לחזור מחר.'},429));
        return cors(kind==='analyze'?await analyze(body,env):await icon(body,env));
      } catch (e) { return cors(reply({ error: String(e?.message || 'שגיאה').slice(0, 210) }, 422)) }
    }
    return new Response('Not found', { status: 404, headers: HEADER });
  }
};