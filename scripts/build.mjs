import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
const html = readFileSync(new URL('../site.html', import.meta.url), 'utf8');
const backend = readFileSync(new URL('../src/api.mjs', import.meta.url), 'utf8');
writeFileSync(new URL('../worker.js', import.meta.url), 'const SITE = '+JSON.stringify(html)+';\n'+backend);
mkdirSync(new URL('../docs/', import.meta.url), { recursive: true });
writeFileSync(new URL('../docs/index.html', import.meta.url), html.replaceAll(' nonce="__NONCE__"', ''));
writeFileSync(new URL('../docs/.nojekyll', import.meta.url), '');
console.log('Built worker.js and docs/index.html');
