# Iconly — Custom Icon Studio

[Open source code](https://github.com/huxhkuh/Custom-icon) · [GitHub Pages](https://huxhkuh.github.io/Custom-icon/) · [Original Cloudflare demo](https://iconly-brand-studio.l0548461204.workers.dev/)

Iconly is a Hebrew RTL, brand-aware **native SVG** icon generator. Upload a PNG/JPEG/WebP brand logo or paste the URL of a public HTTPS website, choose an icon style, and download individual vector SVG icons or a complete ZIP with a `references.json` manifest.

## Project structure

- `site.html`: original UI source code (works on GitHub Pages and inside Cloudflare Worker).
- `docs/index.html`: generated static site for GitHub Pages.
- `src/api.mjs`: Cloudflare Worker API; all OpenAI calls happen here.
- `worker.js`: generated self-contained backend bundle.
- `scripts/build.mjs`: compiles both targets from the same source.
- `.github/workflows/pages.yml`: automatic tests and GitHub Pages deployment.

## Publishing the website from this GitHub project

**One-time required action:** Open [repository Settings → Pages](https://github.com/huxhkuh/Custom-icon/settings/pages), under **Build and deployment → Source**, choose **GitHub Actions**.

After that, each push to `main` triggers `.github/workflows/pages.yml`, runs `npm run check`, and publishes the site at **https://huxhkuh.github.io/Custom-icon/**.

GitHub Pages is static and does **not** store the API key. Its frontend calls the Cloudflare Worker backend via a restricted origin.

## Configure paid AI generation securely

The backend lives at https://iconly-brand-studio.l0548461204.workers.dev/. In Cloudflare: **Workers & Pages → iconly-brand-studio → Settings → Variables and Secrets**, add the following values as *encrypted secrets*, not plain environment variables:

1. `OPENAI_API_KEY`: an OpenAI Project API key with appropriate spending limits.
2. `STUDIO_ACCESS_CODE`: a separate long random owner access password, at least 24 characters.

The owner access code is entered on the website by the person generating icons. **Never add these secrets to this public GitHub repo, a JS file, or GitHub Pages configuration.**

Until both encrypted secrets are set, generation is disabled. The sample icon gallery is illustrative and still works without credentials.

**Backend deployments are currently manual.** The GitHub Pages frontend is published automatically; changing `src/api.mjs` also requires deploying the newly built `worker.js` to Cloudflare. For automatic backend deploys later, connect the repository to Cloudflare Workers Builds without storing a production key in public source.

## Local verification

Node.js 20+ required; no third-party npm runtime dependencies.

```bash
npm run check
```

## Security considerations

- The public repository contains zero secret values.
- Every chargeable endpoint requires an owner-only access code; CORS is allowlisted but does not replace authentication.
- The Worker bounds request sizes, fetches public HTTPS pages only, and rejects dangerous SVG markup.
- Uploaded logos are not persisted in an application database; they are sent to OpenAI for analysis. Generated files are held in browser memory until downloaded.
- Before offering this as an anonymous public SaaS: add account authentication, usage quotas, rate limits, abuse prevention, and billing.
- The API is not operational until both Cloudflare secrets are configured.

## Models

- OpenAI Responses: `gpt-5-mini` for visual/site-brand analysis.
- OpenAI Images: `gpt-image-2.6-flare` with `output_format: "svg"`.

Official [image-generation documentation](https://developers.openai.com/api/docs/guides/image-generation).
