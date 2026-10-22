/* ========================================================================
   Study Timer — babi's study nook
   Pomodoro-style focus timer with persistence, sound, notifications.
   ======================================================================== */

/* ---------- State ---------- */
const STATE = {
    mode: 'focus',
    isRunning: false,
    isPaused: false,
    timeLeft: 25 * 60,
    duration: 25 * 60,
    endTime: null,
    timerId: null,
    focusSessionsCompleted: 0,
    totalFocusMinutes: 0,
    breaksTaken: 0,
    settings: {
        focusDuration: 25,
        shortBreakDuration: 5,
        longBreakDuration: 15,
        soundEnabled: true,
        notificationsEnabled: false
    },
    encouragements: [
        "Small steps still move you forward.",
        "It's okay to take your time, babi.",
        "One more page, one more step.",
        "Rest when you need to. Your well-being matters, too.",
        "You are capable of learning difficult things.",
        "You don't have to be perfect. Just keep trying.",
        "One page at a time, babi.",
        "Your effort today matters.",
        "Don't forget to drink some water!",
        "You're doing better than you think."
    ]
};

const MODE_CONFIG = {
    focus: {
        label: 'Focus',
        message: 'Time to focus, babi! ✨',
        settingKey: 'focusDuration',
        type: 'focus'
    },
    short: {
        label: 'Short Break',
        message: 'Take a little breather. You deserve it! 🌷',
        settingKey: 'shortBreakDuration',
        type: 'break'
    },
    long: {
        label: 'Long Break',
        message: 'Rest your mind and recharge. 💛',
        settingKey: 'longBreakDuration',
        type: 'break'
    }
};

const POMODORO_SEQUENCE = ['focus', 'short', 'focus', 'short', 'focus', 'short', 'focus', 'long'];

/* ---------- DOM refs ---------- */
const modeBtns = document.querySelectorAll('.mode-btn');
const timerTime = document.getElementById('timerTime');
const modeMessage = document.getElementById('modeMessage');
const startBtn = document.getElementById('startBtn');
const resetBtn = document.getElementById('resetBtn');
const skipBtn = document.getElementById('skipBtn');
const sessionCounter = document.getElementById('sessionCounter');
const encouragement = document.getElementById('encouragement');
const progressFill = document.querySelector('.progress-fill');

const settingsToggle = document.getElementById('settingsToggle');
const settingsPanel = document.getElementById('settingsPanel');
const focusDurationInput = document.getElementById('focusDuration');
const shortBreakInput = document.getElementById('shortBreakDuration');
const longBreakInput = document.getElementById('longBreakDuration');
const soundToggle = document.getElementById('soundToggle');
const notificationToggle = document.getElementById('notificationToggle');
const saveSettingsBtn = document.getElementById('saveSettingsBtn');
const restoreDefaultsBtn = document.getElementById('restoreDefaultsBtn');

const controlsToggle = document.getElementById('controlsToggle');
const controlsBar = document.getElementById('controlsBar');

const journeyFocusTime = document.getElementById('journeyFocusTime');
const journeySessions = document.getElementById('journeySessions');
const journeyBreaks = document.getElementById('journeyBreaks');

