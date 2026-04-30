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

- The side panel ships with the standard EPC evidence tags, each with the
  RdSAP guidance shown when the tag is expanded. Click a heading to rename
  it, use **+ Category** to add custom tags, or **×** to remove one.
- **Right‑click any image** on a webpage → **Add to EPC photo evidence** and
  pick a tag. Choose **Choose multiple tags…** to apply several at once
  (the side panel opens with a checkbox picker).
- You can also drag images directly into a tag drop zone.
- Hover a thumbnail to download or remove it.
- **Export** triggers a download for every photo, filed under
  `EPC/<tag>/<id>.<ext>` in your Downloads folder.
- All state is kept in `chrome.storage.local` so it survives across sessions.

## Default tags

Floorplan · External Elevations · Wall Construction · Roof Construction ·
Loft Space Access · Loft Insulation · Roof Rooms · Openings · Primary
Heating System · Heating System Controls · Hot Water Cylinder · Hot Water
Cylinder Thermostat · Electricity Meter · Heating Fuel · Conservatory ·
Light Fittings · Renewables · Additional Evidence

The most recent **Floorplan** image is pinned at the top of the side panel
for reference while filing other evidence. Click any thumbnail (pinned or
in a tag) to open it full‑size; arrow keys / ‹ › navigate, Esc closes.

### Filter and search

Above the tag list there is a **View** dropdown and a search box.

- Pick a single tag from the dropdown to focus on it (it auto‑expands so
  you can see its photos). "All tags" or "Only tags with photos" return
  to the full list.
- Type in the search box to keep only tags whose title, guidance, photo
  source page or filename matches.

### Import from PDF, Word, or URL

Click **Import file** to pick one or more `.pdf`, `.docx`, or image
files. PDFs are rasterised one page per image via PDF.js (more reliable
than embedded‑image extraction across colour spaces and image masks).
DOCX images are read straight out of `word/media/*` in the ZIP.

Click **From URL** to paste a remote URL. Image URLs (including AWS
signed S3 links) are added straight to the detected strip. PDF URLs are
fetched then rasterised page‑by‑page.

Imported items appear in the **Detected on page** strip, where you can
drag them into a tag, use **Send all**, or click a thumbnail to open the
lightbox and tag with one‑click pills (← / → step through items so you
can rip through tagging quickly).

### Auto-scan an assessment record

On a page like `https://energytrust.assessapp.com/assessment_records/*` click
**Scan tab** in the side panel. The extension locates the
"1. Photographic Evidence" question and lists the photos under both
"Please upload your photographic evidence below." and the optional
"Additional Evidence" section. Photos in the additional section are tagged
with a small `+` badge.

From the **Detected on page** strip you can:

- drag a thumbnail into any category, or
- pick a category from the dropdown and click **Send all** to file every
  detected photo at once, or
- double‑click a thumbnail to send just that one to the selected category.

## Files

- `manifest.json` – MV3 manifest, registers the side panel, content script
  and context menu.
- `background.js` – service worker; opens the side panel on action click,
  builds the right‑click "Add to EPC photo evidence" submenu, fetches
  images as data URLs, and writes directly to `chrome.storage.local`.
- `content.js` – exposes dragged `<img>` URLs on `dataTransfer` and
  responds to the side panel's `findEpcPhotos` message used by Scan tab.
- `sidepanel.html` / `sidepanel.css` / `sidepanel.js` – the panel UI,
  guidance display, drop handling, multi‑tag modal, persistence, export,
  filter dropdown / search box, and PDF / DOCX import.
- `vendor/pdf.js`, `vendor/pdf.worker.js` – Mozilla PDF.js v3.11.174
  used to extract embedded images from uploaded PDFs. Apache 2.0 licensed
  (see `vendor/PDFJS-LICENSE`).

## Notes

- Photos are stored as data URLs in `chrome.storage.local`; large libraries
  may hit the per-extension quota (~10 MB by default). Use **Export** to save
  to disk and **Clear** to free space.
- Some hosts disable image dragging or serve images with CORS restrictions. In
  those cases the URL is still recorded; the thumbnail falls back to the
  remote URL instead of an embedded copy.
