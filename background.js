const STORAGE_KEY = "epcPhotoState";
const STORAGE_VERSION = 4;
const PENDING_KEY = "epcPendingMultiTag";
const DEFAULT_KEY = "default";

const TAGS = [
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
    guidance: "Selections of all roof constructions selected for the building.",
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
      "Any other key feature of the building or limitation whose presence or absence may be reasonably considered likely to affect the SAP rating, or which would be required to support any claim made in the report that could be subsequently queried or be the subject of a complaint",
  },
];

const TAG_ID = (title) =>
  "epc-tag:" +
  title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

const uid = () =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

function assessmentKey(meta) {
  if (!meta) return DEFAULT_KEY;
  const norm = (s) => (s || "").trim().toLowerCase().replace(/\s+/g, " ");
  const studentName = norm(meta.studentName);
  const title = norm(meta.title);
  if (!studentName && !title) return DEFAULT_KEY;
  return `${studentName}|${title}`.slice(0, 200);
}

function seedCategories() {
  return TAGS.map((t) => ({
    id: uid(),
    title: t.title,
    guidance: t.guidance,
    collapsed: true,
    status: null,
    photos: [],
  }));
}

function defaultBucket(meta) {
  return {
    meta: meta || {
      studentName: "",
      title: "Default",
      pageUrl: "",
      pageTitle: "",
    },
    categories: seedCategories(),
    lastSeen: Date.now(),
  };
}

function migrate(existing) {
  if (existing?.version === STORAGE_VERSION && existing.assessments) {
    return existing;
  }
  // v2 / v3 had flat categories. Wrap them into a single Default bucket.
  if (
    Array.isArray(existing?.categories) &&
    existing.categories.length
  ) {
    return {
      version: STORAGE_VERSION,
      currentKey: DEFAULT_KEY,
      assessments: {
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
            guidance: c.guidance || "",
            collapsed: c.collapsed ?? true,
            status: c.status || null,
            photos: c.photos || [],
          })),
          lastSeen: Date.now(),
        },
      },
    };
  }
  return {
    version: STORAGE_VERSION,
    currentKey: DEFAULT_KEY,
    assessments: { [DEFAULT_KEY]: defaultBucket() },
  };
}

function getOrCreateBucket(state, key, meta) {
  if (!state.assessments[key]) {
    state.assessments[key] = defaultBucket(meta);
  } else if (meta) {
    // Refresh meta so it reflects the latest seen page heading.
    state.assessments[key].meta = { ...state.assessments[key].meta, ...meta };
  }
  state.assessments[key].lastSeen = Date.now();
  return state.assessments[key];
}

chrome.runtime.onInstalled.addListener(() => {
  chrome.sidePanel
    .setPanelBehavior({ openPanelOnActionClick: true })
    .catch((err) => console.error("setPanelBehavior failed", err));
  buildContextMenus();
});

chrome.runtime.onStartup.addListener(buildContextMenus);

function buildContextMenus() {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: "epc-root",
      title: "Add to EPC photo evidence",
      contexts: ["image"],
    });
    for (const tag of TAGS) {
      chrome.contextMenus.create({
        id: TAG_ID(tag.title),
        parentId: "epc-root",
        title: tag.title,
        contexts: ["image"],
      });
    }
    chrome.contextMenus.create({
      id: "epc-sep",
      parentId: "epc-root",
      type: "separator",
      contexts: ["image"],
    });
    chrome.contextMenus.create({
      id: "epc-multi",
      parentId: "epc-root",
      title: "Choose multiple tags…",
      contexts: ["image"],
    });
  });
}

async function getContextForTab(tab) {
  if (!tab?.id) return null;
  try {
    return await chrome.tabs.sendMessage(tab.id, {
      type: "getAssessmentContext",
    });
  } catch (_) {
    return null;
  }
}

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  const id = String(info.menuItemId || "");
  if (!id.startsWith("epc-")) return;
  const url = info.srcUrl;
  if (!url) {
    notify("No image URL available for this element.");
    return;
  }

  const meta = await getContextForTab(tab);
  const key = assessmentKey(meta);
  const photo = await buildPhoto(url, tab);

  if (id === "epc-multi") {
    await chrome.storage.local.set({
      [PENDING_KEY]: { photo, ts: Date.now(), assessmentKey: key, meta },
    });
    if (tab?.windowId != null) {
      try {
        await chrome.sidePanel.open({ windowId: tab.windowId });
      } catch (err) {
        console.error("sidePanel.open failed", err);
      }
    }
    return;
  }

  const tag = TAGS.find((t) => TAG_ID(t.title) === id);
  if (!tag) return;
  await addPhotoToTags(photo, [tag.title], key, meta);
});

async function buildPhoto(url, tab) {
  let dataUrl = url;
  try {
    const res = await fetch(url, { credentials: "include" });
    if (res.ok) {
      const blob = await res.blob();
      dataUrl = await blobToDataUrl(blob);
    }
  } catch (_) {
    /* keep remote URL fallback */
  }
  return {
    id: uid(),
    url,
    dataUrl,
    pageUrl: tab?.url || "",
    pageTitle: tab?.title || "",
    alt: "",
    addedAt: Date.now(),
  };
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}

async function addPhotoToTags(photo, tagTitles, key, meta) {
  const stored = await chrome.storage.local.get(STORAGE_KEY);
  const state = migrate(stored[STORAGE_KEY]);
  const bucket = getOrCreateBucket(state, key, meta);
  for (const title of tagTitles) {
    let cat = bucket.categories.find((c) => c.title === title);
    if (!cat) {
      const def = TAGS.find((t) => t.title === title);
      cat = {
        id: uid(),
        title,
        guidance: def?.guidance || "",
        collapsed: true,
        status: null,
        photos: [],
      };
      bucket.categories.push(cat);
    }
    cat.photos.push({ ...photo, id: uid() });
  }
  state.currentKey = key;
  await chrome.storage.local.set({ [STORAGE_KEY]: state });
  notify(`Added to: ${tagTitles.join(", ")}`);
}

function notify(message) {
  console.log("[EPC]", message);
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type === "fetchImage" && typeof msg.url === "string") {
    fetch(msg.url, { credentials: "include", mode: "cors" })
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const blob = await res.blob();
        const dataUrl = await blobToDataUrl(blob);
        sendResponse({ ok: true, dataUrl, mime: blob.type });
      })
      .catch((err) =>
        sendResponse({ ok: false, error: err?.message || String(err) })
      );
    return true;
  }
  if (msg?.type === "fetchUrlBytes" && typeof msg.url === "string") {
    fetch(msg.url, { credentials: "include" })
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const blob = await res.blob();
        const dataUrl = await blobToDataUrl(blob);
        sendResponse({ ok: true, dataUrl, contentType: blob.type });
      })
      .catch((err) =>
        sendResponse({ ok: false, error: err?.message || String(err) })
      );
    return true;
  }
});
