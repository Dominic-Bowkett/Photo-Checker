const STORAGE_KEY = "epcPhotoState";
const STORAGE_VERSION = 4;
const PENDING_KEY = "epcPendingMultiTag";
const DEFAULT_KEY = "default";

function assessmentKeyFromMeta(meta) {
  if (!meta) return DEFAULT_KEY;
  const norm = (s) => (s || "").trim().toLowerCase().replace(/\s+/g, " ");
  const sn = norm(meta.studentName);
  const t = norm(meta.title);
  if (!sn && !t) return DEFAULT_KEY;
  return `${sn}|${t}`.slice(0, 200);
}

function defaultCategories() {
  return DEFAULT_CATEGORIES.map((c) => ({
    id: uid(),
    title: c.title,
    guidance: c.guidance,
    collapsed: true,
    status: null,
    photos: [],
  }));
}

function ensureBucket(key, meta) {
  if (!state.assessments[key]) {
    state.assessments[key] = {
      meta: meta || {
        studentName: "",
        title: key === DEFAULT_KEY ? "Default" : "",
        pageUrl: "",
        pageTitle: "",
      },
      categories: defaultCategories(),
      lastSeen: Date.now(),
    };
  } else if (meta) {
    state.assessments[key].meta = {
      ...state.assessments[key].meta,
      ...meta,
    };
  }
  if (state.assessments[key]) state.assessments[key].lastSeen = Date.now();
  return state.assessments[key];
}

function getBucket() {
  return ensureBucket(state.currentKey || DEFAULT_KEY);
}

function ensureDefaultTags(bucket) {
  let mutated = false;
  const titleLc = (s) => (s || "").toLowerCase();
  for (let i = 0; i < DEFAULT_CATEGORIES.length; i++) {
    const def = DEFAULT_CATEGORIES[i];
    const exists = bucket.categories.some(
      (c) => titleLc(c.title) === titleLc(def.title)
    );
    if (exists) continue;
    const newCat = {
      id: uid(),
      title: def.title,
      guidance: def.guidance,
      collapsed: true,
      status: null,
      photos: [],
    };
    let insertedAt = -1;
    for (let j = i - 1; j >= 0; j--) {
      const prevTitle = titleLc(DEFAULT_CATEGORIES[j].title);
      const idx = bucket.categories.findIndex(
        (c) => titleLc(c.title) === prevTitle
      );
      if (idx >= 0) {
        bucket.categories.splice(idx + 1, 0, newCat);
        insertedAt = idx + 1;
        break;
      }
    }
    if (insertedAt < 0) bucket.categories.unshift(newCat);
    mutated = true;
  }
  return mutated;
}

function getPracticalMode(meta) {
  const masters = (typeof window !== "undefined" && window.PRACTICAL_MASTERS) || {};
  const haystack =
    ((meta?.title || "") + " " + (meta?.pageTitle || ""))
      .toLowerCase();
  for (const key of Object.keys(masters)) {
    const cfg = masters[key];
    if (cfg?.titleMatch && cfg.titleMatch.test(haystack)) {
      return { id: key, ...cfg };
    }
  }
  return null;
}

function getCurrentPractical() {
  return getPracticalMode(getBucket().meta);
}

function bucketLabel(bucket, key) {
  if (!bucket) return key;
  const m = bucket.meta || {};
  if (m.studentName && m.title) return `${m.studentName} — ${m.title}`;
  if (m.studentName) return m.studentName;
  if (m.title) return m.title;
  return key === DEFAULT_KEY ? "Default" : key;
}

const DEFAULT_CATEGORIES = [
  {
    title: "Floorplan",
    guidance:
      "Property floorplan or sketch showing room layout, dimensions and orientation. The most recent image filed here is pinned at the top of the side panel for quick reference while filing other evidence.",
  },
  {
    title: "External Elevations",
    guidance:
      "All elevations appropriate to the detachment of the property. Elevation photos must be comprehensive enough to show the dwelling being assessed from its highest to lowest extent (a photo with the front door open is a good idea as it serves to prove that you had access to the property on the day of the assessment, just in case there are queries later).",
  },
  {
    title: "Wall Construction",
    guidance:
      "Evidence of build type, wall thickness measurements, retro-fitted insulation (such as cavity fill drill holes or boroscope investigations).",
  },
  {
    title: "Roof Construction",
    guidance:
      "Selections of all roof constructions selected for the building.",
  },
  {
    title: "Loft Space Access",
    guidance:
      "Evidence of access to the loft space or lack of access (as much as is possible).",
  },
  {
    title: "Loft Insulation",
    guidance:
      "Loft insulation which gives evidence of the depth of insulation and the overall insulation coverage within the loft. Where different areas of the building have assessable loft insulation, the evidence must indicate which area of the building each photograph relates to.",
  },
  {
    title: "Roof Rooms",
    guidance:
      "Evidence that supports the selection of a roof room including fixed access such that one can walk down facing forwards.",
  },
  {
    title: "Openings",
    guidance: "Windows, doors, draught proofing, chimneys, etc.",
  },
  {
    title: "Corridor / Stairwell",
    guidance:
      "Internal corridor and stairwell views including any low-energy lighting and door arrangements between heated and unheated zones.",
  },
  {
    title: "Primary Heating System",
    guidance:
      "Primary heating system(s) (e.g. boiler showing any associated key features such as a condensate pipe or label indicating the boiler model if using PCDF).",
  },
  {
    title: "Secondary Heating System",
    guidance:
      "Evidence of any secondary heating system (e.g. open fire, wood burner, electric panel heater) including a clear shot of the appliance and any labels or controls that confirm fuel type and rating.",
  },
  {
    title: "Heating System Controls",
    guidance:
      "All relevant thermostatic and/or timed controls appropriate to the primary heating system(s).",
  },
  {
    title: "Hot Water Cylinder",
    guidance: "Including evidence of insulation type and depth.",
  },
  {
    title: "Hot Water Cylinder Thermostat",
    guidance:
      "We must have a picture where possible. If a cylinder stat is assumed this should be documented in your site notes.",
  },
  {
    title: "Shower / Bath",
    guidance:
      "Photos of any electric showers, instantaneous mains-pressure showers, mixer showers and baths to support hot water demand and waste-water heat recovery selections.",
  },
  {
    title: "Electricity Meter",
    guidance:
      "Indicating dual or single tariff. If no access then site notes are vital to indicate the selection of electricity tariff. Only use 'unknown' if there is no access to the meter, no documentary evidence such as a utility bill AND there are no fixed dual electricity appliances in the dwelling. If there is a dual or twin HWC and/or fixed storage heaters it is advised to enter 'unknown' if you cannot access or locate the meter, and allow the software to default.",
  },
  {
    title: "Gas Meter",
    guidance:
      "Mains gas meter (and any sub-meters) to confirm fuel type and supply, including a clear reading where possible.",
  },
  {
    title: "Heating Fuel",
    guidance:
      "Evidence of fuel type selected for primary and secondary heating systems e.g. LPG cylinder, LPG tank, oil tank, mains gas meter, solid fuel store, utility bill.",
  },
  {
    title: "Conservatory",
    guidance:
      "Photographic evidence supporting the selection of a conservatory i.e. glazing coverage of room and exposed perimeter and its inclusion in the assessment i.e. whether it is separated or not.",
  },
  {
    title: "Light Fittings",
    guidance:
      "Evidence of low energy lamps within the building if they are included in the assessment (an example or selection is acceptable, you do not need to photograph every light fitting).",
  },
  {
    title: "Ventilation",
    guidance:
      "Ventilation strategy — extract fans, MVHR/MEV units, trickle vents, passive stacks — including any labels or controllers that confirm the system type.",
  },
  {
    title: "Renewables",
    guidance:
      "Evidence to support the selection of renewable or low-carbon technologies – solar, PV, WWHRS, FGHRS, wind turbines, etc.",
  },
  {
    title: "Additional Evidence",
    guidance:
      "Any other key feature of the building or limitation whose presence or absence may be reasonably considered likely to affect the SAP rating, or which would be required to support any claim made in the report that could be subsequently queried or be the subject of a complaint.",
  },
];

const uid = () =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

const state = {
  version: STORAGE_VERSION,
  currentKey: DEFAULT_KEY,
  assessments: {},
};

const $ = (sel, root = document) => root.querySelector(sel);
const categoriesEl = $("#categories");
const categoryTpl = $("#categoryTemplate");
const photoTpl = $("#photoTemplate");

let suppressNextStorageEvent = false;

async function load() {
  const stored = await chrome.storage.local.get(STORAGE_KEY);
  const existing = stored[STORAGE_KEY];
  if (existing?.version === STORAGE_VERSION && existing.assessments) {
    state.version = existing.version;
    state.assessments = existing.assessments || {};
    state.currentKey = existing.currentKey || DEFAULT_KEY;
  } else if (Array.isArray(existing?.categories) && existing.categories.length) {
    // Migrate v2/v3 flat categories into a single Default bucket.
    state.assessments = {
      [DEFAULT_KEY]: {
        meta: {
          studentName: "",
          title: "Default",
          pageUrl: "",
          pageTitle: "",
        },
        categories: existing.categories.map((c) => ({
          id: c.id || uid(),
          title: c.title,
          guidance:
            c.guidance ??
            DEFAULT_CATEGORIES.find((d) => d.title === c.title)?.guidance ??
            "",
          collapsed: c.collapsed ?? true,
          status: c.status || null,
          photos: c.photos || [],
        })),
        lastSeen: Date.now(),
      },
    };
    state.currentKey = DEFAULT_KEY;
    await save();
  } else {
    ensureBucket(DEFAULT_KEY);
    state.currentKey = DEFAULT_KEY;
    await save();
  }

  // Ensure every default tag exists in each bucket, in roughly the
  // canonical order. Idempotent — runs every load.
  let mutated = false;
  for (const key of Object.keys(state.assessments)) {
    const b = state.assessments[key];
    if (!b.categories) b.categories = defaultCategories();
    if (ensureDefaultTags(b)) mutated = true;
    for (const c of b.categories) {
      if (typeof c.status === "undefined") c.status = null;
    }
  }
  if (mutated) await save();

  render();
  await checkPendingMultiTag();
  detectActiveTabAssessment();
}

