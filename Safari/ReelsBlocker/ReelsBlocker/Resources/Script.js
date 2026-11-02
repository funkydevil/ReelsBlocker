let extensionEnabled = null;
let guideRequested = false;
let openingPreferences = false;

function setStep(step) {
    const changed = document.body.dataset.step !== String(step);
    document.body.dataset.step = String(step);
    document.querySelectorAll('.screen').forEach((screen, index) => { screen.hidden = index + 1 !== step; });
    document.querySelectorAll('.progress li').forEach((item, index) => {
        if (index + 1 === step) item.setAttribute('aria-current', 'step');
        else item.removeAttribute('aria-current');
        item.classList.toggle('complete', index + 1 < step);
    });
    document.querySelector('details').hidden = step === 3;
    if (changed) document.querySelector(`#step-${step} h1`).focus();
}

function show(enabled) {
    extensionEnabled = typeof enabled === 'boolean' ? enabled : null;
    const waiting = document.querySelector('.waiting');
    waiting.textContent = enabled === false ? 'Not enabled yet. Tick the checkbox in Safari, then come back here.'
        : 'We couldn’t confirm the status. Check Safari, then try again.';
    document.querySelector('.check-state').disabled = false;
    if (extensionEnabled === true && !guideRequested) {
        setStep(3);
        document.querySelector('.feedback').textContent = '';
    } else if (document.body.dataset.step === '3' && extensionEnabled !== true) {
        setStep(2);
    }
}

function setOpeningPreferences(opening) {
    openingPreferences = opening;
    document.querySelectorAll('.open-preferences').forEach(button => {
        button.disabled = opening;
        button.textContent = opening ? 'Opening Safari…' : button.dataset.label;
    });
    document.querySelector('.feedback').textContent = '';
}

function finishOpeningPreferences(message, failed) {
    setOpeningPreferences(false);
    const feedback = document.querySelector('.feedback');
    // Activation can be confirmed while an earlier Settings request is pending.
    // A late navigation error must not undo that verified success.
    if (extensionEnabled === true && !guideRequested) {
        feedback.textContent = '';
        document.querySelector('details').open = false;
        setStep(3);
        return;
    }
    feedback.textContent = failed ? message : '';
    feedback.classList.toggle('error', failed);
    document.querySelector('details').open = failed;
    if (!failed && extensionEnabled === true && !guideRequested) setStep(3);
}

function post(message) { webkit.messageHandlers.controller.postMessage(message); }

function showWebsiteError(message) {
    const feedback = document.querySelector('.feedback');
    feedback.textContent = message;
    feedback.classList.add('error');
}

document.querySelectorAll('.open-preferences').forEach(button => {
    button.dataset.label = button.textContent;
    button.addEventListener('click', () => {
        if (openingPreferences) return;
        guideRequested = false;
        setStep(2);
        document.querySelector('.waiting').textContent = 'Waiting for Safari to confirm it’s enabled…';
        setOpeningPreferences(true);
        post('open-preferences');
    });
});
document.querySelector('.check-state').addEventListener('click', event => {
    guideRequested = false;
    event.currentTarget.disabled = true;
    document.querySelector('.waiting').textContent = 'Checking Safari…';
    post('check-state');
});
document.querySelector('.back').addEventListener('click', () => { guideRequested = true; setStep(1); });
document.querySelector('.view-guide').addEventListener('click', () => { guideRequested = true; setStep(1); });
document.querySelectorAll('[data-site]').forEach(button => {
    button.addEventListener('click', () => {
        if (extensionEnabled !== true) return;
        document.querySelector('.feedback').textContent = '';
        post(`open-${button.dataset.site}`);
    });
});
