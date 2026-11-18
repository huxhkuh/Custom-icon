# Iconly — Custom Icon Studio

Public brand-aware native SVG icon generator. **Live URL:** https://huxhkuh.github.io/Custom-icon/

Users can upload a logo or public HTTPS brand website, generate up to 4 app interface SVG icons per batch, download a ZIP with references, without an account or access code.

## Architecture
- GitHub Pages serves static HTML from `docs/index.html`.
- Cloudflare Worker `iconly-brand-studio` hosts the paid API and retains `OPENAI_API_KEY` as an encrypted secret.
- No API keys appear in repository or browser. Do not expose Cloudflare secrets through CI, JS, GitHub Pages, or public files.
- This is a small public beta, not hardened for heavy traffic. Consider Turnstile, bot protections and accounts before launch at scale.

Run `npm run check` to build both outputs and test. Changes to `site.html` deploy via GitHub Actions. Changes to `src/api.mjs` also require redeploying `worker.js` to Cloudflare.
