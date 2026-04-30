const STORAGE_KEY = "epcPhotoState";
const STORAGE_VERSION = 2;
const PENDING_KEY = "epcPendingMultiTag";

const DEFAULT_CATEGORIES = [
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
  categories: [],
};

const $ = (sel, root = document) => root.querySelector(sel);
const categoriesEl = $("#categories");
const categoryTpl = $("#categoryTemplate");
const photoTpl = $("#photoTemplate");

let suppressNextStorageEvent = false;

async function load() {
  const stored = await chrome.storage.local.get(STORAGE_KEY);
  const existing = stored[STORAGE_KEY];
  if (
    existing?.version === STORAGE_VERSION &&
    Array.isArray(existing.categories) &&
    existing.categories.length
  ) {
    state.categories = existing.categories.map((c) => ({
      ...c,
      guidance:
        c.guidance ??
        DEFAULT_CATEGORIES.find((d) => d.title === c.title)?.guidance ??
        "",
    }));
    state.version = existing.version;
  } else {
    state.categories = DEFAULT_CATEGORIES.map((c) => ({
      id: uid(),
      title: c.title,
      guidance: c.guidance,
      collapsed: true,
      photos: [],
    }));
    state.version = STORAGE_VERSION;
    await save();
  }
  render();
  await checkPendingMultiTag();
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
      if (next?.version === STORAGE_VERSION) {
        state.categories = next.categories || [];
        render();
      }
    }
  }
  if (changes[PENDING_KEY]?.newValue) {
    checkPendingMultiTag();
  }
});

function render() {
  categoriesEl.innerHTML = "";
  for (const cat of state.categories) {
    categoriesEl.appendChild(renderCategory(cat));
  }
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
    state.categories = state.categories.filter((c) => c.id !== cat.id);
    await save();
    render();
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
  state.categories.push({
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
  for (const c of state.categories) c.photos = [];
  await save();
  render();
});

$("#exportAll").addEventListener("click", () => {
  for (const cat of state.categories) {
    for (const photo of cat.photos) downloadPhoto(cat, photo);
  }
});

const detectedEl = $("#detected");
const detectedListEl = $("#detectedList");
const detectedCountEl = $("#detectedCount");
const detectedAssignEl = $("#detectedAssign");
let detected = [];

function rebuildAssignDropdown() {
  detectedAssignEl.innerHTML = "";
  for (const cat of state.categories) {
    const opt = document.createElement("option");
    opt.value = cat.id;
    opt.textContent = cat.title;
    detectedAssignEl.appendChild(opt);
  }
}

function showDetected(photos) {
  detected = photos;
  rebuildAssignDropdown();
  detectedCountEl.textContent = String(photos.length);
  detectedEl.hidden = false;
  detectedEl.classList.toggle("empty", photos.length === 0);
  detectedListEl.innerHTML = "";
  for (const p of photos) {
    const li = document.createElement("li");
    li.draggable = true;
    li.dataset.section = p.section || "";
    li.title = `${p.section || ""}\n${p.url}`;
    const img = document.createElement("img");
    img.src = p.url;
    img.alt = p.alt || "";
    li.appendChild(img);
    li.addEventListener("dragstart", (e) => {
      e.dataTransfer.effectAllowed = "copy";
      e.dataTransfer.setData("text/uri-list", p.url);
      e.dataTransfer.setData("text/plain", p.url);
      e.dataTransfer.setData("application/x-epc-photo", JSON.stringify(p));
    });
    li.addEventListener("dblclick", () => assignDetected([p]));
    detectedListEl.appendChild(li);
  }
}

async function assignDetected(items) {
  const catId = detectedAssignEl.value;
  const cat = state.categories.find((c) => c.id === catId);
  if (!cat) return;
  for (const p of items) {
    const fetched = await fetchAsDataUrl(p.url);
    cat.photos.push({
      id: uid(),
      url: p.url,
      dataUrl: fetched?.dataUrl || p.url,
      pageUrl: p.pageUrl || "",
      pageTitle: p.pageTitle || p.section || "",
      alt: p.alt || "",
      addedAt: Date.now(),
    });
  }
  await save();
  render();
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

$("#detectedAssignAll").addEventListener("click", () => {
  if (!detected.length) return;
  assignDetected(detected);
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
  openMultiTagModal(pending.photo);
}

function openMultiTagModal(photo) {
  multiTagPreview.src = photo.dataUrl || photo.url;
  multiTagOptions.innerHTML = "";
  for (const cat of state.categories) {
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
    const cat = state.categories.find((c) => c.id === catId);
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

load();