/* ---------- Persistence ---------- */
function loadState() {
    try {
        const raw = localStorage.getItem('babisTimer');
        if (raw) {
            const parsed = JSON.parse(raw);
            STATE.focusSessionsCompleted = typeof parsed.focusSessionsCompleted === 'number'
                ? parsed.focusSessionsCompleted : 0;
            STATE.totalFocusMinutes = typeof parsed.totalFocusMinutes === 'number'
                ? parsed.totalFocusMinutes : 0;
            STATE.breaksTaken = typeof parsed.breaksTaken === 'number'
                ? parsed.breaksTaken : 0;
            if (parsed.settings && typeof parsed.settings === 'object') {
                STATE.settings = { ...STATE.settings, ...parsed.settings };
            }
            // Restore active timer runtime state if present
            STATE.mode = parsed.mode || STATE.mode;
            STATE.timeLeft = typeof parsed.timeLeft === 'number' ? parsed.timeLeft : STATE.timeLeft;
            STATE.duration = typeof parsed.duration === 'number' ? parsed.duration : STATE.duration;
            STATE.endTime = parsed.endTime || null;
            STATE.isRunning = !!parsed.isRunning;
            STATE.isPaused = !!parsed.isPaused;
        }
    } catch (e) {
        // ignore corrupted storage
    }
    focusDurationInput.value = STATE.settings.focusDuration;
    shortBreakInput.value = STATE.settings.shortBreakDuration;
    longBreakInput.value = STATE.settings.longBreakDuration;
    soundToggle.checked = !!STATE.settings.soundEnabled;
    notificationToggle.checked = !!STATE.settings.notificationsEnabled;
}

function saveState() {
    try {
        localStorage.setItem('babisTimer', JSON.stringify({
            focusSessionsCompleted: STATE.focusSessionsCompleted,
            totalFocusMinutes: STATE.totalFocusMinutes,
            breaksTaken: STATE.breaksTaken,
            settings: STATE.settings,
            mode: STATE.mode,
            timeLeft: STATE.timeLeft,
            duration: STATE.duration,
            endTime: STATE.endTime,
            isRunning: STATE.isRunning,
            isPaused: STATE.isPaused
        }));
    } catch (e) {
        // ignore
    }
}
/* ---------- Cross-tab sync (floating widget <-> timer page) ---------- */
let remoteSyncing = false;

function syncFromStorage() {
    if (remoteSyncing) return;
    let parsed;
    try {
        parsed = JSON.parse(localStorage.getItem('babisTimer') || 'null');
    } catch (e) {
        return;
    }
    if (!parsed) return;

    remoteSyncing = true;
    try {
        if (STATE.timerId) {
            clearTimeout(STATE.timerId);
            STATE.timerId = null;
        }

        if (typeof parsed.focusSessionsCompleted === 'number') STATE.focusSessionsCompleted = parsed.focusSessionsCompleted;
        if (typeof parsed.totalFocusMinutes === 'number') STATE.totalFocusMinutes = parsed.totalFocusMinutes;
        if (typeof parsed.breaksTaken === 'number') STATE.breaksTaken = parsed.breaksTaken;

        if (parsed.settings && typeof parsed.settings === 'object') {
            STATE.settings = { ...STATE.settings, ...parsed.settings };
            focusDurationInput.value = STATE.settings.focusDuration;
            shortBreakInput.value = STATE.settings.shortBreakDuration;
            longBreakInput.value = STATE.settings.longBreakDuration;
            soundToggle.checked = !!STATE.settings.soundEnabled;
            notificationToggle.checked = !!STATE.settings.notificationsEnabled;
        }

        STATE.mode = parsed.mode || STATE.mode;
        STATE.duration = typeof parsed.duration === 'number' ? parsed.duration : STATE.duration;
        STATE.timeLeft = typeof parsed.timeLeft === 'number' ? parsed.timeLeft : STATE.timeLeft;
        STATE.endTime = parsed.endTime || null;
        STATE.isRunning = !!parsed.isRunning;
        STATE.isPaused = !!parsed.isPaused;

        if (STATE.isRunning && !STATE.isPaused && STATE.endTime) {
            const remaining = Math.max(0, Math.ceil((STATE.endTime - Date.now()) / 1000));
            STATE.timeLeft = remaining;
            if (remaining > 0) {
                tick();
            } else {
                STATE.isRunning = false;
                STATE.isPaused = false;
                STATE.endTime = null;
            }
        }

        modeBtns.forEach(btn => btn.classList.toggle('active', btn.dataset.mode === STATE.mode));
        startBtn.textContent = !STATE.isRunning ? 'Start' : (STATE.isPaused ? 'Resume' : 'Pause');
        startBtn.classList.toggle('primary', STATE.isRunning && !STATE.isPaused);

        updateDisplay();
        updateProgress();
        updateMessage();
        updateJourneyUI();
    } finally {
        remoteSyncing = false;
    }
}

