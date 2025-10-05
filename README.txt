MedFind - PWA with in-app barcode scanning (EAN-13 support) and APK conversion guide

Included files:
- index.html
- app.js
- styles.css
- manifest.json
- sw.js
- README.txt

How barcode works:
- The app tries to use the browser's native BarcodeDetector (fast).
- If not available, it falls back to ZXing (loaded from CDN) to scan from the camera.
- Scanned barcode is placed into the 'Barcode' field and saved with the medicine entry (field name: barcode).

Using the PWA:
1. Unzip the package to a folder.
2. Host locally (recommended) with a simple server (e.g., VSCode Live Server) or upload to your hosting.
3. Open the app in Chrome on Android. To install: use "Add to Home screen".

Export / Import:
- Export creates a CSV with columns: id,name,compartment,barcode
- Import accepts CSV with headers (name,compartment,barcode) or (id,name,compartment,barcode)

Create APK using PWABuilder (no Android Studio needed):
1. Upload your PWA to a public HTTPS URL OR use the hosted files. If you don't have hosting:
   - Option A: Use GitHub Pages (free) — push files to a repo and enable Pages.
   - Option B: Use Netlify/Surge/Vercel (simple drag & drop or connect repo).
2. Go to https://www.pwabuilder.com
3. Paste your PWA URL and click "Start".
4. Follow PWABuilder's steps. Choose "Android" and then "Build my PWA" (they generate an APK/AAB).
5. Download the generated package. You can provide your signing key or use their default for testing.
6. Install the APK on your Android device (you may need to allow installing from unknown sources).

If you want, I can:
- Provide a step-by-step GitHub Pages guide and upload-ready repo.
- Prepare a ready GitHub repo zip for you so you can upload to GitHub Pages without touching code.
