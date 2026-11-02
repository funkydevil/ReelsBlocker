(() => {
  'use strict';
  // No website injection or network calls here. Native code enforces the event
  // allowlist and one shared opt-out preference for both app and extension.
  let surface = 'setup';
  async function native(message) {
    if (surface === 'popup') return browser.runtime.sendNativeMessage('local.reelsblocker', message);
    globalThis.webkit?.messageHandlers?.analytics?.postMessage(message);
    return { ok: true };
  }
  globalThis.AppAnalytics = {
    async init(value) {
      surface = value === 'popup' ? 'popup' : 'setup';
      if (surface !== 'popup') return true;
      try { const response = await native({ action: 'analytics_get' }); return response.ok && response.enabled === true; }
      catch { return false; }
    },
    async capture(event, properties = {}) {
      try { await native({ action: 'analytics_capture', event, properties }); }
      catch { /* Analytics never interrupts setup or filtering. */ }
    },
    async setEnabled(enabled) {
      if (surface !== 'popup') throw Error('Analytics preference is managed in extension settings');
      const response = await native({ action: 'analytics_set', enabled: enabled === true });
      if (!response.ok) throw Error('Could not save analytics preference');
      return response.enabled;
    }
  };
})();
