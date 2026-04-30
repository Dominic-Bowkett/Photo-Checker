# EPC Photo Organiser

A Chrome extension (Manifest V3) for organising photo evidence collected during
EPC (Energy Performance Certificate) assessments. Drag images from any webpage
into a side panel, sorted under categories that match the typical RdSAP photo
evidence requirements.

## Install (unpacked)

1. Open `chrome://extensions`.
2. Enable **Developer mode** (top right).
3. Click **Load unpacked** and select this folder.
4. Click the extension's toolbar icon to open the side panel.

Requires Chrome 114+ for the `chrome.sidePanel` API.

## Use

- The side panel ships with the standard EPC evidence headings. Click a heading
  to rename it, use **+ Category** to add new ones, or **×** to remove one.
- Drag any image from the active tab into a category drop zone.
- Hover a thumbnail to download or remove it.
- **Export** triggers a download for every photo, filed under
  `EPC/<category>/<id>.<ext>` in your Downloads folder.
- All state is kept in `chrome.storage.local` so it survives across sessions.

## Default categories

- Property exterior – front
- Property exterior – rear / sides
- Main heating (boiler / heat source)
- Heating controls (programmer & thermostat)
- Hot water cylinder
- Loft / roof insulation
- Walls – construction & insulation
- Floor construction
- Windows (sample)
- Lighting (low energy count)
- Extensions
- Renewables (PV / solar thermal / heat pump)
- Meter readings & fuel type
- Ventilation
- Other / notes

## Files

- `manifest.json` – MV3 manifest, registers the side panel and content script.
- `background.js` – service worker; opens the side panel on action click and
  proxies cross-origin image fetches to a data URL.
- `content.js` – ensures dragged `<img>` elements expose their URL on
  `dataTransfer` (helps with sites that block default image dragging).
- `sidepanel.html` / `sidepanel.css` / `sidepanel.js` – the panel UI, drop
  handling, persistence, and export.

## Notes

- Photos are stored as data URLs in `chrome.storage.local`; large libraries
  may hit the per-extension quota (~10 MB by default). Use **Export** to save
  to disk and **Clear** to free space.
- Some hosts disable image dragging or serve images with CORS restrictions. In
  those cases the URL is still recorded; the thumbnail falls back to the
  remote URL instead of an embedded copy.
