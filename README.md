# Daily Exhibit Checklist App

This is a standalone React and Vite app built in a separate folder so it does not affect the existing site.

## Run locally

1. Open a terminal in `daily-exhibit-checklist`
2. Run `npm install`
3. Run `npm run dev`

## Build for GitHub Pages

1. Run `npm run build`
2. The static output is written to `daily-exhibit-checklist/dist`
3. Because the app uses `base: './'`, the built files are safe to host on GitHub Pages under a project subpath

If you later want automatic GitHub Pages publishing from this repository, that will require a Pages workflow or Pages configuration change at the repo level.