async function detectActiveTabAssessment() {
  let tab;
  try {
    [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  } catch (_) {
    return;
  }
  if (!tab?.id) return;
  let meta;
  try {
    meta = await chrome.tabs.sendMessage(tab.id, {
      type: "getAssessmentContext",
    });
  } catch (_) {
    return;
  }
  if (!meta) return;
  const key = assessmentKeyFromMeta(meta);
  if (key === DEFAULT_KEY) return;
  ensureBucket(key, meta);
  const switched = state.currentKey !== key;
  if (switched) {
    state.currentKey = key;
    clearDetected();
  }
  await save();
  render();
}

async function save() {
  suppressNextStorageEvent = true;
  try {
    await chrome.storage.local.set({ [STORAGE_KEY]: state });
  } catch (err) {
    suppressNextStorageEvent = false;
    if (/quota/i.test(err?.message || "")) {
      console.error("[EPC] Storage quota exceeded", err);
      alert(
        "Chrome storage quota was exceeded. Reload the extension at chrome://extensions to pick up the new unlimitedStorage permission, or clear some photos. Your most recent change wasn't saved."
      );
    }
    throw err;
  }
}

chrome.storage.onChanged.addListener(async (changes, area) => {
  if (area !== "local") return;
  if (changes[STORAGE_KEY]) {
    if (suppressNextStorageEvent) {
      suppressNextStorageEvent = false;
    } else {
      const next = changes[STORAGE_KEY].newValue;
      if (next?.version === STORAGE_VERSION && next.assessments) {
        state.assessments = next.assessments;
        if (next.currentKey) state.currentKey = next.currentKey;
        render();
      }
    }
  }
  if (changes[PENDING_KEY]?.newValue) {
    checkPendingMultiTag();
  }
});

if (chrome.tabs?.onActivated) {
  chrome.tabs.onActivated.addListener(() => detectActiveTabAssessment());
}
if (chrome.tabs?.onUpdated) {
  chrome.tabs.onUpdated.addListener((_id, info) => {
    if (info.status === "complete") detectActiveTabAssessment();
  });
}

function render() {
  rebuildAssessmentBar();
  const practical = getCurrentPractical();
  document.body.classList.toggle("practical-mode", !!practical);
  categoriesEl.innerHTML = "";
  if (practical) {
    const banner = document.createElement("div");
    banner.className = "practical-banner";
    banner.innerHTML =
      `<strong>${escapeHtml(practical.label)}</strong><br>` +
      `Photo evidence checks are disabled for this practical assessment. ` +
      `The site notes import will compare the trainee's submission against the master answer key.`;
    categoriesEl.appendChild(banner);
  } else {
    for (const cat of getBucket().categories) {
      categoriesEl.appendChild(renderCategory(cat));
    }
  }
  rebuildTagFilter();
  applyFilters();
  renderFloorplanPinned();
  renderAllPhotosPinned();
  renderNotesPinned();
  renderSiteNotesPinned();
}

let notesSaveTimer = null;

function renderNotesPinned() {
  const section = document.getElementById("notesPinned");
  const textarea = document.getElementById("notesArea");
  const status = document.getElementById("notesStatus");
  if (!section || !textarea) return;
  section.hidden = false;
  const bucket = getBucket();
  const value = typeof bucket.notes === "string" ? bucket.notes : "";
  if (document.activeElement !== textarea) {
    textarea.value = value;
    if (status) status.textContent = "";
  }
}

document.addEventListener("DOMContentLoaded", () => {});

const notesAreaEl = document.getElementById("notesArea");
notesAreaEl?.addEventListener("input", () => {
  const bucket = getBucket();
  bucket.notes = notesAreaEl.value;
  const status = document.getElementById("notesStatus");
  if (status) status.textContent = "Saving…";
  if (notesSaveTimer) clearTimeout(notesSaveTimer);
  notesSaveTimer = setTimeout(async () => {
    await save();
    if (status) status.textContent = "Saved";
    setTimeout(() => {
      if (status && status.textContent === "Saved") status.textContent = "";
    }, 1200);
  }, 400);
});

function collectAllUniquePhotos() {
  const seen = new Set();
  const out = [];
  for (const cat of getBucket().categories) {
    for (const photo of cat.photos) {
      const id = photoIdentity(photo);
      if (!id || seen.has(id)) continue;
      seen.add(id);
      out.push(photo);
    }
  }
  return out;
}

function renderAllPhotosPinned() {
  const section = document.getElementById("allPhotosPinned");
  const countEl = document.getElementById("allPhotosCount");
  const reviewBtn = document.getElementById("allPhotosReview");
  if (!section || !countEl || !reviewBtn) return;
  if (getCurrentPractical()) {
    section.hidden = true;
    return;
  }
  const all = collectAllUniquePhotos();
  countEl.textContent = String(all.length);
  reviewBtn.disabled = all.length === 0;
  section.hidden = false;
  reviewBtn.onclick = () => {
    const items = collectAllUniquePhotos();
    if (!items.length) return;
    openLightbox(items, 0);
  };
}

function rebuildAssessmentBar() {
  const sel = document.getElementById("assessmentSelect");
  if (!sel) return;
  sel.innerHTML = "";
  const keys = Object.keys(state.assessments).sort((a, b) => {
    const aL = state.assessments[a].lastSeen || 0;
    const bL = state.assessments[b].lastSeen || 0;
    return bL - aL;
  });
  for (const key of keys) {
    const opt = document.createElement("option");
    opt.value = key;
    opt.textContent = bucketLabel(state.assessments[key], key);
    sel.appendChild(opt);
  }
  sel.value = state.currentKey;
}

function findFloorplanCategory() {
  return getBucket().categories.find(
    (c) => c.title.toLowerCase() === "floorplan"
  );
}

function renderFloorplanPinned() {
  const section = document.getElementById("floorplanPinned");
  const img = document.getElementById("floorplanImg");
  const empty = section.querySelector(".pinned-empty");
  const expand = document.getElementById("floorplanExpand");
  const checkBtn = document.getElementById("floorplanCheck");
  const cat = findFloorplanCategory();
  if (getCurrentPractical()) {
    section.hidden = true;
    return;
  }
  section.hidden = false;
  if (!cat || !cat.photos.length) {
    img.hidden = true;
    img.removeAttribute("src");
    empty.hidden = false;
    expand.hidden = true;
    if (checkBtn) checkBtn.hidden = true;
    return;
  }
  const photo = cat.photos[cat.photos.length - 1];
  img.hidden = false;
  img.src = photo.dataUrl || photo.url;
  img.alt = photo.alt || "Floorplan";
  empty.hidden = true;
  expand.hidden = false;
  img.onclick = () => openLightbox(cat.photos, cat.photos.length - 1);
  expand.onclick = () => openLightbox(cat.photos, cat.photos.length - 1);
  if (checkBtn) {
    checkBtn.hidden = !settings?.claudeApiKey;
    checkBtn.onclick = () => runFloorplanCheck(photo);
  }
}

function renderCategory(cat) {
  const node = categoryTpl.content.firstElementChild.cloneNode(true);
  node.dataset.id = cat.id;
  const title = $(".title", node);
  title.textContent = cat.title;
  const countEl = $(".count", node);
  countEl.textContent = String(cat.photos.length);
  countEl.hidden = cat.photos.length === 0;
  const body = $(".category-body", node);
  const dropzone = $(".dropzone", node);
  const photosEl = $(".photos", node);
  const toggle = $(".toggle", node);
  const header = $(".category-header", node);
  const guidance = $(".guidance", node);

  guidance.textContent = cat.guidance || "";
  if (!cat.guidance) guidance.style.display = "none";

  const setCollapsed = (collapsed) => {
    body.classList.toggle("collapsed", collapsed);
    toggle.textContent = collapsed ? "▸" : "▾";
    header.setAttribute("aria-expanded", collapsed ? "false" : "true");
  };
  setCollapsed(cat.collapsed);

  title.addEventListener("blur", async () => {
    const next = title.textContent.trim() || "Untitled";
    title.textContent = next;
    cat.title = next;
    await save();
  });
  title.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      title.blur();
    }
  });
  title.addEventListener("click", (e) => e.stopPropagation());

  const toggleCollapsed = async () => {
    cat.collapsed = !cat.collapsed;
    setCollapsed(cat.collapsed);
    await save();
  };

  toggle.addEventListener("click", (e) => {
    e.stopPropagation();
    toggleCollapsed();
  });
  header.addEventListener("click", (e) => {
    if (
      e.target.closest(".status-btn") ||
      e.target.closest(".title") ||
      e.target.closest(".toggle")
    ) {
      return;
    }
    toggleCollapsed();
  });
  header.addEventListener("keydown", (e) => {
    if ((e.key === "Enter" || e.key === " ") && e.target === header) {
      e.preventDefault();
      toggleCollapsed();
    }
  });

  // Status (Done / N/A) toggles, visible even when collapsed.
  node.dataset.status = cat.status || "";
  const doneBtn = node.querySelector(".status-btn.done");
  const naBtn = node.querySelector(".status-btn.na");
  const reflectStatus = () => {
    node.dataset.status = cat.status || "";
    doneBtn.classList.toggle("active", cat.status === "done");
    naBtn.classList.toggle("active", cat.status === "na");
    doneBtn.setAttribute(
      "aria-pressed",
      cat.status === "done" ? "true" : "false"
    );
    naBtn.setAttribute(
      "aria-pressed",
      cat.status === "na" ? "true" : "false"
    );
  };
  reflectStatus();
  doneBtn.addEventListener("click", async (e) => {
    e.stopPropagation();
    cat.status = cat.status === "done" ? null : "done";
    reflectStatus();
    await save();
  });
  naBtn.addEventListener("click", async (e) => {
    e.stopPropagation();
    cat.status = cat.status === "na" ? null : "na";
    reflectStatus();
    await save();
  });

  for (const photo of cat.photos) {
    photosEl.appendChild(renderPhoto(cat, photo));
  }

  attachDropHandlers(dropzone, cat, photosEl, node);
  return node;
}

function renderPhoto(cat, photo) {
  const node = photoTpl.content.firstElementChild.cloneNode(true);
  const img = $("img", node);
  img.src = photo.dataUrl || photo.url;
  img.alt = photo.alt || "";
  $(".photo-source", node).textContent = photo.pageTitle || photo.url;
  $(".photo-source", node).title = photo.url;

  img.addEventListener("click", () => {
    const idx = cat.photos.findIndex((p) => p.id === photo.id);
    openLightbox(cat.photos, idx >= 0 ? idx : 0);
  });

  $(".photo-download", node).addEventListener("click", () =>
    downloadPhoto(cat, photo)
  );
  $(".photo-remove", node).addEventListener("click", async () => {
    cat.photos = cat.photos.filter((p) => p.id !== photo.id);
    await save();
    render();
  });
  return node;
}

function attachDropHandlers(dropzone, cat, photosEl, categoryNode) {
  const onOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
    dropzone.classList.add("dragover");
  };
  const onLeave = () => dropzone.classList.remove("dragover");

  dropzone.addEventListener("dragover", onOver);
  dropzone.addEventListener("dragenter", onOver);
  dropzone.addEventListener("dragleave", onLeave);
  dropzone.addEventListener("drop", async (e) => {
    e.preventDefault();
    dropzone.classList.remove("dragover");
    const items = await extractDroppedImages(e.dataTransfer);
    if (!items.length) return;
    for (const item of items) cat.photos.push(item);
    if (cat.collapsed) {
      cat.collapsed = false;
      $(".category-body", categoryNode).classList.remove("collapsed");
      $(".toggle", categoryNode).textContent = "▾";
    }
    await save();
    const cEl = $(".count", categoryNode);
    cEl.textContent = String(cat.photos.length);
    cEl.hidden = cat.photos.length === 0;
    for (const item of items) {
      photosEl.appendChild(renderPhoto(cat, item));
    }
  });
}

async function extractDroppedImages(dataTransfer) {
  const out = [];

  for (const file of dataTransfer.files || []) {
    if (file.type.startsWith("image/")) {
      const rawUrl = await fileToDataUrl(file);
      const dataUrl = await downscaleDataUrl(rawUrl);
      out.push({
        id: uid(),
        url: file.name,
        dataUrl,
        pageTitle: file.name,
        alt: "",
        addedAt: Date.now(),
      });
    }
  }

  const meta = safeJson(dataTransfer.getData("application/x-epc-photo"));
  const uri =
    dataTransfer.getData("text/uri-list") ||
    dataTransfer.getData("text/plain");
  const html = dataTransfer.getData("text/html");

  const urlsFromHtml = html ? extractImgSrc(html) : [];
  const candidate = (meta && meta.url) || uri || urlsFromHtml[0];

  if (candidate && /^https?:|^data:|^blob:/.test(candidate)) {
    const fetched = await fetchAsDataUrl(candidate);
    const compact = await downscaleDataUrl(fetched?.dataUrl || candidate);
    out.push({
      id: uid(),
      url: candidate,
      dataUrl: compact,
      pageTitle: meta?.pageTitle || "",
      pageUrl: meta?.pageUrl || "",
      alt: meta?.alt || "",
      addedAt: Date.now(),
    });
  }

  return out;
}

function safeJson(s) {
  if (!s) return null;
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}

function extractImgSrc(html) {
  const div = document.createElement("div");
  div.innerHTML = html;
  return Array.from(div.querySelectorAll("img"))
    .map((i) => i.src)
    .filter(Boolean);
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });
}

async function fetchAsDataUrl(url) {
  if (url.startsWith("data:")) return { dataUrl: url };
  try {
    const res = await new Promise((resolve) =>
      chrome.runtime.sendMessage({ type: "fetchImage", url }, resolve)
    );
    if (res?.ok) return { dataUrl: res.dataUrl };
  } catch (_) {
    /* fall through */
  }
  return null;
}

function downloadPhoto(cat, photo) {
  const safeCat = cat.title.replace(/[^a-z0-9-_ ]/gi, "_").trim();
  const ext = guessExt(photo.dataUrl || photo.url);
  const filename = `EPC/${safeCat}/${photo.id}.${ext}`;
  chrome.downloads.download({
    url: photo.dataUrl || photo.url,
    filename,
    saveAs: false,
  });
}

