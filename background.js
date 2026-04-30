chrome.runtime.onInstalled.addListener(() => {
  chrome.sidePanel
    .setPanelBehavior({ openPanelOnActionClick: true })
    .catch((err) => console.error("setPanelBehavior failed", err));
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg?.type === "fetchImage" && typeof msg.url === "string") {
    fetch(msg.url, { credentials: "include", mode: "cors" })
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const blob = await res.blob();
        const reader = new FileReader();
        reader.onloadend = () =>
          sendResponse({ ok: true, dataUrl: reader.result, mime: blob.type });
        reader.onerror = () =>
          sendResponse({ ok: false, error: "read failed" });
        reader.readAsDataURL(blob);
      })
      .catch((err) =>
        sendResponse({ ok: false, error: err?.message || String(err) })
      );
    return true;
  }
});
