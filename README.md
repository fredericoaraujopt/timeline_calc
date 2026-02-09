# Connectome Timeline Calculator

Spreadsheet-driven web calculator for connectome timeline estimates.

## Stack
- Next.js 14
- React 18
- TypeScript

## Run Locally
1. Install dependencies:
```bash
npm install
```
2. Start development server:
```bash
npm run dev
```
3. Open `http://localhost:3000`.

## Publish to GitHub (`timeline_calc`)
If this folder is not a git repo yet:

```bash
git init
git add .
git commit -m "Initial commit: connectome timeline calculator"
git branch -M main
git remote add origin https://github.com/<your-github-username>/timeline_calc.git
git push -u origin main
```

If you already have a local repo, just push:

```bash
git add .
git commit -m "Update calculator"
git push
```

## Deploy Free on Vercel (Auto-Updates on Push)
1. Go to [vercel.com/new](https://vercel.com/new) and sign in with GitHub.
2. Import the `timeline_calc` repository.
3. Confirm project settings:
   - Framework Preset: `Next.js`
   - Build Command: `npm run build` (default)
   - Output: auto-detected
4. Click **Deploy**.
5. After first deploy, every push to `main` triggers an automatic production redeploy.

Official docs:
- Vercel Git integration: https://vercel.com/docs/deployments/git
- Vercel + Next.js deployment flow: https://vercel.com/docs/frameworks/full-stack/nextjs

## Enable Suggestions Box (Formspree)
This app sends feedback using `NEXT_PUBLIC_FORMSPREE_ENDPOINT`.

1. Create a form in Formspree:
   - https://formspree.io/
2. Copy your endpoint URL (usually `https://formspree.io/f/<form_id>`).
3. In Vercel project settings, add environment variable:
   - Name: `NEXT_PUBLIC_FORMSPREE_ENDPOINT`
   - Value: your Formspree endpoint URL
   - Environment: Production (and Preview if you want it on preview builds too)
4. Redeploy (or push a new commit) so the variable is available to the site.

Official docs:
- Form setup (endpoint + fields): https://help.formspree.io/hc/en-us/articles/27638977431699-Building-an-HTML-Form
- JavaScript submission: https://help.formspree.io/hc/en-us/articles/360013470814-Submit-forms-with-JavaScript-AJAX
- Vercel env vars: https://vercel.com/docs/environment-variables

## Daily Update Workflow
1. Make local code changes.
2. Commit and push:
```bash
git add .
git commit -m "Describe change"
git push
```
3. Vercel automatically rebuilds and publishes the update.

## Notes
- The suggestions box shows `Could not send right now.` when `NEXT_PUBLIC_FORMSPREE_ENDPOINT` is missing or invalid.
- Keep calculator formulas and unit conversions in sync with `calculator/config.json` and `calculator/units.ts`.