function guessExt(url) {
  if (!url) return "jpg";
  if (url.startsWith("data:")) {
    const m = url.match(/^data:image\/([a-zA-Z0-9.+-]+);/);
    return m ? m[1].replace("jpeg", "jpg") : "jpg";
  }
  const m = url.match(/\.([a-zA-Z0-9]{2,5})(?:\?|#|$)/);
  return m ? m[1].toLowerCase().replace("jpeg", "jpg") : "jpg";
}

$("#addCategory").addEventListener("click", async () => {
  const title = prompt("New tag name:");
  if (!title) return;
  getBucket().categories.push({
    id: uid(),
    title: title.trim(),
    guidance: "",
    collapsed: false,
    photos: [],
  });
  await save();
  render();
});

$("#clearAll").addEventListener("click", async () => {
  if (!confirm("Remove ALL photos from every tag?")) return;
  for (const c of getBucket().categories) c.photos = [];
  await save();
  render();
});

$("#exportAll").addEventListener("click", () => exportZip());

const ZIP_CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(bytes) {
  let c = ~0 >>> 0;
  for (let i = 0; i < bytes.length; i++) {
    c = (c >>> 8) ^ ZIP_CRC_TABLE[(c ^ bytes[i]) & 0xff];
  }
  return (~c) >>> 0;
}

function safeName(s) {
  return (s || "untitled")
    .replace(/[\\/:*?"<>|]+/g, "_")
    .replace(/\s+/g, " ")
    .trim() || "untitled";
}

async function downscaleDataUrl(dataUrl, maxEdge = 1600, quality = 0.82) {
  if (!dataUrl || !dataUrl.startsWith("data:image/")) return dataUrl;
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = async () => {
      try {
        const w = img.naturalWidth || img.width;
        const h = img.naturalHeight || img.height;
        if (!w || !h) return resolve(dataUrl);
        const scale = Math.min(1, maxEdge / Math.max(w, h));
        const tw = Math.max(1, Math.round(w * scale));
        const th = Math.max(1, Math.round(h * scale));
        // Skip work if it's already small.
        if (scale === 1 && dataUrl.length < 400_000) return resolve(dataUrl);
        const canvas =
          typeof OffscreenCanvas !== "undefined"
            ? new OffscreenCanvas(tw, th)
            : Object.assign(document.createElement("canvas"), {
                width: tw,
                height: th,
              });
        canvas.getContext("2d").drawImage(img, 0, 0, tw, th);
        const blob = canvas.convertToBlob
          ? await canvas.convertToBlob({ type: "image/jpeg", quality })
          : await new Promise((r) =>
              canvas.toBlob(r, "image/jpeg", quality)
            );
        if (!blob) return resolve(dataUrl);
        // Don't replace the original if compression made it bigger.
        if (blob.size >= Math.max(120_000, dataUrl.length * 0.7)) {
          return resolve(dataUrl);
        }
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => resolve(dataUrl);
        reader.readAsDataURL(blob);
      } catch (_) {
        resolve(dataUrl);
      }
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

async function reencodeAsPng(dataUrl) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = async () => {
      try {
        const w = img.naturalWidth || img.width;
        const h = img.naturalHeight || img.height;
        const canvas =
          typeof OffscreenCanvas !== "undefined"
            ? new OffscreenCanvas(w, h)
            : Object.assign(document.createElement("canvas"), {
                width: w,
                height: h,
              });
        canvas.getContext("2d").drawImage(img, 0, 0);
        const blob = canvas.convertToBlob
          ? await canvas.convertToBlob({ type: "image/png" })
          : await new Promise((r) => canvas.toBlob(r, "image/png"));
        const reader = new FileReader();
        reader.onload = () => {
          const m = String(reader.result).match(/^data:image\/png;base64,(.*)$/);
          resolve(m ? m[1] : null);
        };
        reader.onerror = () => resolve(null);
        reader.readAsDataURL(blob);
      } catch (_) {
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = dataUrl;
  });
}

function dataUrlToBytes(dataUrl) {
  const i = dataUrl.indexOf(",");
  if (i < 0) return null;
  const meta = dataUrl.slice(5, i);
  const isB64 = /;base64$/i.test(meta);
  const payload = dataUrl.slice(i + 1);
  if (isB64) {
    const bin = atob(payload);
    const out = new Uint8Array(bin.length);
    for (let j = 0; j < bin.length; j++) out[j] = bin.charCodeAt(j);
    return out;
  }
  return new TextEncoder().encode(decodeURIComponent(payload));
}

function buildZip(entries) {
  const enc = new TextEncoder();
  const parts = [];
  const central = [];
  let offset = 0;
  let cdSize = 0;

  for (const e of entries) {
    const nameBytes = enc.encode(e.name);
    const data = e.bytes;
    const crc = crc32(data);

    const lh = new Uint8Array(30);
    const lv = new DataView(lh.buffer);
    lv.setUint32(0, 0x04034b50, true);
    lv.setUint16(4, 20, true);
    lv.setUint16(6, 0, true);
    lv.setUint16(8, 0, true);
    lv.setUint16(10, 0, true);
    lv.setUint16(12, 0, true);
    lv.setUint16(14, 0, true);
    lv.setUint32(16, crc, true);
    lv.setUint32(20, data.length, true);
    lv.setUint32(24, data.length, true);
    lv.setUint16(28, nameBytes.length, true);
    parts.push(lh, nameBytes, data);

    const cd = new Uint8Array(46);
    const cv = new DataView(cd.buffer);
    cv.setUint32(0, 0x02014b50, true);
    cv.setUint16(4, 20, true);
    cv.setUint16(6, 20, true);
    cv.setUint16(8, 0, true);
    cv.setUint16(10, 0, true);
    cv.setUint16(12, 0, true);
    cv.setUint16(14, 0, true);
    cv.setUint32(16, crc, true);
    cv.setUint32(20, data.length, true);
    cv.setUint32(24, data.length, true);
    cv.setUint16(28, nameBytes.length, true);
    cv.setUint32(42, offset, true);
    central.push(cd, nameBytes);
    cdSize += 46 + nameBytes.length;

    offset += 30 + nameBytes.length + data.length;
  }

  const eocd = new Uint8Array(22);
  const ev = new DataView(eocd.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(8, entries.length, true);
  ev.setUint16(10, entries.length, true);
  ev.setUint32(12, cdSize, true);
  ev.setUint32(16, offset, true);

  return new Blob([...parts, ...central, eocd], { type: "application/zip" });
}

async function fetchBytes(url) {
  if (!url) return null;
  if (url.startsWith("data:")) return dataUrlToBytes(url);
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return new Uint8Array(await res.arrayBuffer());
  } catch (_) {
    return null;
  }
}

async function exportZip() {
  const bucket = getBucket();
  const meta = bucket.meta || {};
  const baseName =
    [safeName(meta.studentName), safeName(meta.title)]
      .filter((s) => s && s !== "untitled")
      .join(" - ") || "EPC Photo Evidence";

  const entries = [];
  let skipped = 0;
  for (const cat of bucket.categories) {
    if (!cat.photos.length) continue;
    const folder = safeName(cat.title);
    let i = 1;
    for (const photo of cat.photos) {
      const src = photo.dataUrl || photo.url;
      const bytes = await fetchBytes(src);
      if (!bytes) {
        skipped++;
        continue;
      }
      const ext = guessExt(src);
      const num = String(i).padStart(2, "0");
      i++;
      entries.push({
        name: `${baseName}/${folder}/${num}-${photo.id}.${ext}`,
        bytes,
      });
    }
  }

  if (!entries.length) {
    alert("No photos to export in this assessment.");
    return;
  }

  const blob = buildZip(entries);
  const url = URL.createObjectURL(blob);
  chrome.downloads.download(
    { url, filename: `${baseName}.zip`, saveAs: false },
    () => {
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    }
  );
  if (skipped) {
    setTimeout(
      () =>
        alert(
          `Exported ${entries.length} photo${
            entries.length === 1 ? "" : "s"
          }. ${skipped} could not be fetched and were skipped.`
        ),
      100
    );
  }
}

const summaryModal = $("#summaryModal");
const summaryBody = $("#summaryBody");

function buildSummary() {
  const cats = getBucket().categories;
  const met = cats.filter((c) => c.status === "done").map((c) => c.title);
  const missing = cats
    .filter((c) => c.status !== "done" && c.status !== "na")
    .map((c) => c.title);
  return { met, missing };
}

function renderSummary() {
  const { met, missing } = buildSummary();
  const bucket = getBucket();
  const heading = bucketLabel(bucket, state.currentKey);
  summaryBody.innerHTML = "";

  const headerEl = document.createElement("p");
  headerEl.innerHTML = `<strong>${escapeHtml(heading)}</strong>`;
  summaryBody.appendChild(headerEl);

  const metEl = document.createElement("section");
  metEl.className = "met";
  metEl.innerHTML = `<h3>Met</h3>`;
  if (met.length) {
    const p = document.createElement("p");
    p.textContent = `You have met the photo evidence requirements for: ${met.join(
      ", "
    )}.`;
    metEl.appendChild(p);
  } else {
    const p = document.createElement("p");
    p.className = "none";
    p.textContent = "No categories ticked as complete yet.";
    metEl.appendChild(p);
  }
  summaryBody.appendChild(metEl);

  const missEl = document.createElement("section");
  missEl.className = "missing";
  missEl.innerHTML = `<h3>Outstanding</h3>`;
  if (missing.length) {
    const p = document.createElement("p");
    p.textContent = `You need to provide sufficient photo evidence for these categories: ${missing.join(
      ", "
    )}.`;
    missEl.appendChild(p);
  } else {
    const p = document.createElement("p");
    p.className = "none";
    p.textContent = "Nothing outstanding — every category is either ticked or marked N/A.";
    missEl.appendChild(p);
  }
  summaryBody.appendChild(missEl);
}

function escapeHtml(s) {
  return (s || "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[c]));
}

function summaryAsText() {
  const { met, missing } = buildSummary();
  const lines = [];
  lines.push(bucketLabel(getBucket(), state.currentKey));
  lines.push("");
  if (met.length) {
    lines.push(
      `You have met the photo evidence requirements for: ${met.join(", ")}.`
    );
  } else {
    lines.push("No categories ticked as complete yet.");
  }
  lines.push("");
  if (missing.length) {
    lines.push(
      `You need to provide sufficient photo evidence for these categories: ${missing.join(
        ", "
      )}.`
    );
  } else {
    lines.push(
      "Nothing outstanding — every category is either ticked or marked N/A."
    );
  }
  return lines.join("\n");
}

$("#summaryBtn").addEventListener("click", () => {
  renderSummary();
  summaryModal.hidden = false;
});
$("#summaryClose").addEventListener("click", () => {
  summaryModal.hidden = true;
});
$("#summaryDismiss").addEventListener("click", () => {
  summaryModal.hidden = true;
});
$("#summaryCopy").addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(summaryAsText());
    const btn = $("#summaryCopy");
    const orig = btn.textContent;
    btn.textContent = "Copied";
    setTimeout(() => (btn.textContent = orig), 1200);
  } catch (_) {
    alert(summaryAsText());
  }
});

function clearDetected() {
  detected = [];
  if (typeof detectedListEl !== "undefined" && detectedListEl) {
    detectedListEl.innerHTML = "";
  }
  if (typeof detectedEl !== "undefined" && detectedEl) {
    detectedEl.hidden = true;
  }
  if (typeof refreshDetectedAutoTagVisibility === "function") {
    refreshDetectedAutoTagVisibility();
  }
}

const detectedEl = $("#detected");
const detectedListEl = $("#detectedList");
const detectedCountEl = $("#detectedCount");
let detected = [];

function existingPhotoUrls() {
  const set = new Set();
  for (const cat of getBucket().categories) {
    for (const p of cat.photos) {
      if (p.url) set.add(p.url);
    }
  }
  return set;
}

function showDetected(photos) {
  detected = photos.map((p) => ({ ...p, detectedId: p.detectedId || uid() }));
  detectedCountEl.textContent = String(detected.length);
  detectedEl.hidden = false;
  detectedEl.classList.toggle("empty", detected.length === 0);
  detectedListEl.innerHTML = "";
  const existing = existingPhotoUrls();
  for (const p of detected) {
    const li = document.createElement("li");
    li.draggable = true;
    li.dataset.section = p.section || "";
    li.title = `${p.section || ""}\n${p.url}`;
    const isExisting = p.url && existing.has(p.url);
    li.classList.toggle("is-tagged", !!isExisting);
    li.classList.toggle("is-new", !isExisting);
    const img = document.createElement("img");
    img.src = p.dataUrl || p.url;
    img.alt = p.alt || "";
    li.appendChild(img);
    li.addEventListener("dragstart", (e) => {
      e.dataTransfer.effectAllowed = "copy";
      e.dataTransfer.setData("text/uri-list", p.url);
      e.dataTransfer.setData("text/plain", p.url);
      e.dataTransfer.setData("application/x-epc-photo", JSON.stringify(p));
    });
    li.addEventListener("click", () => {
      const idx = detected.findIndex((x) => x === p);
      openLightbox(detected, idx >= 0 ? idx : 0);
    });
    detectedListEl.appendChild(li);
  }
  if (typeof refreshDetectedAutoTagVisibility === "function") {
    refreshDetectedAutoTagVisibility();
  }
}

$("#scanTab").addEventListener("click", async () => {
  let tab;
  try {
    [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  } catch (_) {
    /* no permission yet */
  }
  if (!tab?.id) {
    alert("No active tab found.");
    return;
  }
  let res;
  try {
    res = await chrome.tabs.sendMessage(tab.id, { type: "findEpcPhotos" });
  } catch (e) {
    alert(
      "Could not scan this tab. Make sure the page has finished loading and reload the extension if you just installed it."
    );
    return;
  }
  if (!res?.anchor) {
    alert(
      'Could not find a "Photographic Evidence" question on this page. Open an assessment record at energytrust.assessapp.com and try again.'
    );
    showDetected([]);
    return;
  }
  showDetected(res.photos || []);
});

$("#detectedClose").addEventListener("click", () => {
  detectedEl.hidden = true;
  detected = [];
});

const multiTagModal = $("#multiTagModal");
const multiTagOptions = $("#multiTagOptions");
const multiTagPreview = $("#multiTagPreview");
let pendingPhoto = null;

async function checkPendingMultiTag() {
  const stored = await chrome.storage.local.get(PENDING_KEY);
  const pending = stored[PENDING_KEY];
  if (!pending?.photo) return;
  pendingPhoto = pending.photo;
  // The background bundles the assessment context; switch to that bucket
  // so the pills reflect the right tag set.
  if (pending.assessmentKey) {
    ensureBucket(pending.assessmentKey, pending.meta);
    state.currentKey = pending.assessmentKey;
    await save();
    render();
  }
  openMultiTagModal(pending.photo);
}

function openMultiTagModal(photo) {
  multiTagPreview.src = photo.dataUrl || photo.url;
  multiTagOptions.innerHTML = "";
  for (const cat of getBucket().categories) {
    const id = `mt-${cat.id}`;
    const label = document.createElement("label");
    label.htmlFor = id;
    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.id = id;
    cb.value = cat.id;
    label.appendChild(cb);
    label.appendChild(document.createTextNode(cat.title));
    multiTagOptions.appendChild(label);
  }
  multiTagModal.hidden = false;
}

async function closeMultiTagModal(clearPending) {
  multiTagModal.hidden = true;
  pendingPhoto = null;
  if (clearPending) await chrome.storage.local.remove(PENDING_KEY);
}

$("#multiTagSave").addEventListener("click", async () => {
  if (!pendingPhoto) return closeMultiTagModal(true);
  const checked = [...multiTagOptions.querySelectorAll("input:checked")].map(
    (i) => i.value
  );
  if (!checked.length) {
    alert("Pick at least one tag, or Cancel.");
    return;
  }
  const compactDataUrl = await downscaleDataUrl(
    pendingPhoto.dataUrl || pendingPhoto.url
  );
  for (const catId of checked) {
    const cat = getBucket().categories.find((c) => c.id === catId);
    if (!cat) continue;
    cat.photos.push({
      id: uid(),
      url: pendingPhoto.url,
      dataUrl: compactDataUrl,
      pageUrl: pendingPhoto.pageUrl || "",
      pageTitle: pendingPhoto.pageTitle || "",
      alt: pendingPhoto.alt || "",
      addedAt: Date.now(),
    });
  }
  await save();
  render();
  if (detected.length) showDetected(detected);
  closeMultiTagModal(true);
});

$("#multiTagCancel").addEventListener("click", () => closeMultiTagModal(true));
$("#multiTagClose").addEventListener("click", () => closeMultiTagModal(true));

const lightboxEl = $("#lightbox");
const lightboxImg = $("#lightboxImg");
const lightboxCaption = $("#lightboxCaption");
const lightboxTagsEl = $("#lightboxTags");
let lightboxItems = [];
let lightboxIndex = 0;

function photoIdentity(p) {
  // A photo is "the same" across categories if its origin URL matches.
  // Detected items often share their URL even before they're filed.
  return (p && (p.url || p.dataUrl)) || "";
}

function categoriesContaining(item) {
  const id = photoIdentity(item);
  if (!id) return new Map();
  const out = new Map();
  for (const cat of getBucket().categories) {
    const photo = cat.photos.find((p) => photoIdentity(p) === id);
    if (photo) out.set(cat.id, photo.id);
  }
  return out;
}

function openLightbox(items, index) {
  if (!items?.length) return;
  lightboxItems = items.slice();
  lightboxIndex = Math.max(0, Math.min(index || 0, lightboxItems.length - 1));
  lightboxEl.hidden = false;
  showLightbox();
}

function showLightbox() {
  const item = lightboxItems[lightboxIndex];
  if (!item) return;
  // Reset zoom whenever we change image.
  document.getElementById("lightboxImgWrap")?.classList.remove("zoomed");
  lightboxImg.src = item.dataUrl || item.url;
  lightboxImg.alt = item.alt || "";
  const parts = [];
  if (item.pageTitle) parts.push(item.pageTitle);
  if (item.url && !item.url.startsWith("data:")) parts.push(item.url);
  if (lightboxItems.length > 1) {
    parts.push(`${lightboxIndex + 1} / ${lightboxItems.length}`);
  }
  lightboxCaption.textContent = parts.join(" — ");
  $("#lightboxPrev").style.visibility =
    lightboxItems.length > 1 ? "visible" : "hidden";
  $("#lightboxNext").style.visibility =
    lightboxItems.length > 1 ? "visible" : "hidden";
  renderLightboxPills(item);
  lightboxTagsEl.hidden = false;
}

function renderLightboxPills(item) {
  lightboxTagsEl.innerHTML = "";
  const assigned = categoriesContaining(item);
  for (const cat of getBucket().categories) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "tag-pill";
    btn.textContent = cat.title;
    if (assigned.has(cat.id)) btn.classList.add("active");
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      togglePillForItem(item, cat, btn);
    });
    lightboxTagsEl.appendChild(btn);
  }
  if (settings?.claudeApiKey) {
    const ai = document.createElement("button");
    ai.type = "button";
    ai.className = "tag-pill auto-tag";
    ai.textContent = "✨ Auto‑tag";
    ai.addEventListener("click", (e) => {
      e.stopPropagation();
      autoTagItem(item, ai);
    });
    lightboxTagsEl.appendChild(ai);
  }
}

async function togglePillForItem(item, cat, btn) {
  const id = photoIdentity(item);
  const existingIdx = cat.photos.findIndex((p) => photoIdentity(p) === id);
  if (existingIdx >= 0) {
    cat.photos.splice(existingIdx, 1);
    btn.classList.remove("active");
  } else {
    let dataUrl = item.dataUrl;
    if (!dataUrl || dataUrl === item.url) {
      const fetched = await fetchAsDataUrl(item.url);
      dataUrl = fetched?.dataUrl || item.dataUrl || item.url;
    }
    dataUrl = await downscaleDataUrl(dataUrl);
    cat.photos.push({
      id: uid(),
      url: item.url,
      dataUrl,
      pageUrl: item.pageUrl || "",
      pageTitle: item.pageTitle || item.section || "",
      alt: item.alt || "",
      addedAt: Date.now(),
    });
    btn.classList.add("active");
  }
  await save();
  render();
  // Re-render the detected strip so the NEW/tagged badges reflect the new
  // membership immediately.
  if (detected.length) showDetected(detected);
}

function closeLightbox() {
  lightboxEl.hidden = true;
  lightboxImg.removeAttribute("src");
  lightboxItems = [];
}

function stepLightbox(delta) {
  if (!lightboxItems.length) return;
  lightboxIndex =
    (lightboxIndex + delta + lightboxItems.length) % lightboxItems.length;
  showLightbox();
}

// Click image to toggle between fit-to-window and 100% (scrollable).
document
  .getElementById("lightboxImgWrap")
  ?.addEventListener("click", (e) => {
    if (e.target.id !== "lightboxImg") return;
    const wrap = document.getElementById("lightboxImgWrap");
    wrap.classList.toggle("zoomed");
    if (wrap.classList.contains("zoomed")) {
      // Center the click point in the scroll viewport.
      requestAnimationFrame(() => {
        const img = lightboxImg;
        const cx = e.offsetX || img.naturalWidth / 2;
        const cy = e.offsetY || img.naturalHeight / 2;
        wrap.scrollLeft = cx - wrap.clientWidth / 2;
        wrap.scrollTop = cy - wrap.clientHeight / 2;
      });
    }
  });

$("#lightboxClose").addEventListener("click", closeLightbox);
$("#lightboxPrev").addEventListener("click", () => stepLightbox(-1));
$("#lightboxNext").addEventListener("click", () => stepLightbox(1));
lightboxEl.addEventListener("click", (e) => {
  if (e.target === lightboxEl) closeLightbox();
});
document.addEventListener("keydown", (e) => {
  if (lightboxEl.hidden) return;
  if (e.key === "Escape") closeLightbox();
  else if (e.key === "ArrowLeft") stepLightbox(-1);
  else if (e.key === "ArrowRight") stepLightbox(1);
});

const tagFilterEl = $("#tagFilter");
const searchBoxEl = $("#searchBox");

function rebuildTagFilter() {
  const previous = tagFilterEl.value;
  for (const opt of [...tagFilterEl.querySelectorAll("option[data-cat]")]) {
    opt.remove();
  }
  for (const cat of getBucket().categories) {
    const opt = document.createElement("option");
    opt.value = cat.id;
    opt.dataset.cat = "1";
    const count = cat.photos.length;
    opt.textContent = count ? `${cat.title} (${count})` : cat.title;
    tagFilterEl.appendChild(opt);
  }
  if ([...tagFilterEl.options].some((o) => o.value === previous)) {
    tagFilterEl.value = previous;
  }
}

function applyFilters() {
  const sel = tagFilterEl.value;
  const term = searchBoxEl.value.trim().toLowerCase();
  const singleTag = sel !== "__all" && sel !== "__nonempty";

  for (const node of categoriesEl.querySelectorAll(".category")) {
    const id = node.dataset.id;
    const cat = getBucket().categories.find((c) => c.id === id);
    if (!cat) continue;

    let visible = true;
    if (sel === "__nonempty") visible = cat.photos.length > 0;
    else if (singleTag) visible = id === sel;

    if (visible && term) {
      const hay = (cat.title + " " + (cat.guidance || "")).toLowerCase();
      const photoMatch = cat.photos.some((p) =>
        ((p.pageTitle || "") + " " + (p.url || "") + " " + (p.alt || ""))
          .toLowerCase()
          .includes(term)
      );
      visible = hay.includes(term) || photoMatch;
    }

    node.classList.toggle("hidden", !visible);

    // When the user picks a single tag, force it open so they see the photos
    // immediately. Otherwise honour the persisted collapsed state.
    const body = $(".category-body", node);
    const toggle = $(".toggle", node);
    const forceOpen = visible && (singleTag || term);
    const collapsed = !forceOpen && cat.collapsed;
    body.classList.toggle("collapsed", collapsed);
    toggle.textContent = collapsed ? "▸" : "▾";
  }
}

tagFilterEl.addEventListener("change", applyFilters);
searchBoxEl.addEventListener("input", applyFilters);

const importBtn = $("#importBtn");
const importInput = $("#importFile");
const importModal = $("#importModal");
const importUrlEl = $("#importUrl");
const importStatusEl = $("#importStatus");

function openImportModal() {
  importUrlEl.value = "";
  importStatusEl.textContent = "";
  importModal.hidden = false;
  setTimeout(() => importUrlEl.focus(), 0);
}
function closeImportModal() {
  importModal.hidden = true;
}

importBtn.addEventListener("click", openImportModal);
$("#importModalClose").addEventListener("click", closeImportModal);
$("#importDone").addEventListener("click", closeImportModal);
$("#importPickFile").addEventListener("click", () => importInput.click());

$("#importUrlGo").addEventListener("click", async () => {
  const url = importUrlEl.value.trim();
  if (!url) return;
  importStatusEl.textContent = "Fetching…";
  try {
    const photos = await importFromUrl(url);
    if (!photos.length) {
      importStatusEl.textContent = "No images found.";
      return;
    }
    showDetected([...(detected || []), ...photos]);
    importStatusEl.textContent = `Added ${photos.length} photo${
      photos.length === 1 ? "" : "s"
    }.`;
    importUrlEl.value = "";
  } catch (err) {
    console.error("URL import failed", err);
    importStatusEl.textContent = `Error: ${err?.message || err}`;
  }
});
importUrlEl.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    $("#importUrlGo").click();
  }
});

