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
    title: "Primary Heating System",
    guidance:
      "Primary heating system(s) (e.g. boiler showing any associated key features such as a condensate pipe or label indicating the boiler model if using PCDF). Include any secondary heating system here as well.",
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
    title: "Electricity Meter",
    guidance:
      "Indicating dual or single tariff. If no access then site notes are vital to indicate the selection of electricity tariff. Only use 'unknown' if there is no access to the meter, no documentary evidence such as a utility bill AND there are no fixed dual electricity appliances in the dwelling. If there is a dual or twin HWC and/or fixed storage heaters it is advised to enter 'unknown' if you cannot access or locate the meter, and allow the software to default.",
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

  // Ensure each bucket has the Floorplan tag (idempotent).
  let mutated = false;
  for (const key of Object.keys(state.assessments)) {
    const b = state.assessments[key];
    if (!b.categories) b.categories = defaultCategories();
    if (!b.categories.some((c) => c.title.toLowerCase() === "floorplan")) {
      const def = DEFAULT_CATEGORIES.find((d) => d.title === "Floorplan");
      b.categories.unshift({
        id: uid(),
        title: "Floorplan",
        guidance: def?.guidance || "",
        collapsed: true,
        status: null,
        photos: [],
      });
      mutated = true;
    }
    // Backfill status field on existing categories.
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
  if (state.currentKey !== key) {
    state.currentKey = key;
  }
  await save();
  render();
}

