const STORAGE_KEY = "epcPhotoState";

const DEFAULT_CATEGORIES = [
  "Property exterior – front",
  "Property exterior – rear / sides",
  "Main heating (boiler / heat source)",
  "Heating controls (programmer & thermostat)",
  "Hot water cylinder",
  "Loft / roof insulation",
  "Walls – construction & insulation",
  "Floor construction",
  "Windows (sample)",
  "Lighting (low energy count)",
  "Extensions",
  "Renewables (PV / solar thermal / heat pump)",
  "Meter readings & fuel type",
  "Ventilation",
  "Other / notes",
];

const uid = () =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

const state = {
  categories: [],
};

const $ = (sel, root = document) => root.querySelector(sel);
const categoriesEl = $("#categories");
const categoryTpl = $("#categoryTemplate");
const photoTpl = $("#photoTemplate");

async function load() {
  const stored = await chrome.storage.local.get(STORAGE_KEY);
  if (stored[STORAGE_KEY]?.categories?.length) {
    state.categories = stored[STORAGE_KEY].categories;
  } else {
    state.categories = DEFAULT_CATEGORIES.map((title) => ({
      id: uid(),
      title,
      collapsed: false,
      photos: [],
    }));
    await save();
  }
  render();
}

async function save() {
  await chrome.storage.local.set({ [STORAGE_KEY]: state });
}

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
  const dropzone = $(".dropzone", node);
  const photosEl = $(".photos", node);
  const toggle = $(".toggle", node);

  if (cat.collapsed) {
    dropzone.classList.add("collapsed");
    toggle.textContent = "▸";
  }

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
    dropzone.classList.toggle("collapsed", cat.collapsed);
    toggle.textContent = cat.collapsed ? "▸" : "▾";
    await save();
  });

  $(".remove", node).addEventListener("click", async () => {
    if (!confirm(`Remove category "${cat.title}" and all its photos?`)) return;
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
    for (const item of items) {
      cat.photos.push(item);
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
  const title = prompt("New category name:");
  if (!title) return;
  state.categories.push({
    id: uid(),
    title: title.trim(),
    collapsed: false,
    photos: [],
  });
  await save();
  render();
});

$("#clearAll").addEventListener("click", async () => {
  if (!confirm("Remove ALL photos from every category?")) return;
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
      e.dataTransfer.setData(
        "application/x-epc-photo",
        JSON.stringify(p)
      );
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

load();
