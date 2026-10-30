function show(enabled) {
    if (typeof enabled === "boolean") {
        document.body.classList.toggle("state-on", enabled);
        document.body.classList.toggle("state-off", !enabled);
    }
}
document.querySelector("button.open-preferences").addEventListener("click", () => {
    webkit.messageHandlers.controller.postMessage("open-preferences");
});
