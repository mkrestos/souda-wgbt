# WBGT Planner PWA

A free, mobile-first Progressive Web App for estimating natural wet-bulb temperature, globe temperature, WBGT, and Navy-style heat flags.

## Deploy free with GitHub Pages

1. Create a free GitHub account.
2. Create a new **public** repository named `souda-wbgt`.
3. Upload every file and folder from this ZIP into the repository root.
4. Open **Settings → Pages**.
5. Under **Build and deployment**, choose **Deploy from a branch**.
6. Select the `main` branch and `/ (root)`, then save.
7. GitHub will publish the site at:
   `https://YOUR-USERNAME.github.io/souda-wbgt/`

## Install on iPhone

1. Open the published site in Safari.
2. Tap Share.
3. Tap **Add to Home Screen**.
4. Launch it from the icon.

## Notes

- Live weather comes from Open-Meteo using latitude and longitude.
- The app works offline for manual/scenario calculations after it has been opened once.
- Live weather requires an internet connection.
- The globe-temperature model is a planning estimate, not a replacement for a calibrated WBGT instrument.
- Official/local safety guidance controls operational decisions.

## Files

- `index.html` — app interface
- `styles.css` — responsive design
- `calculations.js` — wet-bulb, globe, and WBGT math
- `app.js` — GPS, API calls, UI behavior
- `manifest.json` — installable-app configuration
- `service-worker.js` — offline caching
- `privacy.html` — privacy notice