async function importFromUrl(url) {
  // Use the background fetcher to dodge CORS for cross-origin images.
  let blob;
  let contentType = "";
  let filename = url.split("/").pop().split("?")[0] || "download";
  try {
    const res = await fetch(url, { credentials: "include" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    contentType = res.headers.get("content-type") || "";
    blob = await res.blob();
  } catch (err) {
    // Fall back to background data URL fetch (handles CORS-blocked images).
    const fetched = await fetchAsDataUrl(url);
    if (!fetched?.dataUrl) throw err;
    return [
      {
        url,
        dataUrl: await downscaleDataUrl(fetched.dataUrl),
        pageTitle: filename,
        pageUrl: url,
        alt: "",
        section: "URL import",
      },
    ];
  }
  // Force the right extractor by sniffing extension and content-type.
  const lower = url.toLowerCase();
  if (lower.endsWith(".pdf") || /pdf/i.test(contentType)) {
    return extractFromPdf(blobAsFile(blob, filename || "download.pdf"));
  }
  if (lower.endsWith(".docx") || /wordprocessingml/i.test(contentType)) {
    return extractFromDocx(blobAsFile(blob, filename || "download.docx"));
  }
  if (
    blob.type.startsWith("image/") ||
    /^image\//i.test(contentType) ||
    /\.(jpe?g|png|gif|webp|bmp)$/i.test(lower)
  ) {
    const dataUrl = await blobToDataUrl(blob);
    return [
      {
        url,
        dataUrl: await downscaleDataUrl(dataUrl),
        pageTitle: filename,
        pageUrl: url,
        alt: "",
        section: "URL import",
      },
    ];
  }
  throw new Error("Unsupported content type: " + (contentType || "unknown"));
}

function blobAsFile(blob, name) {
  return new File([blob], name, { type: blob.type });
}

importInput.addEventListener("change", async (e) => {
  const files = [...(e.target.files || [])];
  if (!files.length) return;
  for (const file of files) {
    try {
      const photos = await extractFromFile(file);
      if (photos.length) {
        showDetected([...(detected || []), ...photos]);
        showToast(
          `Imported ${photos.length} image${photos.length === 1 ? "" : "s"} from ${file.name}.`,
          { kind: "success" }
        );
      } else {
        showToast(`No images found in ${file.name}.`, { kind: "error" });
      }
    } catch (err) {
      console.error(err);
      showToast(`Could not read ${file.name}: ${err?.message || err}`, {
        kind: "error",
      });
    }
  }
  importInput.value = "";
  closeImportModal();
});

async function extractFromFile(file) {
  const name = file.name.toLowerCase();
  if (file.type.startsWith("image/")) {
    const dataUrl = await fileToDataUrl(file);
    return [
      {
        url: file.name,
        dataUrl,
        pageTitle: file.name,
        alt: "",
        section: "Local file",
      },
    ];
  }
  if (name.endsWith(".docx")) return extractFromDocx(file);
  if (name.endsWith(".pdf")) return extractFromPdf(file);
  throw new Error("Unsupported file type. Use PDF, DOCX, or an image.");
}

async function extractFromDocx(file) {
  // .docx is a ZIP. Read the central directory and stream out files under
  // word/media/* using a small inline ZIP reader (deflate or stored only).
  const buf = new Uint8Array(await file.arrayBuffer());
  const entries = readZipEntries(buf);
  const photos = [];
  for (const entry of entries) {
    if (!/^word\/media\//i.test(entry.name)) continue;
    if (!/\.(png|jpe?g|gif|bmp|webp)$/i.test(entry.name)) continue;
    const bytes = await inflateEntry(buf, entry);
    if (!bytes) continue;
    const mime = mimeFromName(entry.name);
    const blob = new Blob([bytes], { type: mime });
    const dataUrl = await blobToDataUrl(blob);
    photos.push({
      url: `${file.name}#${entry.name}`,
      dataUrl,
      pageTitle: `${file.name} – ${entry.name.split("/").pop()}`,
      alt: "",
      section: "DOCX import",
    });
  }
  return photos;
}

async function extractFromPdf(file) {
  const pdfjsLib = window.pdfjsLib;
  if (!pdfjsLib) throw new Error("pdf.js is not loaded");
  pdfjsLib.GlobalWorkerOptions.workerSrc = chrome.runtime.getURL(
    "vendor/pdf.worker.js"
  );

  const data = new Uint8Array(await file.arrayBuffer());
  const pdf = await pdfjsLib.getDocument({ data, disableFontFace: true })
    .promise;
  const photos = [];
  const scale = 2;

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement("canvas");
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    try {
      await page.render({ canvasContext: ctx, viewport }).promise;
    } catch (err) {
      console.warn("PDF page render failed", pageNum, err);
      page.cleanup();
      continue;
    }
    const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
    photos.push({
      url: `${file.name}#page${pageNum}`,
      dataUrl,
      pageTitle: `${file.name} – page ${pageNum}`,
      alt: "",
      section: "PDF page",
    });
    page.cleanup();
  }
  return photos;
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}

function mimeFromName(name) {
  const ext = name.split(".").pop().toLowerCase();
  return (
    {
      png: "image/png",
      jpg: "image/jpeg",
      jpeg: "image/jpeg",
      gif: "image/gif",
      bmp: "image/bmp",
      webp: "image/webp",
    }[ext] || "application/octet-stream"
  );
}

// Minimal ZIP reader sufficient for .docx files.
// Supports STORED (method 0) and DEFLATE (method 8) via DecompressionStream.
function readZipEntries(buf) {
  const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  // Find End of Central Directory record (search backwards, at most 64KB).
  const max = Math.max(0, buf.length - 22);
  const min = Math.max(0, buf.length - 65557);
  let eocd = -1;
  for (let i = max; i >= min; i--) {
    if (view.getUint32(i, true) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error("ZIP end-of-central-directory not found");
  const totalEntries = view.getUint16(eocd + 10, true);
  const cdSize = view.getUint32(eocd + 12, true);
  const cdOffset = view.getUint32(eocd + 16, true);
  const entries = [];
  let p = cdOffset;
  for (let i = 0; i < totalEntries; i++) {
    if (view.getUint32(p, true) !== 0x02014b50) break;
    const method = view.getUint16(p + 10, true);
    const compSize = view.getUint32(p + 20, true);
    const uncompSize = view.getUint32(p + 24, true);
    const nameLen = view.getUint16(p + 28, true);
    const extraLen = view.getUint16(p + 30, true);
    const commentLen = view.getUint16(p + 32, true);
    const localHeader = view.getUint32(p + 42, true);
    const name = new TextDecoder().decode(buf.subarray(p + 46, p + 46 + nameLen));
    entries.push({ name, method, compSize, uncompSize, localHeader });
    p += 46 + nameLen + extraLen + commentLen;
  }
  return entries;
}

async function inflateEntry(buf, entry) {
  const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  const lh = entry.localHeader;
  if (view.getUint32(lh, true) !== 0x04034b50) {
    console.warn("ZIP local header missing for", entry.name);
    return null;
  }
  const nameLen = view.getUint16(lh + 26, true);
  const extraLen = view.getUint16(lh + 28, true);
  const dataStart = lh + 30 + nameLen + extraLen;
  // Prefer the local header's size (more accurate when the central directory
  // shares a record with descriptors in the data area).
  const localComp = view.getUint32(lh + 18, true);
  const compSize = localComp || entry.compSize;
  if (!compSize || dataStart + compSize > buf.length) {
    console.warn("ZIP entry size out of bounds for", entry.name, {
      compSize,
      dataStart,
      bufLen: buf.length,
    });
    return null;
  }
  const compressed = new Uint8Array(buf.buffer, buf.byteOffset + dataStart, compSize);
  if (entry.method === 0) return new Uint8Array(compressed);
  if (entry.method === 8) {
    try {
      const stream = new Blob([compressed])
        .stream()
        .pipeThrough(new DecompressionStream("deflate-raw"));
      const out = await new Response(stream).arrayBuffer();
      return new Uint8Array(out);
    } catch (err) {
      console.warn("ZIP deflate failed for", entry.name, err);
      return null;
    }
  }
  console.warn("Unsupported ZIP method", entry.method, "for", entry.name);
  return null;
}

document
  .getElementById("assessmentSelect")
  .addEventListener("change", async (e) => {
    state.currentKey = e.target.value;
    ensureBucket(state.currentKey);
    clearDetected();
    await save();
    render();
  });

document
  .getElementById("renameAssessment")
  .addEventListener("click", async () => {
    const bucket = getBucket();
    const current = bucket.meta || {};
    const studentName = prompt(
      "Student / contact name:",
      current.studentName || ""
    );
    if (studentName === null) return;
    const title = prompt("Assessment title:", current.title || "");
    if (title === null) return;
    bucket.meta = {
      ...current,
      studentName: studentName.trim(),
      title: title.trim(),
    };
    // If the user renamed away from the default we also update the key.
    const newKey = assessmentKeyFromMeta(bucket.meta);
    if (newKey !== state.currentKey && newKey !== DEFAULT_KEY) {
      state.assessments[newKey] = bucket;
      delete state.assessments[state.currentKey];
      state.currentKey = newKey;
    }
    await save();
    render();
  });

document
  .getElementById("deleteAssessment")
  .addEventListener("click", async () => {
    const keys = Object.keys(state.assessments);
    if (keys.length <= 1) {
      alert("There's only one assessment — use Clear to empty it instead.");
      return;
    }
    const label = bucketLabel(getBucket(), state.currentKey);
    if (!confirm(`Delete the assessment "${label}" and all its photos?`)) return;
    delete state.assessments[state.currentKey];
    state.currentKey =
      Object.keys(state.assessments)[0] || DEFAULT_KEY;
    ensureBucket(state.currentKey);
    await save();
    render();
  });

// ---- Settings (Claude API key) ------------------------------------------
const SETTINGS_KEY = "epcSettings";
let settings = { claudeApiKey: "", claudeModel: "claude-sonnet-4-6" };

async function loadSettings() {
  const stored = await chrome.storage.local.get(SETTINGS_KEY);
  if (stored[SETTINGS_KEY]) {
    settings = { ...settings, ...stored[SETTINGS_KEY] };
  }
}

async function saveSettings() {
  await chrome.storage.local.set({ [SETTINGS_KEY]: settings });
}

const settingsModal = $("#settingsModal");
const settingsKeyInput = $("#claudeApiKey");
const settingsModelInput = $("#claudeModel");

$("#settingsBtn").addEventListener("click", () => {
  settingsKeyInput.value = settings.claudeApiKey || "";
  settingsModelInput.value = settings.claudeModel || "claude-sonnet-4-6";
  settingsModal.hidden = false;
  setTimeout(() => settingsKeyInput.focus(), 0);
});
$("#settingsClose").addEventListener("click", () => (settingsModal.hidden = true));
$("#settingsCancel").addEventListener("click", () => (settingsModal.hidden = true));
$("#settingsSave").addEventListener("click", async () => {
  settings.claudeApiKey = settingsKeyInput.value.trim();
  settings.claudeModel = settingsModelInput.value || "claude-sonnet-4-6";
  await saveSettings();
  settingsModal.hidden = true;
  // If the lightbox is open, refresh pills so the auto-tag button appears.
  if (!lightboxEl.hidden) renderLightboxPills(lightboxItems[lightboxIndex]);
  refreshDetectedAutoTagVisibility();
});

// ---- Claude vision auto-tagging ----------------------------------------
async function callClaudeForTags(item) {
  let dataUrl = item.dataUrl;
  if (!dataUrl || dataUrl === item.url) {
    const fetched = await fetchAsDataUrl(item.url);
    dataUrl = fetched?.dataUrl || item.dataUrl;
  }
  const m = dataUrl && dataUrl.match(/^data:(image\/[^;]+);base64,(.*)$/);
  if (!m) throw new Error("no image data");
  let mediaType = m[1];
  if (mediaType === "image/jpg") mediaType = "image/jpeg";
  let base64 = m[2];

  // Anthropic only accepts jpeg/png/gif/webp. Re-encode anything else (e.g.
  // bmp images embedded in DOCX) to PNG via a canvas so the call doesn't 400.
  const ALLOWED = new Set([
    "image/jpeg",
    "image/png",
    "image/gif",
    "image/webp",
  ]);
  if (!ALLOWED.has(mediaType)) {
    const reencoded = await reencodeAsPng(dataUrl);
    if (reencoded) {
      mediaType = "image/png";
      base64 = reencoded;
    } else {
      throw new Error(`Unsupported image type for Claude: ${mediaType}`);
    }
  }

  const cats = getBucket().categories;
  const tagList = cats.map((c) => c.title);

  console.debug(
    "[EPC] Claude tag call:",
    "mediaType=", mediaType,
    "url=", item.url
  );

  const resp = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": settings.claudeApiKey,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: settings.claudeModel || "claude-sonnet-4-6",
      max_tokens: 300,
      system:
        "You are an EPC photo evidence categoriser for UK SAP/RdSAP assessments. " +
        "Available categories: " +
        tagList.map((t) => `"${t}"`).join(", ") +
        ". Examine the image and respond with a JSON array of category names " +
        "from the list that clearly apply (one or more). Use exact names. " +
        "If nothing applies, return [].",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: { type: "base64", media_type: mediaType, data: base64 },
            },
            {
              type: "text",
              text: "Which of the listed EPC categories apply to this photo? Respond only with the JSON array.",
            },
          ],
        },
      ],
    }),
  });
  if (!resp.ok) {
    const errText = await resp.text();
    const err = new Error(`HTTP ${resp.status}: ${errText.slice(0, 300)}`);
    err.status = resp.status;
    throw err;
  }
  const data = await resp.json();
  const text = data?.content?.[0]?.text || "";
  const arrMatch = text.match(/\[[\s\S]*?\]/);
  if (!arrMatch) throw new Error(`Could not parse response: ${text.slice(0, 200)}`);
  const suggestions = JSON.parse(arrMatch[0]);
  if (!Array.isArray(suggestions)) throw new Error("Response was not a JSON array");
  return { suggestions, dataUrl };
}

