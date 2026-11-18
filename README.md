# Iconly — Custom Icon Studio

Public brand-aware native SVG icon generator. **Live URL:** https://huxhkuh.github.io/Custom-icon/

Users can upload a logo or public HTTPS brand website, generate up to 4 SVG icons per visitor per UTC day, download a ZIP with references, without an account or access code.

## Architecture
- GitHub Pages serves static HTML from `docs/index.html`.
- Cloudflare Worker `iconly-brand-studio` hosts the paid API and retains `OPENAI_API_KEY` as an encrypted secret.
- D1 database binding `QUOTAS`, database `iconly-public-quotas`, enforces 4 icons per IP per UTC day (20 globally/day) and 8 brand analyses per IP per UTC day (80 globally/day). Missing bindings or database errors fail closed.
- `STUDIO_ACCESS_CODE` is retained as a **server-only hashing salt** for daily visitor hashes. It is *not* used as an access password.
- No API keys appear in repository or browser. Do not expose Cloudflare secrets through CI, JS, GitHub Pages, or public files.
- Public generation consumes paid API credits. Use an OpenAI project budget as an additional safeguard; quotas are not monetary caps.
- This is a small public beta, not hardened for heavy traffic. Consider Turnstile, bot protections and accounts before launch at scale.

Run `npm run check` to build both outputs and test. Changes to `site.html` deploy via GitHub Actions. Changes to `src/api.mjs` also require redeploying `worker.js` to Cloudflare.
