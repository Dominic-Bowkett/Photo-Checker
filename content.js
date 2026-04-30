(() => {
  if (window.__epcPhotoOrganiserInjected) return;
  window.__epcPhotoOrganiserInjected = true;

  const resolveSrc = (img) => {
    const direct = img.currentSrc || img.src;
    if (direct) return direct;
    const dataSrc =
      img.getAttribute("data-src") || img.getAttribute("data-original");
    return dataSrc || "";
  };

  // URLs we never want to surface from a Scan tab — froala/giphy decoration,
  // the assessapp logo, etc. Tested case-insensitive against the full URL.
  const DENY_PATTERNS = [
    /froala/i,
    /giphy/i,
    /\/assets\/(?:logo|icon|spinner|placeholder)/i,
    /\.svg(?:\?|$)/i,
  ];

  const isDeniedUrl = (url) =>
    !!url && DENY_PATTERNS.some((re) => re.test(url));

  document.addEventListener(
    "dragstart",
    (e) => {
      const target = e.target;
      if (!(target instanceof HTMLImageElement)) return;
      const url = resolveSrc(target);
      if (!url) return;
      try {
        e.dataTransfer.setData("text/uri-list", url);
        e.dataTransfer.setData("text/plain", url);
        e.dataTransfer.setData(
          "application/x-epc-photo",
          JSON.stringify({
            url,
            alt: target.alt || "",
            pageUrl: location.href,
            pageTitle: document.title,
            width: target.naturalWidth,
            height: target.naturalHeight,
          })
        );
        e.dataTransfer.effectAllowed = "copy";
      } catch (_) {
        /* no-op */
      }
    },
    true
  );

  const norm = (s) => (s || "").replace(/\s+/g, " ").trim();
  const lower = (s) => norm(s).toLowerCase();

  const findInnermostByText = (needle, root = document.body) => {
    const target = lower(needle);
    if (!target || !root) return null;
    let best = null;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);
    let el;
    while ((el = walker.nextNode())) {
      if (el.tagName === "SCRIPT" || el.tagName === "STYLE") continue;
      const text = lower(el.textContent);
      if (!text.includes(target)) continue;
      if (!best || best.contains(el)) best = el;
    }
    return best;
  };

  const climbToContainer = (el) => {
    if (!el) return null;
    return (
      el.closest(
        "section, fieldset, .question, [class*='question' i], [class*='evidence' i], .panel, .card, .form-group, form > div"
      ) ||
      el.parentElement ||
      document.body
    );
  };

  const isLikelyPhoto = (img) => {
    const url = resolveSrc(img);
    if (!url) return false;
    if (/^data:image\/svg/i.test(url)) return false;
    if (isDeniedUrl(url)) return false;
    const w = img.naturalWidth || img.width || 0;
    const h = img.naturalHeight || img.height || 0;
    if (w && w < 60) return false;
    if (h && h < 60) return false;
    return true;
  };

  const nearestLabel = (img, scope) => {
    const headings = ["Additional Evidence", "Please upload your photographic"];
    let cursor = img;
    while (cursor && cursor !== scope) {
      let prev = cursor.previousElementSibling;
      while (prev) {
        const text = norm(prev.textContent);
        for (const h of headings) {
          if (text.toLowerCase().includes(h.toLowerCase())) return text.slice(0, 80);
        }
        prev = prev.previousElementSibling;
      }
      cursor = cursor.parentElement;
    }
    return "";
  };

  const findEpcPhotos = () => {
    const photos = [];
    const seen = new Set();

    const anchor =
      findInnermostByText("1. Photographic Evidence") ||
      findInnermostByText("Photographic Evidence");
    if (!anchor) return { photos, anchor: false };

    const scope = climbToContainer(anchor);
    if (!scope) return { photos, anchor: true };

    const imgs = scope.querySelectorAll("img");
    for (const img of imgs) {
      if (!isLikelyPhoto(img)) continue;
      const url = resolveSrc(img);
      if (!url || seen.has(url)) continue;
      seen.add(url);
      photos.push({
        url,
        alt: img.alt || "",
        section: nearestLabel(img, scope),
        width: img.naturalWidth || 0,
        height: img.naturalHeight || 0,
        pageUrl: location.href,
        pageTitle: document.title,
      });
    }

    return { photos, anchor: true };
  };

  // Assessment context: read student name and assessment title from the
  // page heading on assessapp pages.
  // <div class="page-heading">
  //   <h3 class="truncate">Student Name</h3>
  //   <h5 class="hint-text truncate">Assessment Title</h5>
  // </div>
  const getAssessmentContext = () => {
    const heading = document.querySelector(".page-heading");
    if (!heading) return null;
    const studentName = norm(
      heading.querySelector("h3.truncate")?.textContent || ""
    );
    const title = norm(
      heading.querySelector(
        "h5.hint-text.truncate, h5.truncate.hint-text, h5.hint-text, h5.truncate"
      )?.textContent || ""
    );
    if (!studentName && !title) return null;
    return {
      studentName,
      title,
      pageUrl: location.href,
      pageTitle: document.title,
    };
  };

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg?.type === "findEpcPhotos") {
      try {
        sendResponse(findEpcPhotos());
      } catch (err) {
        sendResponse({ photos: [], error: String(err) });
      }
      return false;
    }
    if (msg?.type === "getAssessmentContext") {
      try {
        sendResponse(getAssessmentContext());
      } catch (err) {
        sendResponse(null);
      }
      return false;
    }
  });
})();