window.addEventListener('storage', (e) => {
    if (e.key === 'babisTimer') syncFromStorage();
});

document.addEventListener('visibilitychange', () => {
    if (!document.hidden) syncFromStorage();
});

function updateJourneyUI() {
    sessionCounter.textContent = `Focus sessions completed: ${STATE.focusSessionsCompleted}`;
    journeySessions.textContent = STATE.focusSessionsCompleted;
    journeyFocusTime.textContent = STATE.totalFocusMinutes;
    journeyBreaks.textContent = STATE.breaksTaken;
}

/* ---------- Timer helpers ---------- */
function getDurationSeconds(mode) {
    return STATE.settings[MODE_CONFIG[mode].settingKey] * 60;
}

function setMode(mode) {
    if (STATE.isRunning) return;
    STATE.mode = mode;
    STATE.timeLeft = getDurationSeconds(mode);
    STATE.duration = STATE.timeLeft;
    STATE.endTime = null;
    modeBtns.forEach(btn => {
        btn.classList.toggle('active', btn.dataset.mode === mode);
    });
    updateDisplay();
    updateMessage();
    updateProgress();
    saveState();
}

function updateDisplay() {
    const m = Math.floor(STATE.timeLeft / 60);
    const s = STATE.timeLeft % 60;
    timerTime.textContent = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    document.title = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')} — Study Timer`;
}

function updateMessage() {
    modeMessage.textContent = MODE_CONFIG[STATE.mode].message;
}

function updateProgress() {
    const circumference = 2 * Math.PI * 110;
    const ratio = STATE.duration > 0 ? STATE.timeLeft / STATE.duration : 1;
    const offset = circumference - ratio * circumference;
    progressFill.style.strokeDasharray = `${circumference} ${circumference}`;
    progressFill.style.strokeDashoffset = offset;
}

