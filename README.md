# WBGT Planner 2.0

A complete mobile-first PWA for estimating WBGT using two independent models.

## Included

- Local GPS/Open-Meteo mode
- Chania Airport LGSA METAR hybrid mode
- Manual mode
- Liljegren/OSHA model
- Simplified psychrometric/globe model
- Souda Bay site profiles
- Hourly forecast
- Confidence scoring
- Engineer mode
- Validation logging and CSV export
- Offline caching
- iPhone Home Screen installation
- Cloudflare Worker for LGSA METAR

## Deploy to GitHub Pages

1. Create or open your GitHub repository.
2. Delete obsolete files.
3. Upload the **contents of the `souda-wbgt-v2` folder** to the repository root.
4. Commit changes.
5. Go to Settings → Pages.
6. Choose Deploy from a branch, `main`, `/ (root)`.
7. Open the published URL.

## Cloudflare Worker

See `cloudflare-worker/README.md`.

## Important

This is a planning tool. Weather-derived WBGT is not a substitute for a calibrated field instrument or command policy.

## Argonne acknowledgment

This product includes software produced by UChicago Argonne, LLC under Contract No. DE-AC02-06CH11357 with the Department of Energy.
