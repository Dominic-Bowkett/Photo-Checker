(() => {
  if (window.__epcPhotoOrganiserInjected) return;
  window.__epcPhotoOrganiserInjected = true;

  const resolveSrc = (img) => {
    const srcset = img.currentSrc || img.src;
    if (srcset) return srcset;
    const dataSrc = img.getAttribute("data-src") || img.getAttribute("data-original");
    return dataSrc || "";
  };

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
})();