/* ---------- Sound (Web Audio API, no external files) ---------- */
function playCompletionSound() {
    if (!STATE.settings.soundEnabled) return;
    try {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (!AudioContext) return;
        const ctx = new AudioContext();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(523, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(1046, ctx.currentTime + 0.5);
        gain.gain.setValueAtTime(0.1, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.5);
    } catch (e) {
        // silent fail
    }
}

/* ---------- Notifications ---------- */
function requestNotificationPermission() {
    if (!STATE.settings.notificationsEnabled) return;
    if (typeof Notification === 'undefined') return;
    if (Notification.permission === 'default') {
        Notification.requestPermission();
    }
}

function showCompletionNotification() {
    if (!STATE.settings.notificationsEnabled) return;
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
    new Notification('Study Timer — babi\'s study nook', {
        body: MODE_CONFIG[STATE.mode].message,
        icon: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="40" fill="%23FFE878" stroke="%23503D35" stroke-width="6"/></svg>',
        tag: 'studytimer-completion'
    });
}

/* ---------- Core timer loop (timestamp-based) ---------- */
function tick() {
    if (!STATE.isRunning || STATE.isPaused) return;
    const remaining = Math.max(0, Math.ceil((STATE.endTime - Date.now()) / 1000));
    if (remaining <= 0) {
        completeSession();
        return;
    }
    STATE.timeLeft = remaining;
    updateDisplay();
    updateProgress();
    STATE.timerId = setTimeout(tick, 1000);
}

function startTimer() {
    if (STATE.isRunning && !STATE.isPaused) return;
    if (STATE.isPaused) {
        resumeTimer();
        return;
    }
    STATE.isRunning = true;
    STATE.isPaused = false;
    STATE.endTime = Date.now() + STATE.timeLeft * 1000;
    startBtn.textContent = 'Pause';
    startBtn.classList.add('primary');
    requestNotificationPermission();
    saveState();
    tick();
}

function pauseTimer() {
    if (!STATE.isRunning || STATE.isPaused) return;
    STATE.timeLeft = Math.max(0, Math.ceil((STATE.endTime - Date.now()) / 1000));
    STATE.isPaused = true;
    STATE.endTime = null;
    if (STATE.timerId) {
        clearTimeout(STATE.timerId);
        STATE.timerId = null;
    }
    startBtn.textContent = 'Resume';
    updateDisplay();
    updateProgress();
    saveState();   // <-- tells the floating widget the timer is paused
}

function resumeTimer() {
    if (!STATE.isRunning || !STATE.isPaused) return;
    STATE.isPaused = false;
    STATE.endTime = Date.now() + STATE.timeLeft * 1000;
    startBtn.textContent = 'Pause';
    startBtn.classList.add('primary');
    saveState();
    tick();
}

function resetTimer() {
    if (STATE.timerId) {
        clearTimeout(STATE.timerId);
        STATE.timerId = null;
    }
    STATE.isRunning = false;
    STATE.isPaused = false;
    STATE.timeLeft = getDurationSeconds(STATE.mode);
    STATE.duration = STATE.timeLeft;
    STATE.endTime = null;
    startBtn.textContent = 'Start';
    startBtn.classList.remove('primary');
    updateDisplay();
    updateProgress();
    saveState();
}

function skipSession() {
    if (STATE.timerId) {
        clearTimeout(STATE.timerId);
        STATE.timerId = null;
    }
    STATE.isRunning = false;
    STATE.isPaused = false;
    STATE.endTime = null;
    startBtn.textContent = 'Start';
    startBtn.classList.remove('primary');
    advanceSequence();
    saveState();
}

function completeSession() {
    if (STATE.timerId) {
        clearTimeout(STATE.timerId);
        STATE.timerId = null;
    }
    STATE.isRunning = false;
    STATE.isPaused = false;
    STATE.endTime = null;
    playCompletionSound();
    showCompletionNotification();
    if (STATE.mode === 'focus') {
        STATE.focusSessionsCompleted += 1;
        STATE.totalFocusMinutes += STATE.settings.focusDuration;
        saveState();
    } else {
        STATE.breaksTaken += 1;
        saveState();
    }
    updateJourneyUI();
    const completionMessages = {
        focus: 'Focus session complete, babi! Great job! ✨',
        short: 'Break time is over. Ready for more? 🌷',
        long: 'Long break complete. Feel refreshed? 💛'
    };
    modeMessage.textContent = completionMessages[STATE.mode];
    rotateEncouragement();
    setTimeout(() => {
        advanceSequence();
    }, 1500);
}

function advanceSequence() {
    const currentIdx = POMODORO_SEQUENCE.indexOf(STATE.mode);
    const nextIdx = (currentIdx + 1) % POMODORO_SEQUENCE.length;
    setMode(POMODORO_SEQUENCE[nextIdx]);
}

function rotateEncouragement() {
    const idx = Math.floor(Math.random() * STATE.encouragements.length);
    encouragement.textContent = STATE.encouragements[idx];
}

/* ---------- Settings ---------- */
function clamp(val, min, max) {
    return Math.min(max, Math.max(min, val));
}

function saveSettings() {
    STATE.settings.focusDuration = clamp(parseInt(focusDurationInput.value, 10) || 25, 1, 60);
    STATE.settings.shortBreakDuration = clamp(parseInt(shortBreakInput.value, 10) || 5, 1, 30);
    STATE.settings.longBreakDuration = clamp(parseInt(longBreakInput.value, 10) || 15, 1, 60);
    STATE.settings.soundEnabled = soundToggle.checked;
    STATE.settings.notificationsEnabled = notificationToggle.checked;
    focusDurationInput.value = STATE.settings.focusDuration;
    shortBreakInput.value = STATE.settings.shortBreakDuration;
    longBreakInput.value = STATE.settings.longBreakDuration;
    saveState();
    if (!STATE.isRunning) {
        STATE.timeLeft = getDurationSeconds(STATE.mode);
        STATE.duration = STATE.timeLeft;
        STATE.endTime = null;
        updateDisplay();
        updateProgress();
    }
}

function restoreDefaults() {
    STATE.settings.focusDuration = 25;
    STATE.settings.shortBreakDuration = 5;
    STATE.settings.longBreakDuration = 15;
    STATE.settings.soundEnabled = true;
    STATE.settings.notificationsEnabled = false;
    focusDurationInput.value = 25;
    shortBreakInput.value = 5;
    longBreakInput.value = 15;
    soundToggle.checked = true;
    notificationToggle.checked = false;
    saveState();
    if (!STATE.isRunning) {
        STATE.timeLeft = getDurationSeconds(STATE.mode);
        STATE.duration = STATE.timeLeft;
        STATE.endTime = null;
        updateDisplay();
        updateProgress();
    }
}

/* ---------- Event listeners ---------- */
modeBtns.forEach(btn => {
    btn.addEventListener('click', () => setMode(btn.dataset.mode));
});
startBtn.addEventListener('click', () => {
    if (STATE.isPaused) {
        resumeTimer();
    } else if (STATE.isRunning) {
        pauseTimer();
    } else {
        startTimer();
    }
});
resetBtn.addEventListener('click', resetTimer);
skipBtn.addEventListener('click', skipSession);
settingsToggle.addEventListener('click', () => {
    settingsPanel.classList.toggle('hidden');
});

controlsToggle.addEventListener('click', () => {
    const isOpen = !controlsBar.classList.contains('hidden');
    if (isOpen) {
        controlsBar.classList.remove('open');
        controlsBar.classList.add('closed');
        setTimeout(() => controlsBar.classList.add('hidden'), 300);
        controlsToggle.textContent = '☰ Controls';
        controlsToggle.setAttribute('aria-expanded', 'false');
    } else {
        controlsBar.classList.remove('hidden');
        controlsBar.classList.remove('closed');
        controlsBar.classList.add('open');
        controlsToggle.textContent = '✕ Hide';
        controlsToggle.setAttribute('aria-expanded', 'true');
    }
});

saveSettingsBtn.addEventListener('click', saveSettings);
restoreDefaultsBtn.addEventListener('click', restoreDefaults);
document.addEventListener('click', (e) => {
    if (!settingsPanel.classList.contains('hidden') &&
        !settingsPanel.contains(e.target) &&
        e.target !== settingsToggle) {
        settingsPanel.classList.add('hidden');
    }
});

/* ---------- Initialize ---------- */
loadState();
rotateEncouragement();
updateJourneyUI();

if (STATE.isRunning) {
    if (STATE.isPaused) {
        // Restore a paused timer — this is the fix that makes the widget's Pause button "stick"
        updateDisplay();
        updateMessage();
        updateProgress();
        modeBtns.forEach(btn => {
            btn.classList.toggle('active', btn.dataset.mode === STATE.mode);
        });
        startBtn.textContent = 'Resume';
        startBtn.classList.remove('primary');
    } else if (STATE.endTime) {
        const remaining = Math.max(0, Math.ceil((STATE.endTime - Date.now()) / 1000));
        if (remaining > 0) {
            STATE.timeLeft = remaining;
            updateDisplay();
            updateMessage();
            updateProgress();
            modeBtns.forEach(btn => {
                btn.classList.toggle('active', btn.dataset.mode === STATE.mode);
            });
            startBtn.textContent = 'Pause';
            startBtn.classList.add('primary');
            tick();
        } else {
            completeSession();
        }
    }
} else {
    setMode('focus');
}