async function applySuggestions(item, suggestions, dataUrl) {
  const cats = getBucket().categories;
  const id = photoIdentity(item);
  const compactDataUrl = await downscaleDataUrl(dataUrl);
  let added = 0;
  for (const tag of suggestions) {
    const cat = cats.find(
      (c) => c.title.toLowerCase() === String(tag).toLowerCase()
    );
    if (!cat) continue;
    if (cat.photos.some((p) => photoIdentity(p) === id)) continue;
    cat.photos.push({
      id: uid(),
      url: item.url,
      dataUrl: compactDataUrl,
      pageUrl: item.pageUrl || "",
      pageTitle: item.pageTitle || item.section || "",
      alt: item.alt || "",
      addedAt: Date.now(),
    });
    added++;
  }
  return added;
}

async function autoTagItem(item, btn) {
  if (!settings.claudeApiKey) {
    showToast("Set your Claude API key in Settings first (gear icon).", {
      kind: "error",
    });
    return;
  }
  const wasLabel = btn.textContent;
  btn.disabled = true;
  btn.textContent = "Analysing…";
  try {
    const { suggestions, dataUrl } = await callClaudeForTags(item);
    const added = await applySuggestions(item, suggestions, dataUrl);
    await save();
    render();
    renderLightboxPills(item);
    if (detected.length) showDetected(detected);
    btn.textContent = added
      ? `✨ +${added} tag${added === 1 ? "" : "s"}`
      : "✨ No new tags";
    setTimeout(() => (btn.textContent = wasLabel), 1800);
  } catch (err) {
    console.error("Auto-tag failed", err);
    if (err?.status === 401 || err?.status === 403) {
      showToast(
        "Claude rejected your API key. Open ⚙ Settings and paste a valid key (console.anthropic.com → API keys).",
        { kind: "error", ttl: 8000 }
      );
    } else {
      showToast("Auto-tag failed: " + (err?.message || err), {
        kind: "error",
        ttl: 8000,
      });
    }
    btn.textContent = wasLabel;
  } finally {
    btn.disabled = false;
  }
}

const detectedAutoTagBtn = $("#detectedAutoTag");

function refreshDetectedAutoTagVisibility() {
  if (!detectedAutoTagBtn) return;
  const visible =
    !!settings?.claudeApiKey && Array.isArray(detected) && detected.length > 0;
  detectedAutoTagBtn.hidden = !visible;
}

detectedAutoTagBtn?.addEventListener("click", async () => {
  if (!settings.claudeApiKey) {
    showToast("Set your Claude API key in Settings first (gear icon).", { kind: "error" });
    return;
  }
  if (!detected.length) return;

  const existing = existingPhotoUrls();
  const newOnly = detected.filter(
    (p) => !p.url || !existing.has(p.url)
  );
  const skippedAlready = detected.length - newOnly.length;

  console.debug(
    "[EPC] Auto-tag all:",
    "detected =", detected.length,
    "already-filed URLs in current bucket =", existing.size,
    "new =", newOnly.length
  );

  let items = newOnly;
  if (!items.length) {
    // Nothing matched the "new" filter — but still let the user override,
    // since the filter can stall on edge cases (stale URLs, blob:// etc).
    if (
      !confirm(
        `Every detected photo (${detected.length}) appears to already be ` +
          "filed in a tag in this assessment.\n\nTag all of them anyway?"
      )
    ) {
      return;
    }
    items = detected.slice();
  } else {
    const promptText = skippedAlready
      ? `Auto‑tag ${items.length} new photo${
          items.length === 1 ? "" : "s"
        }? (${skippedAlready} already filed will be skipped.)`
      : `Auto‑tag ${items.length} new photo${
          items.length === 1 ? "" : "s"
        }?`;
    if (!confirm(promptText)) return;
  }

  const wasLabel = detectedAutoTagBtn.textContent;
  detectedAutoTagBtn.disabled = true;
  let totalAdded = 0;
  let failures = 0;
  for (let i = 0; i < items.length; i++) {
    detectedAutoTagBtn.textContent = `Tagging ${i + 1}/${items.length}…`;
    try {
      const { suggestions, dataUrl } = await callClaudeForTags(items[i]);
      totalAdded += await applySuggestions(items[i], suggestions, dataUrl);
    } catch (err) {
      console.warn("Auto-tag failed for item", items[i]?.url, err);
      failures++;
      if (err?.status === 401 || err?.status === 403) {
        await save();
        detectedAutoTagBtn.disabled = false;
        detectedAutoTagBtn.textContent = wasLabel;
        showToast(
          `Stopped: Claude rejected your API key (${err.status}). Open ⚙ Settings and paste a valid key, then try again.`,
          { kind: "error", ttl: 8000 }
        );
        return;
      }
      if (err?.status === 429) {
        await save();
        detectedAutoTagBtn.disabled = false;
        detectedAutoTagBtn.textContent = wasLabel;
        showToast(
          `Stopped: Claude returned 429 (rate limited) on photo ${
            i + 1
          }/${items.length}. Wait a minute and run Auto‑tag all again — already-tagged photos will be skipped.`,
          { kind: "error", ttl: 8000 }
        );
        return;
      }
    }
    await save();
    if (i < items.length - 1) await new Promise((r) => setTimeout(r, 250));
  }
  render();
  if (!lightboxEl.hidden && lightboxItems[lightboxIndex]) {
    renderLightboxPills(lightboxItems[lightboxIndex]);
  }
  if (detected.length) showDetected(detected);
  detectedAutoTagBtn.disabled = false;
  detectedAutoTagBtn.textContent = wasLabel;
  showToast(
    `Auto‑tag complete. Added ${totalAdded} tag${
      totalAdded === 1 ? "" : "s"
    } across ${items.length - failures} photo${
      items.length - failures === 1 ? "" : "s"
    }` + (failures ? `, ${failures} failed.` : "."),
    { kind: failures ? "error" : "success" }
  );
});

// ---- Floorplan check (Claude vision) -----------------------------------
const FLOORPLAN_CHECKS = [
  {
    id: "envelope",
    label: "Outer envelope of all levels of all parts of the dwelling shown",
  },
  {
    id: "extensions",
    label:
      "Extensions, conservatories, rooms in the roof and unheated corridors shown separately (or marked N/A if none)",
  },
  {
    id: "dimensions",
    label:
      "Dimensions present and sufficient to verify floor area, heat-loss perimeter and ceiling height",
  },
  {
    id: "heatloss",
    label: "Walls forming the heat-loss perimeter clearly marked",
  },
  {
    id: "arrows",
    label:
      "Dimension arrows extend the full measurement so each dimension is unambiguous",
  },
  {
    id: "rooms",
    label: "Basic room layout included so the room count can be verified",
  },
];

const floorplanModal = $("#floorplanCheckModal");
const floorplanBody = $("#floorplanCheckBody");
let lastFloorplanResult = null;

function statusIcon(s) {
  switch (s) {
    case "pass":
      return "✓";
    case "fail":
      return "✗";
    case "unclear":
      return "?";
    case "na":
      return "–";
    default:
      return "·";
  }
}

function renderFloorplanResult(result) {
  floorplanBody.innerHTML = "";
  if (!result) {
    const p = document.createElement("p");
    p.className = "empty";
    p.textContent = "No result yet.";
    floorplanBody.appendChild(p);
    return;
  }
  if (result.overall) {
    const o = document.createElement("p");
    o.className = "overall";
    o.textContent = result.overall;
    floorplanBody.appendChild(o);
  }
  const byId = new Map(
    (result.checks || []).map((c) => [String(c.id || "").toLowerCase(), c])
  );
  for (const def of FLOORPLAN_CHECKS) {
    const found = byId.get(def.id) || {};
    const status = ["pass", "fail", "unclear", "na"].includes(found.status)
      ? found.status
      : "unclear";
    const row = document.createElement("div");
    row.className = "check";
    row.dataset.status = status;
    const icon = document.createElement("div");
    icon.className = "icon";
    icon.textContent = statusIcon(status);
    const label = document.createElement("div");
    label.className = "label";
    label.textContent = def.label;
    row.appendChild(icon);
    row.appendChild(label);
    if (found.note) {
      const note = document.createElement("p");
      note.className = "note";
      note.textContent = found.note;
      row.appendChild(note);
    }
    floorplanBody.appendChild(row);
  }
}

function floorplanResultAsText(result) {
  const lines = ["Floorplan check"];
  if (result?.overall) {
    lines.push("");
    lines.push(result.overall);
  }
  lines.push("");
  const byId = new Map(
    (result?.checks || []).map((c) => [String(c.id || "").toLowerCase(), c])
  );
  for (const def of FLOORPLAN_CHECKS) {
    const found = byId.get(def.id) || {};
    const status = found.status || "unclear";
    lines.push(`${statusIcon(status)} [${status.toUpperCase()}] ${def.label}`);
    if (found.note) lines.push(`    ${found.note}`);
  }
  return lines.join("\n");
}

