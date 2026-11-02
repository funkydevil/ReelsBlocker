let extensionEnabled = null;
let openingPreferences = false;
let checkingForCompletion = false;
let step = 1;

function post(message) { webkit.messageHandlers.controller.postMessage(message); }
function feedback(message = '') { document.querySelector('.feedback').textContent = message; }

function replayCheckboxDemo() {
    const demo = document.querySelector('.checkbox-demo');
    demo.dataset.demo = 'settled';
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    // Start the loop from the beginning when entering the checkbox step.
    void demo.offsetWidth;
    demo.dataset.demo = 'playing';
    updateDemoControl(false);
}

function updateDemoControl(paused) {
    const button = document.querySelector('.replay-demo');
    button.textContent = paused ? 'Продолжить' : 'Пауза';
    button.setAttribute('aria-label', paused ? 'Продолжить показ установки галочки' : 'Приостановить показ установки галочки');
}

function setStep(next) {
    step = next;
    document.body.dataset.step = String(step);
    document.querySelectorAll('.screen').forEach((screen, index) => { screen.hidden = index + 1 !== step; });
    document.querySelector('.back').hidden = step === 1;
    const count = document.querySelector('.step-count');
    count.textContent = `${step} / 4`;
    count.setAttribute('aria-label', `Шаг ${step} из 4`);
    feedback();
    document.querySelector(`#step-${step} h1`).focus();
    if (step === 3) replayCheckboxDemo();
    else document.querySelector('.checkbox-demo').dataset.demo = 'settled';
    post(`setup-step-${step}`);
}

function show(enabled) {
    extensionEnabled = typeof enabled === 'boolean' ? enabled : null;
    if (!checkingForCompletion) return;
    checkingForCompletion = false;
    const button = document.querySelector('.check-state');
    button.disabled = false;
    button.textContent = 'Чек на месте. Давай дальше';
    if (extensionEnabled === true) setStep(4);
    else feedback(extensionEnabled === false ? 'Галочки пока нет. Включи расширение в Safari.' : 'Не удалось проверить галочку. Попробуй ещё раз.');
}

function setOpeningPreferences(opening) {
    openingPreferences = opening;
    const button = document.querySelector('.open-preferences');
    button.disabled = opening;
    button.textContent = opening ? 'Открываю Safari…' : 'Открыть настройки';
    if (opening) feedback();
}

function finishOpeningPreferences(message, failed) {
    setOpeningPreferences(false);
    if (step !== 2) return;
    if (failed) feedback(message);
    else setStep(3);
}
function showWebsiteError(message) { feedback(message); }

document.querySelector('.start').addEventListener('click', () => setStep(2));
document.querySelector('.back').addEventListener('click', () => {
    if (openingPreferences || checkingForCompletion) return;
    setStep(Math.max(1, step - 1));
});
document.querySelector('.open-preferences').addEventListener('click', () => {
    if (openingPreferences) return;
    setOpeningPreferences(true);
    post('open-preferences');
});
document.querySelector('.check-state').addEventListener('click', event => {
    if (checkingForCompletion) return;
    checkingForCompletion = true;
    event.currentTarget.disabled = true;
    event.currentTarget.textContent = 'Проверяю…';
    feedback();
    post('check-state');
});
document.querySelectorAll('[data-site]').forEach(button => {
    button.addEventListener('click', () => {
        if (extensionEnabled !== true) return;
        feedback();
        post(`open-${button.dataset.site}`);
    });
});

document.querySelector('.finish').addEventListener('click', () => {
    if (step === 4) post('close-setup');
});

document.querySelector('.replay-demo').addEventListener('click', () => {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    const demo = document.querySelector('.checkbox-demo');
    const paused = demo.dataset.demo === 'playing';
    demo.dataset.demo = paused ? 'paused' : 'playing';
    updateDemoControl(paused);
});
