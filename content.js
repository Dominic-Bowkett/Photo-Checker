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
    // Walk text nodes only — reading textContent on every element is O(N×D)
    // and was the main cost when scanning large marking pages.
    const tw = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let n;
    while ((n = tw.nextNode())) {
      const parent = n.parentNode;
      if (!parent) continue;
      const tag = parent.tagName;
      if (tag === "SCRIPT" || tag === "STYLE") continue;
      const t = lower(n.data || "");
      if (t.includes(target)) return parent;
    }
    return null;
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
    const pushImg = (img, section = "") => {
      if (!isLikelyPhoto(img)) return;
      const url = resolveSrc(img);
      if (!url || seen.has(url)) return;
      seen.add(url);
      photos.push({
        url,
        alt: img.alt || "",
        section,
        width: img.naturalWidth || 0,
        height: img.naturalHeight || 0,
        pageUrl: location.href,
        pageTitle: document.title,
      });
    };

    // Preferred: bound the search by the two text markers on the new layout.
    //   start: "Please upload your photographic evidence below."
    //   end:   "2. Written Site Notes" (the * is dropped — match the heading
    //          text loosely to handle "Written Site Notes" alone too).
    const startAnchor = findInnermostByText(
      "Please upload your photographic evidence below"
    );
    const endAnchor =
      findInnermostByText("2. Written Site Notes") ||
      findInnermostByText("Written Site Notes");

    if (startAnchor && endAnchor) {
      const walker = document.createTreeWalker(
        document.body,
        NodeFilter.SHOW_ELEMENT
      );
      let node;
      while ((node = walker.nextNode())) {
        // Stop once we reach (or step into) the end heading.
        if (node === endAnchor || endAnchor.contains(node)) break;
        const pos = startAnchor.compareDocumentPosition(node);
        if (!(pos & Node.DOCUMENT_POSITION_FOLLOWING)) continue;
        if (node.tagName !== "IMG") continue;
        pushImg(node);
      }
      return { photos, anchor: true };
    }

    // Fallback: original behaviour for legacy pages — anchor on the question
    // heading and use the enclosing container.
    const anchor =
      startAnchor ||
      findInnermostByText("1. Photographic Evidence") ||
      findInnermostByText("Photographic Evidence");
    if (!anchor) return { photos, anchor: false };

    const scope = climbToContainer(anchor);
    if (!scope) return { photos, anchor: true };

    const imgs = scope.querySelectorAll("img");
    for (const img of imgs) pushImg(img, nearestLabel(img, scope));
    return { photos, anchor: true };
  };

  const getAssessmentContext = () => {
    // ---- New layout ----
    const titleEl = document.querySelector(".text-truncate.d-block");
    if (titleEl) {
      const title = norm(titleEl.textContent || "");
      let studentName = "";

      // Find every "Attempt N" element (the same string can appear multiple
      // times in the new layout — once in a compact summary and once in the
      // detailed row). For each, walk forward through siblings, skipping
      // separators (|), status badges, and merged textContent blocks. The
      // first one that yields a clean name wins.
      const candidates = document.querySelectorAll("div, span, a");
      const isAttempt = (s) => /^Attempt\s+\d+$/i.test(s);
      // A real name should be letters / spaces / apostrophes / hyphens / dots
      // only — Unicode-aware so accented characters work. Length-bounded so
      // we never grab a row that combines status + attempt + name into one
      // textContent.
      const looksLikeName = (s) => {
        if (!s) return false;
        if (s.length < 2 || s.length > 80) return false;
        if (/Attempt/i.test(s)) return false;
        if (/Submitted|Released|Draft|Marked|Pending/i.test(s)) return false;
        return /^[\p{L}][\p{L} .'\-]+$/u.test(s);
      };

      outer: for (const el of candidates) {
        if (!isAttempt(norm(el.textContent))) continue;
        // Walk siblings of this element first.
        let next = el.nextElementSibling;
        while (next) {
          const nt = norm(next.textContent);
          if (looksLikeName(nt)) {
            studentName = nt;
            break outer;
          }
          next = next.nextElementSibling;
        }
        // Climb one level and try the parent's siblings as a fallback.
        let parentNext = el.parentElement?.nextElementSibling;
        while (parentNext) {
          const nt = norm(parentNext.textContent);
          if (looksLikeName(nt)) {
            studentName = nt;
            break outer;
          }
          parentNext = parentNext.nextElementSibling;
        }
      }

      if (title || studentName) {
        return {
          studentName,
          title,
          pageUrl: location.href,
          pageTitle: document.title,
        };
      }
    }

    // ---- Old layout fallback ----
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

  // The new AssessApp header is rendered by client-side JS, so the heading
  // may not be in the DOM the moment we're asked. Poll briefly until either
  // a result is found or the window expires.
  const getAssessmentContextAsync = (timeoutMs = 2500, intervalMs = 150) =>
    new Promise((resolve) => {
      const start = Date.now();
      const tick = () => {
        const ctx = getAssessmentContext();
        if (ctx && (ctx.studentName || ctx.title)) {
          resolve(ctx);
          return;
        }
        // Fast-path for pages that have no heading shell at all and never
        // will — give up after a short window so we don't block the side
        // panel on every non-assessment tab.
        const looksLikeAssessmentShell =
          !!document.querySelector(".text-truncate.d-block") ||
          !!document.querySelector(".page-heading");
        if (!looksLikeAssessmentShell && Date.now() - start >= 600) {
          resolve(null);
          return;
        }
        if (Date.now() - start >= timeoutMs) {
          resolve(ctx); // may be null
          return;
        }
        setTimeout(tick, intervalMs);
      };
      tick();
    });

  // Click the "Continue / Next section" button on the active page. Used by
  // the side panel's Next button so the assessor can advance through marking
  // sections without leaving the panel. Heuristic match on the button text
  // so it works across slightly different labels, but strict enough to avoid
  // clicking nearby controls like "Mark outcome".
  const NEXT_BUTTON_RE =
    /^(continue(\s+to(\s+the)?\s+next(\s+(section|page))?)?|next(\s+(section|page))?|save\s*(&|and)\s*(continue|next)|save\s+and\s+next)$/i;
  const clickNextSectionOnce = () => {
    const candidates = Array.from(
      document.querySelectorAll(
        'button, a, [role="button"], input[type="submit"], input[type="button"]'
      )
    );
    const matches = [];
    for (const el of candidates) {
      if (el.disabled) continue;
      if (el.getAttribute("aria-disabled") === "true") continue;
      const text = norm(el.textContent || el.value || "");
      if (!text) continue;
      if (!NEXT_BUTTON_RE.test(text)) continue;
      const rect = el.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) continue;
      const style = window.getComputedStyle(el);
      if (style.visibility === "hidden" || style.display === "none") continue;
      matches.push({ el, text, top: rect.top + window.scrollY });
    }
    if (!matches.length) {
      return { ok: false, reason: "no Continue / Next button found on the page" };
    }
    matches.sort((a, b) => b.top - a.top);
    const target = matches[0];
    try {
      target.el.scrollIntoView({ block: "center", behavior: "instant" });
    } catch (_) {
      target.el.scrollIntoView();
    }
    target.el.click();
    return { ok: true, text: target.text };
  };

  // The marking app renders sections in JS, so the continuation button can
  // appear a moment after the page does. Poll briefly so the assessor
  // doesn't have to time their click.
  const clickNextSection = async (timeoutMs = 3000, intervalMs = 150) => {
    const start = Date.now();
    let last = clickNextSectionOnce();
    while (!last.ok && Date.now() - start < timeoutMs) {
      await new Promise((r) => setTimeout(r, intervalMs));
      last = clickNextSectionOnce();
    }
    return last;
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
      getAssessmentContextAsync()
        .then((ctx) => sendResponse(ctx))
        .catch(() => sendResponse(null));
      return true; // async response
    }
    if (msg?.type === "clickNextSection") {
      clickNextSection()
        .then(sendResponse)
        .catch((err) =>
          sendResponse({ ok: false, reason: String(err?.message || err) })
        );
      return true; // async response
    }
  });
})();
