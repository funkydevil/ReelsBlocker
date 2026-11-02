function show(enabled) {
    document.body.classList.toggle("state-on", enabled === true);
    document.body.classList.toggle("state-off", enabled === false);
}

function setOpeningPreferences(opening) {
    const button = document.querySelector("button.open-preferences");
    button.disabled = opening;
    button.textContent = opening ? "Opening Safari…" : "Open Safari Extension Settings…";
    document.querySelector(".feedback").textContent = "";
}

function finishOpeningPreferences(message, failed) {
    setOpeningPreferences(false);
    const feedback = document.querySelector(".feedback");
    feedback.textContent = message;
    feedback.classList.toggle("error", failed);
    document.querySelector("details").open = failed;
}

document.querySelector("button.open-preferences").addEventListener("click", () => {
    setOpeningPreferences(true);
    webkit.messageHandlers.controller.postMessage("open-preferences");
});