async function runFloorplanCheck(photo) {
  if (!settings.claudeApiKey) {
    showToast("Set your Claude API key in Settings first (gear icon).", { kind: "error" });
    return;
  }

  let dataUrl = photo.dataUrl;
  if (!dataUrl || dataUrl === photo.url) {
    const fetched = await fetchAsDataUrl(photo.url);
    dataUrl = fetched?.dataUrl || dataUrl;
  }
  const m = dataUrl && dataUrl.match(/^data:(image\/[^;]+);base64,(.*)$/);
  if (!m) {
    alert("Could not load floorplan image data.");
    return;
  }
  let mediaType = m[1];
  if (mediaType === "image/jpg") mediaType = "image/jpeg";
  const base64 = m[2];

  const btn = document.getElementById("floorplanCheck");
  const wasLabel = btn?.textContent;
  if (btn) {
    btn.disabled = true;
    btn.textContent = "Analysing…";
  }

  // Open the modal up-front in a loading state so the user gets feedback.
  floorplanBody.innerHTML =
    '<p class="empty">Asking Claude to review the floorplan…</p>';
  floorplanModal.hidden = false;

  const checklist = FLOORPLAN_CHECKS.map(
    (c) => `- ${c.id}: ${c.label}`
  ).join("\n");

  try {
    const resp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": settings.claudeApiKey,
        "anthropic-version": "2023-06-01",
        "anthropic-dangerous-direct-browser-access": "true",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: settings.claudeModel || "claude-sonnet-4-6",
        max_tokens: 900,
        system:
          "You are an EPC/RdSAP floorplan auditor. Examine the floorplan image and " +
          "assess it against the listed requirements. For each requirement, return " +
          "one of: pass (clearly met), fail (clearly missing or incorrect), unclear " +
          "(can't tell from the image), or na (genuinely not applicable, e.g. no " +
          "extensions in the dwelling). Keep notes concise (one sentence).\n\n" +
          "Requirements:\n" +
          checklist +
          "\n\nReturn ONLY a JSON object with this shape, no prose:\n" +
          '{"overall": "<one or two sentence summary>", "checks": [{"id": "<id>", "status": "pass|fail|unclear|na", "note": "<short note>"}, ...]}',
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image",
                source: {
                  type: "base64",
                  media_type: mediaType,
                  data: base64,
                },
              },
              {
                type: "text",
                text: "Please assess this floorplan against the listed requirements and return the JSON.",
              },
            ],
          },
        ],
      }),
    });
    if (!resp.ok) {
      const errText = await resp.text();
      throw new Error(`HTTP ${resp.status}: ${errText.slice(0, 300)}`);
    }
    const data = await resp.json();
    const text = data?.content?.[0]?.text || "";
    const objMatch = text.match(/\{[\s\S]*\}/);
    if (!objMatch) throw new Error(`Could not parse response: ${text.slice(0, 200)}`);
    const result = JSON.parse(objMatch[0]);
    lastFloorplanResult = result;
    renderFloorplanResult(result);
  } catch (err) {
    console.error("Floorplan check failed", err);
    floorplanBody.innerHTML = `<p class="empty">Floorplan check failed: ${(
      err?.message || err
    )
      .toString()
      .replace(/[<>&]/g, (c) =>
        ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[c])
      )}</p>`;
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = wasLabel;
    }
  }
}

$("#floorplanCheckClose").addEventListener("click", () => {
  floorplanModal.hidden = true;
});
$("#floorplanCheckDismiss").addEventListener("click", () => {
  floorplanModal.hidden = true;
});
$("#floorplanCheckCopy").addEventListener("click", async () => {
  if (!lastFloorplanResult) return;
  const text = floorplanResultAsText(lastFloorplanResult);
  try {
    await navigator.clipboard.writeText(text);
    const btn = $("#floorplanCheckCopy");
    const wasLabel = btn.textContent;
    btn.textContent = "Copied";
    setTimeout(() => (btn.textContent = wasLabel), 1200);
  } catch (_) {
    alert(text);
  }
});

// ---- In-panel toast notifications ----------------------------------------
const toastStack = document.getElementById("toastStack");
function showToast(msg, opts = {}) {
  if (!toastStack) {
    console.log("[toast]", msg);
    return;
  }
  const node = document.createElement("div");
  node.className = "toast" + (opts.kind ? " " + opts.kind : "");
  const m = document.createElement("div");
  m.className = "msg";
  m.textContent = msg;
  const x = document.createElement("button");
  x.className = "close";
  x.textContent = "×";
  x.title = "Dismiss";
  x.addEventListener("click", () => node.remove());
  node.appendChild(m);
  node.appendChild(x);
  toastStack.appendChild(node);
  const ttl = opts.ttl ?? 5000;
  if (ttl > 0) setTimeout(() => node.remove(), ttl);
  return node;
}

function tryParseLooseJson(text) {
  if (!text) throw new Error("empty response");
  // Find the outermost { ... } block first.
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("no JSON object found");
  let candidate = text.slice(start, end + 1);
  // Common Claude JSON faults:
  //   - trailing commas before } or ]
  //   - smart quotes
  //   - stray backslashes
  candidate = candidate
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/,(\s*[}\]])/g, "$1");
  try {
    return JSON.parse(candidate);
  } catch (e1) {
    // One more try after removing newlines inside string-ish gaps.
    try {
      const aggressive = candidate
        .replace(/\\(?!["\\/bfnrtu])/g, "")
        .replace(/,(\s*[}\]])/g, "$1");
      return JSON.parse(aggressive);
    } catch (_) {
      const err = new Error(
        "Could not parse Claude JSON response: " + e1.message
      );
      err.rawText = text;
      throw err;
    }
  }
}

// ---- Site notes import + assessor checklist -----------------------------
const siteNotesPinned = $("#siteNotesPinned");
const siteNotesEmpty = $("#siteNotesEmpty");
const siteNotesContent = $("#siteNotesContent");
const siteNotesImportBtn = $("#siteNotesImport");
const siteNotesStatus = $("#siteNotesStatus");
const siteNotesSrcLabel = $("#siteNotesSrcLabel");
const siteNotesExtracted = $("#siteNotesExtracted");
const siteNotesChecklist = $("#siteNotesChecklist");
const siteNotesFeedback = $("#siteNotesFeedback");
const siteNotesModal = $("#siteNotesModal");
const siteNotesUrlEl = $("#siteNotesUrl");

let siteNotesFeedbackTimer = null;

function renderSiteNotesPinned() {
  if (!siteNotesPinned) return;
  siteNotesPinned.hidden = false;
  siteNotesImportBtn.hidden = !settings?.claudeApiKey;
  const bucket = getBucket();
  const sn = bucket.siteNotes;
  const history = bucket.siteNotesHistory || [];

  // History expander always reflects the bucket's history.
  renderSiteNotesHistory(history);

  if (!sn) {
    siteNotesContent.hidden = true;
    siteNotesEmpty.hidden = false;
    return;
  }
  siteNotesEmpty.hidden = true;
  siteNotesContent.hidden = false;
  siteNotesSrcLabel.textContent = sn.url || "(local PDF)";
  siteNotesExtracted.textContent = JSON.stringify(sn.extracted || {}, null, 2);

  const changesEl = document.getElementById("siteNotesChanges");
  const changesTextEl = document.getElementById("siteNotesChangesText");
  if (sn.changesSinceLast) {
    changesEl.hidden = false;
    changesTextEl.textContent = sn.changesSinceLast;
  } else {
    changesEl.hidden = true;
    changesTextEl.textContent = "";
  }

  // Checklist
  const showDoneEl = document.getElementById("siteNotesShowDone");
  if (showDoneEl) showDoneEl.checked = !!sn.uiShowCompleted;
  renderChecklistItems(sn);
  if (document.activeElement !== siteNotesFeedback) {
    siteNotesFeedback.value = sn.studentFeedback || "";
  }
}

function getItemStatus(sn, id) {
  if (sn.itemStatus && id in sn.itemStatus) return sn.itemStatus[id] || null;
  // Backwards compat with v1 ticks: tick = done.
  if (sn.ticks && sn.ticks[id]) return "done";
  return null;
}

function setItemStatus(sn, id, status) {
  sn.itemStatus = sn.itemStatus || {};
  if (status) sn.itemStatus[id] = status;
  else delete sn.itemStatus[id];
  // Keep ticks in sync for older code paths.
  sn.ticks = sn.ticks || {};
  if (status === "done") sn.ticks[id] = true;
  else delete sn.ticks[id];
  // Persist in the background — UI has already updated synchronously.
  save().catch((err) => console.error("[EPC] save failed", err));
}

function renderChecklistItems(sn) {
  siteNotesChecklist.innerHTML = "";
  const showDone = !!sn.uiShowCompleted;
  const items = sn.checklist || [];
  let doneCount = 0;
  let flagCount = 0;
  for (const item of items) {
    const status = getItemStatus(sn, item.id);
    if (status === "done") doneCount++;
    else if (status === "flagged") flagCount++;

    const li = document.createElement("li");
    li.dataset.severity = item.severity || "info";
    li.dataset.id = item.id;
    li.dataset.status = status || "";
    if (status === "done") {
      li.classList.add("done");
      if (!showDone) li.classList.add("hidden-done");
    } else if (status === "flagged") {
      li.classList.add("flagged");
    }

    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.checked = status === "done";
    cb.title = "Tick when evidence is acceptable";

    const flagBtn = document.createElement("button");
    flagBtn.type = "button";
    flagBtn.className = "flag-btn" + (status === "flagged" ? " active" : "");
    flagBtn.textContent = "⚑";
    flagBtn.title = "Flag for student feedback";

    const label = document.createElement("div");
    label.className = "label";
    label.textContent = item.label;

    const expandBtn = document.createElement("button");
    expandBtn.className = "expand-toggle";
    expandBtn.type = "button";
    expandBtn.title = "Show / hide linked photos";

    const detail = document.createElement("div");
    detail.className = "item-detail";

    const linkedPhotoCount = countLinkedPhotos(item);
    const startOpen = linkedPhotoCount > 0 && !status;

    const setOpen = (open) => {
      detail.hidden = !open;
      expandBtn.textContent = open ? "▾" : "▸";
      if (open) buildChecklistDetail(detail, item);
    };
    setOpen(startOpen);
    expandBtn.addEventListener("click", () => setOpen(detail.hidden));

    cb.addEventListener("change", () => {
      const newStatus = cb.checked ? "done" : null;
      // Update UI synchronously first so the flag flips immediately.
      li.classList.toggle("done", newStatus === "done");
      li.classList.remove("flagged");
      flagBtn.classList.remove("active");
      li.dataset.status = newStatus || "";
      if (!sn.uiShowCompleted) {
        li.classList.toggle("hidden-done", newStatus === "done");
      }
      if (newStatus === "done") setOpen(false);
      updateCheckSummary(sn);
      // Persist in the background.
      setItemStatus(sn, item.id, newStatus);
    });

    flagBtn.addEventListener("click", () => {
      const cur = getItemStatus(sn, item.id);
      const newStatus = cur === "flagged" ? null : "flagged";
      // Update UI synchronously.
      li.classList.toggle("flagged", newStatus === "flagged");
      li.classList.remove("done", "hidden-done");
      flagBtn.classList.toggle("active", newStatus === "flagged");
      cb.checked = false;
      li.dataset.status = newStatus || "";
      if (newStatus === "flagged") setOpen(false);
      updateCheckSummary(sn);
      // Persist in the background.
      setItemStatus(sn, item.id, newStatus);
    });

    li.appendChild(cb);
    li.appendChild(flagBtn);
    li.appendChild(label);
    li.appendChild(expandBtn);
    li.appendChild(detail);
    siteNotesChecklist.appendChild(li);
  }
  updateCheckSummary(sn, doneCount, flagCount);
}

function updateCheckSummary(sn, doneCount, flagCount) {
  const summary = document.getElementById("siteNotesCheckSummary");
  if (!summary) return;
  const items = sn.checklist || [];
  let done = 0;
  let flagged = 0;
  for (const it of items) {
    const s = getItemStatus(sn, it.id);
    if (s === "done") done++;
    else if (s === "flagged") flagged++;
  }
  if (typeof doneCount === "number") done = doneCount;
  if (typeof flagCount === "number") flagged = flagCount;
  const total = items.length;
  summary.textContent =
    `${done}/${total} done` + (flagged ? ` · ${flagged} flagged` : "");
}

function resolveItemTagNames(item) {
  const cats = getBucket().categories;
  const tagNames = (item.evidenceTags || []).filter(Boolean);
  if (!tagNames.length) {
    for (const cat of cats) {
      if ((item.label || "").toLowerCase().includes(cat.title.toLowerCase())) {
        tagNames.push(cat.title);
      }
    }
  }
  return tagNames;
}

function countLinkedPhotos(item) {
  const cats = getBucket().categories;
  const tagNames = resolveItemTagNames(item);
  let count = 0;
  for (const tagName of tagNames) {
    const cat = cats.find(
      (c) => c.title.toLowerCase() === tagName.toLowerCase()
    );
    if (cat) count += cat.photos.length;
  }
  return count;
}

function buildChecklistDetail(node, item) {
  node.innerHTML = "";
  const cats = getBucket().categories;
  const tagNames = (item.evidenceTags || []).filter(Boolean);
  // Try to derive evidence tags from the label if Claude didn't supply any.
  if (!tagNames.length) {
    for (const cat of cats) {
      if ((item.label || "").toLowerCase().includes(cat.title.toLowerCase())) {
        tagNames.push(cat.title);
      }
    }
  }
  if (!tagNames.length) {
    node.classList.add("empty");
    node.textContent = "No linked tags. Cross-reference manually.";
    return;
  }
  node.classList.remove("empty");
  const chips = document.createElement("div");
  chips.className = "item-tags";
  for (const tag of tagNames) {
    const chip = document.createElement("span");
    chip.className = "tag-chip";
    chip.textContent = tag;
    chips.appendChild(chip);
  }
  node.appendChild(chips);
  const thumbs = document.createElement("div");
  thumbs.className = "tag-thumbs";
  let any = false;
  for (const tagName of tagNames) {
    const cat = cats.find(
      (c) => c.title.toLowerCase() === tagName.toLowerCase()
    );
    if (!cat) continue;
    cat.photos.forEach((photo, idx) => {
      const img = document.createElement("img");
      img.src = photo.dataUrl || photo.url;
      img.alt = photo.alt || "";
      img.title = `${cat.title}`;
      img.addEventListener("click", () => openLightbox(cat.photos, idx));
      thumbs.appendChild(img);
      any = true;
    });
  }
  if (!any) {
    const empty = document.createElement("div");
    empty.className = "empty";
    empty.style.fontSize = "11px";
    empty.style.color = "var(--muted)";
    empty.textContent = "No photos filed yet under the linked tags.";
    node.appendChild(empty);
  } else {
    node.appendChild(thumbs);
  }
}

function renderSiteNotesHistory(history) {
  const wrap = document.getElementById("siteNotesHistoryWrap");
  const list = document.getElementById("siteNotesHistoryList");
  const count = document.getElementById("siteNotesHistoryCount");
  if (!wrap || !list || !count) return;
  list.innerHTML = "";
  count.textContent = String(history.length);
  if (!history.length) {
    wrap.hidden = true;
    return;
  }
  wrap.hidden = false;
  history.forEach((entry, i) => {
    const li = document.createElement("li");
    const t = document.createElement("time");
    const ts = entry.importedAt ? new Date(entry.importedAt) : null;
    t.textContent = ts ? ts.toLocaleString() : `Version ${i + 1}`;
    t.title = entry.url || "";
    const view = document.createElement("button");
    view.textContent = "View";
    view.addEventListener("click", () => {
      const json = JSON.stringify(entry.extracted || {}, null, 2);
      const fb = entry.studentFeedback ? `\n\nStudent feedback:\n${entry.studentFeedback}` : "";
      alert(`Imported ${ts ? ts.toLocaleString() : ""}\n${entry.url || ""}\n\n${json}${fb}`);
    });
    const restore = document.createElement("button");
    restore.textContent = "Restore";
    restore.title = "Make this the active version";
    restore.addEventListener("click", async () => {
      if (!confirm("Restore this version as the current site notes?")) return;
      const bucket = getBucket();
      const current = bucket.siteNotes;
      bucket.siteNotesHistory = (bucket.siteNotesHistory || []).filter(
        (_, idx) => idx !== i
      );
      if (current) bucket.siteNotesHistory.unshift(current);
      bucket.siteNotes = entry;
      await save();
      render();
    });
    const del = document.createElement("button");
    del.className = "danger";
    del.textContent = "Delete";
    del.addEventListener("click", async () => {
      if (!confirm("Delete this archived version?")) return;
      const bucket = getBucket();
      bucket.siteNotesHistory = (bucket.siteNotesHistory || []).filter(
        (_, idx) => idx !== i
      );
      await save();
      render();
    });
    li.appendChild(t);
    li.appendChild(view);
    li.appendChild(restore);
    li.appendChild(del);
    list.appendChild(li);
  });
}

