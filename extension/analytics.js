(() => {
  'use strict';
  // The popup only reads/changes the shared preference. It records no events.
  globalThis.AppAnalytics = {
    async init() {
      try { const response = await browser.runtime.sendNativeMessage('local.reelsblocker', { action: 'analytics_get' }); return response.ok && response.enabled === true; }
      catch { return false; }
    },
    async setEnabled(enabled) {
      const response = await browser.runtime.sendNativeMessage('local.reelsblocker', { action: 'analytics_set', enabled: enabled === true });
      if (!response.ok) throw Error('Could not save analytics preference');
      return response.enabled;
    }
  };
})();
