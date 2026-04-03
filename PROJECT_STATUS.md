# Project Status - 3 Nisan 2026

## Current State
- Site is deployed on GitHub Pages.
- Bilingual language switch (TR/EN) is working.
- `index.html` and `blog.html` both use shared `script.js` language logic.
- Language selection is persisted via `localStorage`.

## Last Fix Applied
- Prevented language toggle code from hiding language buttons.
- In `script.js`, selectors now exclude `.lang-btn` from content toggling.

## Live URL
- https://sancaroz.github.io/humanoid-robot-economy

## Next Recommended Steps
1. Add real subscribe form integration (Mailchimp/Brevo).
2. Add `services.html` and `contact.html` pages.
3. Add basic SEO tags (Open Graph, canonical, sitemap).
4. Connect custom domain when ready.

## Quick Resume Commands
```bash
cd ~/Desktop/HUMANOID\ ROBOTS\ ECONOMY
git status
git pull
```