async function save() {
  suppressNextStorageEvent = true;
  await chrome.storage.local.set({ [STORAGE_KEY]: state });
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
  categoriesEl.innerHTML = "";
  for (const cat of getBucket().categories) {
    categoriesEl.appendChild(renderCategory(cat));
  }
  rebuildTagFilter();
  applyFilters();
  renderFloorplanPinned();
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
  const cat = findFloorplanCategory();
  section.hidden = false;
  if (!cat || !cat.photos.length) {
    img.hidden = true;
    img.removeAttribute("src");
    empty.hidden = false;
    expand.hidden = true;
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
}

function renderCategory(cat) {
  const node = categoryTpl.content.firstElementChild.cloneNode(true);
  node.dataset.id = cat.id;
  const title = $(".title", node);
  title.textContent = cat.title;
  $(".count", node).textContent = String(cat.photos.length);
  const body = $(".category-body", node);
  const dropzone = $(".dropzone", node);
  const photosEl = $(".photos", node);
  const toggle = $(".toggle", node);
  const guidance = $(".guidance", node);

  guidance.textContent = cat.guidance || "";
  if (!cat.guidance) guidance.style.display = "none";

  const setCollapsed = (collapsed) => {
    body.classList.toggle("collapsed", collapsed);
    toggle.textContent = collapsed ? "▸" : "▾";
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

  toggle.addEventListener("click", async () => {
    cat.collapsed = !cat.collapsed;
    setCollapsed(cat.collapsed);
    await save();
  });

  $(".remove", node).addEventListener("click", async () => {
    if (!confirm(`Remove tag "${cat.title}" and all its photos?`)) return;
    getBucket().categories = getBucket().categories.filter((c) => c.id !== cat.id);
    await save();
    render();
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
    $(".count", categoryNode).textContent = String(cat.photos.length);
    for (const item of items) {
      photosEl.appendChild(renderPhoto(cat, item));
    }
  });
}

async function extractDroppedImages(dataTransfer) {
  const out = [];

  for (const file of dataTransfer.files || []) {
    if (file.type.startsWith("image/")) {
      const dataUrl = await fileToDataUrl(file);
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
    out.push({
      id: uid(),
      url: candidate,
      dataUrl: fetched?.dataUrl || candidate,
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

$("#exportAll").addEventListener("click", () => {
  for (const cat of getBucket().categories) {
    for (const photo of cat.photos) downloadPhoto(cat, photo);
  }
});

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
      openLightbox(detected, idx >= 0 ? idx : 0, { taggable: true });
    });
    detectedListEl.appendChild(li);
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
  for (const catId of checked) {
    const cat = getBucket().categories.find((c) => c.id === catId);
    if (!cat) continue;
    cat.photos.push({
      id: uid(),
      url: pendingPhoto.url,
      dataUrl: pendingPhoto.dataUrl || pendingPhoto.url,
      pageUrl: pendingPhoto.pageUrl || "",
      pageTitle: pendingPhoto.pageTitle || "",
      alt: pendingPhoto.alt || "",
      addedAt: Date.now(),
    });
  }
  await save();
  render();
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
let lightboxTaggable = false;

// Map<detectedId, Map<categoryId, photoIdInCategory>>
const detectedTagAssignments = new Map();

function openLightbox(items, index, opts = {}) {
  if (!items?.length) return;
  lightboxItems = items;
  lightboxIndex = Math.max(0, Math.min(index || 0, items.length - 1));
  lightboxTaggable = !!opts.taggable;
  lightboxEl.hidden = false;
  showLightbox();
}

function showLightbox() {
  const item = lightboxItems[lightboxIndex];
  if (!item) return;
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
  if (lightboxTaggable && item.detectedId) {
    renderLightboxPills(item);
    lightboxTagsEl.hidden = false;
  } else {
    lightboxTagsEl.hidden = true;
    lightboxTagsEl.innerHTML = "";
  }
}

function renderLightboxPills(item) {
  lightboxTagsEl.innerHTML = "";
  const assigned =
    detectedTagAssignments.get(item.detectedId) || new Map();
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
}

async function togglePillForItem(item, cat, btn) {
  let assigned = detectedTagAssignments.get(item.detectedId);
  if (!assigned) {
    assigned = new Map();
    detectedTagAssignments.set(item.detectedId, assigned);
  }
  if (assigned.has(cat.id)) {
    const photoId = assigned.get(cat.id);
    cat.photos = cat.photos.filter((p) => p.id !== photoId);
    assigned.delete(cat.id);
    btn.classList.remove("active");
  } else {
    let dataUrl = item.dataUrl;
    if (!dataUrl || dataUrl === item.url) {
      const fetched = await fetchAsDataUrl(item.url);
      dataUrl = fetched?.dataUrl || item.dataUrl || item.url;
    }
    const photo = {
      id: uid(),
      url: item.url,
      dataUrl,
      pageUrl: item.pageUrl || "",
      pageTitle: item.pageTitle || item.section || "",
      alt: item.alt || "",
      addedAt: Date.now(),
    };
    cat.photos.push(photo);
    assigned.set(cat.id, photo.id);
    btn.classList.add("active");
  }
  await save();
  render();
}

function closeLightbox() {
  lightboxEl.hidden = true;
  lightboxImg.removeAttribute("src");
  lightboxItems = [];
  lightboxTaggable = false;
}

function stepLightbox(delta) {
  if (!lightboxItems.length) return;
  lightboxIndex =
    (lightboxIndex + delta + lightboxItems.length) % lightboxItems.length;
  showLightbox();
}

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
importBtn.addEventListener("click", () => importInput.click());
importInput.addEventListener("change", async (e) => {
  const files = [...(e.target.files || [])];
  if (!files.length) return;
  for (const file of files) {
    try {
      const photos = await extractFromFile(file);
      if (photos.length) {
        showDetected([...(detected || []), ...photos]);
      } else {
        alert(`No images found in ${file.name}.`);
      }
    } catch (err) {
      console.error(err);
      alert(`Could not read ${file.name}: ${err?.message || err}`);
    }
  }
  importInput.value = "";
});

$("#importUrlBtn").addEventListener("click", async () => {
  const url = prompt("Paste an image or PDF URL:");
  if (!url) return;
  try {
    const photos = await importFromUrl(url.trim());
    if (photos.length) {
      showDetected([...(detected || []), ...photos]);
    } else {
      alert("No images found at that URL.");
    }
  } catch (err) {
    console.error(err);
    alert(`URL import failed: ${err?.message || err}`);
  }
});

async function importFromUrl(url) {
  if (!/^https?:|^data:/.test(url)) {
    throw new Error("Only http(s) and data URLs are supported.");
  }
  const res = await new Promise((resolve) =>
    chrome.runtime.sendMessage({ type: "fetchUrlBytes", url }, resolve)
  );
  if (!res?.ok) throw new Error(res?.error || "fetch failed");
  const ct = (res.contentType || "").toLowerCase();
  const cleanName =
    decodeURIComponent((url.split("?")[0].split("/").pop() || "remote")).slice(
      0,
      120
    );

  if (ct.startsWith("image/") || /\.(png|jpe?g|gif|webp|bmp)$/i.test(cleanName)) {
    return [
      {
        url,
        dataUrl: res.dataUrl,
        pageTitle: cleanName,
        alt: "",
        section: "URL import",
      },
    ];
  }

  if (ct === "application/pdf" || /\.pdf$/i.test(cleanName)) {
    const bin = atob(res.dataUrl.split(",")[1] || "");
    const data = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) data[i] = bin.charCodeAt(i);
    const file = new File([data], cleanName.endsWith(".pdf") ? cleanName : cleanName + ".pdf", {
      type: "application/pdf",
    });
    return extractFromPdf(file);
  }

  throw new Error(`Unsupported content type: ${ct || "unknown"}`);
}

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

load();