siteNotesFeedback?.addEventListener("input", () => {
  const sn = getBucket().siteNotes;
  if (!sn) return;
  sn.studentFeedback = siteNotesFeedback.value;
  if (siteNotesFeedbackTimer) clearTimeout(siteNotesFeedbackTimer);
  siteNotesFeedbackTimer = setTimeout(() => save(), 400);
});

$("#siteNotesShowDone")?.addEventListener("change", async (e) => {
  const sn = getBucket().siteNotes;
  if (!sn) return;
  sn.uiShowCompleted = !!e.target.checked;
  await save();
  renderChecklistItems(sn);
});

$("#siteNotesGenFeedback")?.addEventListener("click", async () => {
  const sn = getBucket().siteNotes;
  if (!sn) return;
  if (!settings.claudeApiKey) {
    showToast("Set your Claude API key in Settings first (gear icon).", {
      kind: "error",
    });
    return;
  }
  const btn = $("#siteNotesGenFeedback");
  const wasLabel = btn.textContent;
  btn.disabled = true;
  btn.textContent = "Drafting…";
  try {
    const text = await generateStudentFeedback(sn);
    sn.studentFeedback = text;
    siteNotesFeedback.value = text;
    await save();
    showToast("Student feedback drafted.", { kind: "success" });
  } catch (err) {
    console.error("Generate feedback failed", err);
    showToast("Generate feedback failed: " + (err?.message || err), {
      kind: "error",
      ttl: 8000,
    });
  } finally {
    btn.disabled = false;
    btn.textContent = wasLabel;
  }
});

async function generateStudentFeedback(sn) {
  const flagged = (sn.checklist || []).filter(
    (it) => getItemStatus(sn, it.id) === "flagged"
  );
  const practical = getCurrentPractical();
  if (!flagged.length) {
    if (practical) {
      return (
        "All entries match the master answer key — you have met the criteria " +
        "and successfully completed " +
        practical.label +
        ".\n\nThanks!"
      );
    }
    return "Nothing flagged in my review — the assessment looks in order.\n\nThanks!";
  }
  // Strip evidenceTags so the prompt doesn't surface internal tag names.
  const flaggedForPrompt = flagged.map((it) => ({
    label: it.label,
    severity: it.severity,
  }));
  const SYSTEM = [
    "You are an EPC trainer giving feedback to a UK SAP/RdSAP trainee about",
    "their site notes and photo evidence. Write a warm, plain-English message",
    "the assessor can paste verbatim. Bulleted, ordered most important first.",
    "Reference RdSAP conventions where relevant.",
    "Only address the FLAGGED items below — these are what the assessor wants",
    "the trainee to fix. Speak in plain language about photos and evidence;",
    "do NOT reference any internal tag names, category names, side-panel",
    "structure, or that an automated tool was used. The trainee should not",
    "see any technical scaffolding.",
    "TONE / FORMAT RULES:",
    "- Do NOT begin the message with 'Hi <name>,' or any name greeting — the",
    "  assessor doesn't know who they're addressing. Open with a neutral line",
    "  like 'A few items to review:' or jump straight into the bullets.",
    "- Do NOT offer to be contacted directly (no 'feel free to call me',",
    "  'reach out to me', 'let me know if you have questions' etc.).",
    "- Where appropriate, direct the trainee to contact the helpline if they",
    "  need help (do not invent specific numbers — just say 'please contact",
    "  the helpline').",
    "- End with a short friendly sign-off such as 'Thanks!'.",
  ].join("\n");
  const body = JSON.stringify(
    {
      extracted: sn.extracted || {},
      flagged: flaggedForPrompt,
    },
    null,
    2
  );
  const resp = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": settings.claudeApiKey,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      // Use Haiku for practical-mode feedback drafting (fast text task).
      model: practical
        ? "claude-haiku-4-5-20251001"
        : settings.claudeModel || "claude-sonnet-4-6",
      max_tokens: 1500,
      system: SYSTEM,
      messages: [
        {
          role: "user",
          content:
            "Draft the trainee feedback message addressing the flagged items below. " +
            "Use only plain English — no internal tag or category names.\n\n" +
            body,
        },
      ],
    }),
  });
  if (!resp.ok) {
    const errText = await resp.text();
    const err = new Error(`HTTP ${resp.status}: ${errText.slice(0, 300)}`);
    err.status = resp.status;
    throw err;
  }
  const data = await resp.json();
  return (data?.content?.[0]?.text || "").trim();
}

$("#siteNotesCopy")?.addEventListener("click", async () => {
  const text = siteNotesFeedback.value;
  if (!text) return;
  try {
    await navigator.clipboard.writeText(text);
    const btn = $("#siteNotesCopy");
    const was = btn.textContent;
    btn.textContent = "Copied";
    setTimeout(() => (btn.textContent = was), 1200);
  } catch (_) {
    alert(text);
  }
});

siteNotesImportBtn?.addEventListener("click", () => {
  if (!settings.claudeApiKey) {
    showToast("Set your Claude API key in Settings first (gear icon).", { kind: "error" });
    return;
  }
  siteNotesUrlEl.value = "";
  siteNotesModal.hidden = false;
  setTimeout(() => siteNotesUrlEl.focus(), 0);
});
$("#siteNotesModalClose")?.addEventListener(
  "click",
  () => (siteNotesModal.hidden = true)
);
$("#siteNotesCancel")?.addEventListener(
  "click",
  () => (siteNotesModal.hidden = true)
);
$("#siteNotesReimport")?.addEventListener("click", () => {
  const sn = getBucket().siteNotes;
  if (!sn?.url) return;
  siteNotesUrlEl.value = sn.url;
  siteNotesModal.hidden = false;
});

$("#siteNotesDelete")?.addEventListener("click", async () => {
  const bucket = getBucket();
  const sn = bucket.siteNotes;
  if (!sn) return;
  if (
    !confirm(
      "Delete the current site notes? It will be moved into history so you can compare against it later."
    )
  ) {
    return;
  }
  bucket.siteNotesHistory = bucket.siteNotesHistory || [];
  bucket.siteNotesHistory.unshift(sn);
  // Cap history at 10 to keep storage sensible.
  bucket.siteNotesHistory = bucket.siteNotesHistory.slice(0, 10);
  delete bucket.siteNotes;
  await save();
  render();
});
siteNotesUrlEl?.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    $("#siteNotesGo").click();
  }
});

$("#siteNotesGo")?.addEventListener("click", async () => {
  const url = siteNotesUrlEl.value.trim();
  if (!url) return;
  siteNotesModal.hidden = true;
  await runSiteNotesImport(url);
});

async function runSiteNotesImport(url) {
  if (!settings.claudeApiKey) {
    showToast("Set your Claude API key in Settings first (gear icon).", { kind: "error" });
    return;
  }
  // Pre-flight: warn if there are no photos in the bucket yet — the checklist
  // can't link to evidence that isn't filed. Skipped for practical assessments
  // since they don't use photo evidence.
  const totalPhotos = getBucket().categories.reduce(
    (n, c) => n + (c.photos?.length || 0),
    0
  );
  if (totalPhotos === 0 && !getCurrentPractical()) {
    if (
      !confirm(
        "No photos are filed in this assessment yet. The site notes check works best when the photo evidence is already tagged so the checklist can link to specific photos.\n\nProceed anyway?"
      )
    ) {
      return;
    }
  }
  const wasLabel = siteNotesImportBtn?.textContent;
  if (siteNotesImportBtn) {
    siteNotesImportBtn.disabled = true;
    siteNotesImportBtn.textContent = "Fetching PDF…";
  }
  const setProgress = (msg) => {
    // Show progress on the button only — the small status label was a noisy
    // duplicate.
    siteNotesStatus.textContent = "";
    if (siteNotesImportBtn) siteNotesImportBtn.textContent = msg;
  };
  const finish = () => {
    if (siteNotesImportBtn) {
      siteNotesImportBtn.disabled = false;
      siteNotesImportBtn.textContent = wasLabel || "✨ Import PDF";
    }
  };

  setProgress("Fetching PDF…");
  let blob;
  try {
    blob = await fetchPdfBlob(url);
  } catch (err) {
    siteNotesStatus.textContent = "Fetch failed: " + (err?.message || err);
    finish();
    return;
  }
  console.debug("[EPC] site notes PDF fetched", blob?.size, blob?.type);

  setProgress("Reading PDF…");
  let text;
  try {
    text = await extractPdfText(blob);
  } catch (err) {
    siteNotesStatus.textContent = "PDF read failed: " + (err?.message || err);
    finish();
    return;
  }
  console.debug("[EPC] site notes PDF text length", text?.length);
  if (!text || text.trim().length < 80) {
    siteNotesStatus.textContent =
      "PDF contained very little extractable text — is it a scanned image PDF?";
    finish();
    return;
  }

  setProgress("Asking Claude…");
  let result;
  const bucket = getBucket();
  const previous = bucket.siteNotes || null;
  try {
    result = await callClaudeForSiteNotes(text, previous);
  } catch (err) {
    siteNotesStatus.textContent =
      "Claude call failed: " + (err?.message || err);
    finish();
    return;
  }

  const photoSummary = summarisePhotosForChecks();
  result.checklist = mergePhotoFlags(result.checklist || [], photoSummary);

  // Archive the previous import so the assessor can compare versions.
  if (previous) {
    bucket.siteNotesHistory = bucket.siteNotesHistory || [];
    bucket.siteNotesHistory.unshift(previous);
    bucket.siteNotesHistory = bucket.siteNotesHistory.slice(0, 10);
  }

  bucket.siteNotes = {
    url,
    importedAt: Date.now(),
    extracted: result.extracted || {},
    checklist: result.checklist || [],
    studentFeedback: "",
    changesSinceLast: result.changesSinceLast || "",
    ticks: previous?.url === url ? previous.ticks || {} : {},
    uiShowCompleted:
      previous?.url === url ? previous.uiShowCompleted || false : false,
  };
  await save();
  render();
  finish();
  siteNotesStatus.textContent = "Done.";
  setTimeout(() => {
    if (siteNotesStatus.textContent === "Done.") {
      siteNotesStatus.textContent = "";
    }
  }, 2000);
}

async function fetchPdfBlob(url) {
  // Try fetching from the side panel directly first.
  try {
    const res = await fetch(url, { credentials: "omit", mode: "cors" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const blob = await res.blob();
    if (blob && blob.size > 0) return blob;
    throw new Error("empty body");
  } catch (errDirect) {
    console.warn("[EPC] direct PDF fetch failed, trying background", errDirect);
  }
  // Fallback: ask the background worker (uses host_permissions to bypass CORS).
  const res = await new Promise((resolve) =>
    chrome.runtime.sendMessage({ type: "fetchUrlBytes", url }, resolve)
  );
  if (!res?.ok) {
    throw new Error(res?.error || "background fetch failed");
  }
  const m = String(res.dataUrl || "").match(/^data:([^;]+);base64,(.*)$/);
  if (!m) throw new Error("invalid response from background fetcher");
  const bin = atob(m[2]);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: m[1] });
}

async function extractPdfText(blob) {
  const pdfjsLib = window.pdfjsLib;
  if (!pdfjsLib) throw new Error("pdf.js not loaded");
  pdfjsLib.GlobalWorkerOptions.workerSrc = chrome.runtime.getURL(
    "vendor/pdf.worker.js"
  );
  const data = new Uint8Array(await blob.arrayBuffer());
  const pdf = await pdfjsLib.getDocument({ data, disableFontFace: true })
    .promise;
  const out = [];
  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const tc = await page.getTextContent();
    const pageText = tc.items
      .map((it) => ("str" in it ? it.str : ""))
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
    out.push(`--- Page ${p} ---\n${pageText}`);
    page.cleanup();
  }
  return out.join("\n\n");
}

function summarisePhotosForChecks() {
  const summary = {};
  for (const cat of getBucket().categories) {
    summary[cat.title] = cat.photos.length;
  }
  return summary;
}

function mergePhotoFlags(checklist, photoSummary) {
  // Add photo-availability colour to existing items where they reference a tag
  // in the bucket. Only annotates labels — keeps the assessor in control.
  return checklist.map((item) => {
    const lc = (item.label || "").toLowerCase();
    const refs = Object.entries(photoSummary).filter(([title]) =>
      lc.includes(title.toLowerCase())
    );
    if (refs.length) {
      const counts = refs
        .map(([t, n]) => `${t}: ${n} photo${n === 1 ? "" : "s"}`)
        .join("; ");
      return { ...item, label: `${item.label} (currently — ${counts})` };
    }
    return item;
  });
}

