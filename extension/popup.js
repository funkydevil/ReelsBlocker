(() => {
  "use strict";
  const t = (key, fallback) => globalThis.AppI18n?.t(key) || fallback;
  globalThis.AppI18n?.apply();
  const defaults = { blockVideos: true, blockImages: true, blockShorts: true };
  const fields = document.querySelector("fieldset");
  const status = document.getElementById("status");
  const inputs = [...fields.querySelectorAll("input")];
  async function load() {
    try {
      const saved = await browser.storage.local.get(defaults);
      for (const input of inputs) input.checked = typeof saved[input.id] === "boolean" ? saved[input.id] : true;
      fields.disabled = false;
      status.textContent = t("settingsReady", "Changes take effect immediately.");
    } catch {
      status.textContent = t("settingsLoadError", "Could not load settings. Close and reopen this panel.");
    }
  }
  for (const input of inputs) input.addEventListener("change", async () => {
    const value = input.checked;
    fields.disabled = true;
    status.textContent = t("savingSettings", "Saving…");
    try {
      await browser.storage.local.set({ [input.id]: value });
      status.textContent = t("settingsSaved", "Saved. Applied to open Facebook and YouTube tabs.");
    } catch {
      input.checked = !value;
      status.textContent = t("settingsSaveError", "Could not save. Please try again.");
    } finally { fields.disabled = false; }
  });
  load();
})();
