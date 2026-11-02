(() => {
  'use strict';
  // Count browser startup/installation, never event-page wakes, tabs or popup opens.
  let reported = false;
  function reportStarted() {
    if (reported) return;
    reported = true;
    void browser.runtime.sendNativeMessage('local.reelsblocker', { action: 'analytics_extension_started' }).catch(() => {});
  }
  browser.runtime.onStartup.addListener(reportStarted);
  browser.runtime.onInstalled.addListener(reportStarted);
})();
