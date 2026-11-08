# Deploying the app (T9)

TL;DR: The app is plain static files. Any static host works. It needs no server, no database and no API key. A public link with no login is required for the submission. **Nothing has been deployed yet; a human must publish it.**

## Before every deploy
```
cd app
npm install          # only needed for tests and the Tone.js copy
npm test             # all tests must pass
npm run build        # rewrites precache.json (the offline file list and version)
```
Commit `precache.json`. If you skip `npm run build` after changing a file, offline users get stale files.

## What to upload
Upload the contents of `app/`, except `node_modules/`, `tools/`, `*.test.mjs`, `package*.json`, `sound/backup/`, and `sound/listen.html`. The list of files the offline cache needs is in `precache.json`. Everything in that list must be uploaded at the same paths.

## Hosting options (pick one; none is set up yet)
- **GitHub Pages** (free, public, no login for visitors). `.github/workflows/pages.yml` is ready in this repo and publishes the `app/` folder when pushed to `main` and Pages is enabled in the repository settings. Pushing and enabling Pages are the owner's actions.
- **Any static host** (Netlify drop, Cloudflare Pages, a school server): upload the files above. Serve over HTTPS: service workers and installing only work on HTTPS (and `localhost`).

## After deploy (checklist)
- [ ] Open the public URL in a private window on a phone: the page loads with no login.
- [ ] Press Test sound; the tone plays.
- [ ] Visit once online, then switch on airplane mode, reload: the page still loads and Play works.
- [ ] Chrome menu shows "Install app" (or "Add to Home screen").
- [ ] No console errors (a favicon 404 is harmless).
- [ ] Put the URL in `submission/project-page.md`.

## Run locally
```
cd app && python3 -m http.server 8000     # then open http://localhost:8000
```