async function buildSiteNotesUserContent({
  text,
  previousExtracted,
  previousFeedback,
}) {
  const out = [];
  // Practical-assessment mode: send the master JSON instead of photos.
  const practical = getCurrentPractical();
  if (practical?.master) {
    out.push({
      type: "text",
      text:
        "PRACTICAL ASSESSMENT MODE — " +
        practical.label +
        "\n\nThis trainee is taking a practical exam graded purely on whether " +
        "their submission matches the master answer key.\n" +
        "RULES:\n" +
        "1. Compare the trainee's site notes ONLY against the master JSON. " +
        "Produce a checklist item ONLY when a value differs from the master. " +
        "If a field matches (within tolerance), do NOT include it.\n" +
        "2. NEVER ask the trainee to provide photos, a floorplan, or any " +
        "additional evidence. Photos and floorplan checks are out of scope " +
        "for this mode. Do not suggest 'review the photos', 'verify with a " +
        "photo', etc.\n" +
        "3. IGNORE these meta fields entirely — do not compare or flag them, " +
        "even if they differ: assessment.reference, assessment.inspectionDate, " +
        "assessment.reportCreatedDate, reportCreatedDate, inspectionDate, " +
        "reference. The trainee's own dates and reference are expected to " +
        "differ.\n" +
        "4. Each checklist label should describe the discrepancy in the " +
        "form 'Field X: trainee recorded <value>, expected <master value>'. " +
        "Severity must when the field affects RdSAP outputs, should for " +
        "minor mismatches, info for harmless deviations.\n" +
        "5. evidenceTags MUST be an empty array in this mode.\n" +
        "TOLERANCES:\n" +
        " - dimensions (lengths, heights, widths) within ±0.05 m of master " +
        "are a match\n" +
        " - wall thickness within ±100 mm of master is a match\n" +
        " - counts (rooms, lights, fans, openings) must match exactly\n" +
        " - text fields (e.g. construction type) must match exactly\n\n" +
        "MASTER JSON:\n" +
        JSON.stringify(practical.master, null, 2),
    });
  }
  if (previousExtracted) {
    out.push({
      type: "text",
      text:
        "Previous version's extracted JSON:\n" +
        String(previousExtracted).slice(0, 8000) +
        "\n\nPrevious feedback that was sent to the student:\n" +
        String(previousFeedback || "(none)").slice(0, 4000),
    });
  }
  out.push({
    type: "text",
    text:
      "Current site notes PDF text follows. Extract and check.\n\n" +
      String(text || "").slice(0, 60000),
  });

  // Attach photos so Claude can cross-reference what's actually been filed.
  // Capped to avoid an excessive payload — most assessments fit easily.
  const ALLOWED = new Set([
    "image/jpeg",
    "image/png",
    "image/gif",
    "image/webp",
  ]);
  const cats = getBucket().categories;
  const tagFor = (photo) => {
    const id = photoIdentity(photo);
    return cats
      .filter((c) => c.photos.some((p) => photoIdentity(p) === id))
      .map((c) => c.title);
  };
  const seen = new Set();
  const queue = [];
  // Practical mode never attaches photos — master JSON drives the comparison.
  if (practical) return out;
  for (const cat of cats) {
    for (const p of cat.photos) {
      const id = photoIdentity(p);
      if (!id || seen.has(id)) continue;
      seen.add(id);
      queue.push(p);
    }
  }
  const MAX_PHOTOS = 40;
  if (queue.length > MAX_PHOTOS) queue.length = MAX_PHOTOS;
  let attached = 0;
  if (queue.length) {
    out.push({
      type: "text",
      text: `Photos filed in the side panel follow (${queue.length} attached). Each is labelled with the tags it's filed under so you can match them to checklist items.`,
    });
  }
  for (const photo of queue) {
    let dataUrl = photo.dataUrl;
    if (!dataUrl?.startsWith("data:")) continue;
    const small = await downscaleDataUrl(dataUrl, 512, 0.7);
    let m = String(small).match(/^data:(image\/[^;]+);base64,(.*)$/);
    if (!m) continue;
    let mediaType = m[1];
    let base64 = m[2];
    if (mediaType === "image/jpg") mediaType = "image/jpeg";
    if (!ALLOWED.has(mediaType)) {
      const png = await reencodeAsPng(small);
      if (!png) continue;
      mediaType = "image/png";
      base64 = png;
    }
    const tags = tagFor(photo);
    out.push({
      type: "text",
      text: `Photo — tags: ${tags.join(", ") || "(untagged)"}${
        photo.pageTitle ? ` — ${String(photo.pageTitle).slice(0, 80)}` : ""
      }`,
    });
    out.push({
      type: "image",
      source: { type: "base64", media_type: mediaType, data: base64 },
    });
    attached++;
  }
  console.debug(
    "[EPC] site notes payload",
    "photos attached =",
    attached,
    "of",
    queue.length
  );
  return out;
}

async function callClaudeForSiteNotes(text, previous) {
  const tagList = getBucket().categories.map((c) => c.title);
  const photoSummary = summarisePhotosForChecks();
  const photoSummaryText = Object.entries(photoSummary)
    .map(([t, n]) => `${t}: ${n}`)
    .join(", ");

  const previousExtracted = previous?.extracted
    ? JSON.stringify(previous.extracted)
    : null;
  const previousFeedback = previous?.studentFeedback || null;

  const SYSTEM = [
    "You are an EPC / RdSAP site notes auditor for UK EPC assessor trainees.",
    "You receive the raw text of an assessor's site notes PDF and the names",
    "of available photo evidence tags in the side panel.",
    "",
    "Return ONLY a JSON object with this exact shape:",
    '{ "extracted": {...}, "checklist": [{"id": "kebab-id", "label": "...", "severity": "must|should|info", "evidenceTags": ["Tag Name"]}], "changesSinceLast": "..." }',
    "Each checklist item MUST include `evidenceTags`: a list of tag names",
    "from the side panel that an assessor would look at to verify this item",
    "(use the EXACT tag names from the supplied list). Empty array if no",
    "single tag clearly applies.",
    "DO NOT include a studentFeedback field — that is generated separately",
    "after the assessor has reviewed the checklist.",
    "If a previous version is supplied, populate `changesSinceLast` with a",
    "concise summary of what the student changed (or didn't change) compared",
    "to it, focused on whether queries from the previous round were addressed.",
    "If no previous version is supplied, leave `changesSinceLast` as an empty string.",
    "",
    "FIELDS to populate in `extracted` (omit any you cannot find):",
    "- detachmentType, builtForm, propertyType, ageRangeMain, ageRangeExtensions",
    "- electricMeter:{type, smart, exportCapable, evidenceMentioned}",
    "- gasMeter:{present, smart}",
    "- conservatory:{present, separated, glazingPercent, perimeter}",
    "- wallConstruction:{type, asBuilt, insulationType, thicknessMain, thicknessExtensions}",
    "- partyWall:{type}",
    "- floor:{construction, hasBasement, suspendedTimberAirVents, insulationType, asBuilt}",
    "- windows:{ageRange, glazingGapMm, thermalBar, evidence, dimensions}",
    "- ventilation:{type, openFlues, closedFlues, boilerFlues, otherFlues, fluelessGasFires, extractFans, passiveVents}",
    "- draftLobby",
    "- renewables:[{type, kwp, mcsCert, isExportCapable}]",
    "- unheatedRooms:[]",
    "- openChimneys",
    "- lightFittings:{led, cfl, halogen, incandescent, total}",
    "- roofRooms:{present, type, accessLimitation}",
    "- loftAccess:{accessible, hatchVisible}",
    "- flatRoof:{construction, asBuilt}",
    "- slopingCeiling:{construction, asBuilt}",
    "- doors:{draftProof, doubleGlazed}",
    "- primaryHeating:{dataSource, model, fuel, secondaryHeating}",
    "- heatingControls:[]",
    "- centralHeatingPump:{age, eeiPresent}",
    "- waterHeating:{type, immersion, dualImmersion, cylinderThermostat, cylinderInsulationThicknessMm}",
    "- recommendedMeasures:[]",
    "- addendum15Selected",
    "",
    "RULES — generate a checklist item (severity must|should|info) when ANY of:",
    "- Electric meter is dual / Economy 7 / 24 etc with no clear photo or paperwork evidence",
    "- Electric meter smart status mentioned but export capability not confirmed",
    "- Gas smart meter status missing",
    "- Conservatory present but glazing percentage / perimeter not stated. " +
      "IMPORTANT: if the PDF contains a value under 'Record length of glazed " +
      "perimeter' (or similar), treat the glazing extent as already recorded — " +
      "do not flag it for that reason.",
    "- Wall insulation type is anything other than 'As Built' (must explain why)",
    "- Wall insulation 'Filled Cavity' selected with no drill-hole / paperwork evidence noted",
    "- Wall thickness measurements missing for main property or any extension. " +
      "If a wall thickness photo IS supplied and the measurement visible in the " +
      "photo differs from the value recorded in the site notes, only flag if " +
      "the difference is greater than 100 mm. Anything within ±100 mm is " +
      "treated as a tolerance match.",
    "- Party wall 'Other' selected without photo evidence",
    "- Floor construction mentions basement (always flag for further investigation)",
    "- Floor is suspended timber but no sub-floor air vent or timber floor photo noted",
    "- Floor insulation is anything other than 'As Built' (must explain why); 'Unknown' only when evidence conflicts",
    "- Windows 2002-2021 and no thermal bar / paperwork evidence",
    "- Windows 2022+ without paperwork or build date justification",
    "- Windows pre-2002 without datestamp / paperwork; if Unknown, glazing gap measurement & photo",
    "- Window dimensions look anomalous (should be in metres, e.g. 0.89; flag values > 5 or < 0.3)",
    "- Ventilation anything other than 'natural'",
    "- Open flues >= 1 (verify chimney / fireplace evidence; ≤ 200mm diameter)",
    "- Closed flues — verify if log burner / closed room heater present",
    "- Boiler flues > 0 (these are solid-fuel boiler flues, not gas; flag)",
    "- Other flues > 0 (gas room heaters)",
    "- Flueless gas fires > 0 without photo",
    "- Extract fans >= 1 without photo",
    "- Passive vents > 0 (often confused with air bricks / trickle vents — verify it's a passive stack)",
    "- Draft lobby = yes without photo",
    "- Renewables present without MCS cert paperwork or photo; verify kWp; flag > 2 systems",
    "- Any unheated rooms (ask assessor to confirm)",
    "- Open chimney without 'up the chimney' photo evidence",
    "- Lightbulb mix: at least one LED, one CFL and one Incandescent example photo if any of those are counted (>=1)",
    "- Roof rooms = yes: confirm Type 1 / Type 2 / detailed method; for Type 1/2 confirm loft access limitation",
    "- No loft access selected without photo proving no hatch",
    "- Flat roof or sloping ceiling marked 'Unknown' (RdSAP convention is As Built)",
    "- Doors — draft-proofing photo if not double-glazed. " +
      "Doors should ONLY be marked 'insulated' when paper evidence (e.g. " +
      "manufacturer spec, build date) supports it. Do NOT flag a non-insulated " +
      "but draught-proofed door as missing insulation — that's expected. Only " +
      "flag if a non-double-glazed door has no draught-proofing photo or other " +
      "evidence.",
    "- Primary heating data source: if photo shows model/serial/GC tag then PCDF should be used; flag if Manual",
    "- Storage / panel heaters may be Manual — that's expected",
    "- Heating controls — confirm photos cover every control selected",
    "- Central heating pump age: " +
      "if NO photo of the pump exists (or no pump is visible), the correct " +
      "value is 'Unknown'. If a pump IS visible in a photo and there is no " +
      "Energy Efficiency Index (EEI) label on it, the correct value is " +
      "pre-2012. If a pump is visible and has an EEI label, the correct " +
      "value is 2013+. " +
      "Do NOT instruct the trainee that 'Unknown is correct when no EEI " +
      "label is confirmed' — Unknown is only correct when there is no pump " +
      "photo at all. If a pump photo is provided but currently recorded as " +
      "Unknown, flag must so the trainee picks pre-2012 or 2013+ based on " +
      "whether an EEI label is visible. " +
      "If the primary heating system is a combi boiler, Central Heating Pump " +
      "Age should be recorded as Unknown.",
    "- Secondary heating verification (refer to https://support.energy-trust.co.uk/article/understanding-secondary-heating)",
    "- Water heating: immersion single vs dual photo evidence. " +
      "If the primary heating system is a combi boiler, the correct RdSAP " +
      "selection is 'Regular' water heating type with source 'From Main " +
      "Heating 1' and No Cylinder. Do NOT phrase it as 'from main heating " +
      "system via the combi option'. If the site notes show a combi boiler " +
      "with a cylinder recorded, flag must.",
    "- Cylinder thermostat photo if 'Yes' selected",
    "- Cylinder insulation thickness measurement photo if cylinder is present",
    "- If the site notes mention a shower (electric / instantaneous mains-pressure / mixer) or any bath, ensure a Shower / Bath photo is filed; flag must when the site notes record a shower or bath but no photo evidence is present.",
    "- Photovoltaics in recommended measures but Addendum 15 not selected",
    "",
    "STUDENT FEEDBACK should be a friendly, plain-English message the trainee can paste:",
    "list each query in a bulleted form, ordered most important first, ending with",
    "a short sign-off like 'Thanks!'.",
    "",
    "Available photo tags in the side panel (count): " + photoSummaryText,
    "Use the EXACT tag names where applicable so the assessor can cross-reference.",
    "",
    "PHOTOS ARE ATTACHED to this conversation as image messages. Each photo",
    "is preceded by a one-line label saying which side-panel tag(s) it lives",
    "under. Use them as primary evidence when assessing each rule:",
    " - If the rule asks for a photo and one of the relevant tag photos clearly",
    "   shows the required item (e.g. cylinder thermostat, drill holes for cavity",
    "   fill, EEI label on a pump), treat the evidence as PRESENT — do not flag.",
    " - If the photos are missing or unclear, flag with severity must.",
    " - If the rule cannot be assessed from the photos but the site notes",
    "   answer it adequately, flag as info.",
    " - Cross-check the photos against the claims in the site notes — if the",
    "   site notes say one thing but a photo shows another, flag as must with",
    "   a clear note of the discrepancy.",
  ].join("\n");

  const resp = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": settings.claudeApiKey,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      // Practical assessments are pure text comparison — Haiku is much
      // faster and cheaper, and accurate enough for the structured diff.
      model: getCurrentPractical()
        ? "claude-haiku-4-5-20251001"
        : settings.claudeModel || "claude-sonnet-4-6",
      max_tokens: 8000,
      system: SYSTEM,
      messages: [
        {
          role: "user",
          content: await buildSiteNotesUserContent({
            text,
            previousExtracted,
            previousFeedback,
          }),
        },
      ],
    }),
  });
  if (!resp.ok) {
    const errText = await resp.text();
    const err = new Error(`HTTP ${resp.status}: ${errText.slice(0, 300)}`);
    err.status = resp.status;
    throw err;
  }
  const data = await resp.json();
  const out = data?.content?.[0]?.text || "";
  console.debug("[EPC] site notes raw response length", out.length);
  let parsed;
  try {
    parsed = tryParseLooseJson(out);
  } catch (err) {
    console.error("[EPC] site notes JSON parse failed", err, out);
    throw err;
  }
  if (data?.stop_reason === "max_tokens") {
    console.warn(
      "[EPC] Claude hit max_tokens — response may be truncated; bump in code if this happens often"
    );
  }
  // Normalise checklist items so each has an id.
  const knownTags = new Set(
    getBucket().categories.map((c) => c.title.toLowerCase())
  );
  parsed.checklist = (parsed.checklist || []).map((it, i) => ({
    id:
      it.id ||
      String(it.label || `item-${i}`)
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "")
        .slice(0, 80),
    label: it.label || "",
    severity: ["must", "should", "info"].includes(it.severity)
      ? it.severity
      : "info",
    evidenceTags: Array.isArray(it.evidenceTags)
      ? it.evidenceTags.filter((t) => knownTags.has(String(t).toLowerCase()))
      : [],
  }));
  return parsed;
}

loadSettings().then(load);
