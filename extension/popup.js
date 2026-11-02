(() => {
  "use strict";
  const t = (key, fallback) => globalThis.AppI18n?.t(key) || fallback;
  globalThis.AppI18n?.apply();
  const analytics = globalThis.AppAnalytics;
  const consent = document.querySelector('.analytics-consent');
  const settingsButton = document.querySelector('.open-settings');
  settingsButton?.addEventListener('click', () => {
    const panel = document.getElementById('analytics-settings');
    panel.hidden = !panel.hidden;
    settingsButton.setAttribute('aria-expanded', String(!panel.hidden));
  });
  if (analytics && consent) {
    consent.disabled = true;
    analytics.init('popup').then(enabled => { consent.checked = enabled; consent.disabled = false; void analytics.capture('popup_opened'); });
    consent.addEventListener('change', async () => {
      consent.disabled = true;
      try { await analytics.setEnabled(consent.checked); }
      catch { consent.checked = !consent.checked; status.textContent = t('settingsSaveError', 'Could not save. Please try again.'); }
      finally { consent.disabled = false; }
    });
  }
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
      void analytics?.capture('filter_changed', { filter: input.id, enabled: value });
      status.textContent = t("settingsSaved", "Saved. Applied to open Facebook and YouTube tabs.");
    } catch {
      input.checked = !value;
      status.textContent = t("settingsSaveError", "Could not save. Please try again.");
    } finally { fields.disabled = false; }
  });
  load();
})();
