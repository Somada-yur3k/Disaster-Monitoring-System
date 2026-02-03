// Tailwind-driven UI helpers
const PILL_BASE = 'inline-flex items-center gap-2 px-3 py-2 rounded-full border text-sm font-semibold tracking-tight';
const PILL_VARIANTS = {
    ok: 'text-teal-100 bg-teal-500/10 border-teal-400/40',
    warn: 'text-amber-200 bg-amber-500/10 border-amber-400/40',
    critical: 'text-rose-200 bg-rose-500/10 border-rose-400/40'
};

const VIBE_STATUS_BASE = 'inline-flex items-center px-3 py-1.5 rounded-full text-xs font-semibold border tracking-tight';
const VIBE_STATUS_VARIANTS = {
    low: 'border-emerald-300/50 bg-emerald-500/10 text-emerald-100',
    medium: 'border-amber-300/60 bg-amber-500/10 text-amber-100',
    high: 'border-rose-300/60 bg-rose-500/15 text-rose-100'
};

const VIBE_CARD_BASE = 'relative overflow-hidden bg-card/80 border border-border rounded-xl p-4 shadow-panel transition-all';
const VIBE_CARD_VARIANTS = {
    low: 'border-b-4 border-emerald-400/80',
    medium: 'border-b-4 border-amber-400/80',
    high: 'border-b-4 border-rose-400/80 bg-rose-950/30'
};

let liveRef;
let historyRef;
let liveStatusEl;
let lastUpdatedEl;
let historyBodyEl;
let vibrationAlertTimeout = null;
let isVibrationAlertActive = false;
let lastAlertInfo = null;
let liveUpdateTimer = null;
let lastLiveData = null;

function pickReading(source, keys, fallback = null) {
    if (!source) return fallback;
    for (let i = 0; i < keys.length; i++) {
        const k = keys[i];
        if (source[k] !== undefined && source[k] !== null && source[k] !== '') {
            return source[k];
        }
    }
    return fallback;
}

function switchTab(tabName, evt) {
    document.querySelectorAll('.tab-content').forEach(tab => tab.classList.add('hidden'));
    const selectedTab = document.getElementById(tabName + '-tab');
    if (selectedTab) selectedTab.classList.remove('hidden');

    const activeClasses = ['bg-accent/15', 'text-accent', 'border-accent'];
    document.querySelectorAll('[data-tab]').forEach(item => {
        item.classList.remove(...activeClasses);
        item.classList.add('border-transparent', 'text-muted');
    });

    const clicked = evt?.currentTarget || evt?.target.closest('[data-tab]');
    if (clicked) {
        clicked.classList.add(...activeClasses);
        clicked.classList.remove('text-muted', 'border-transparent');
    }
}

function classifyTemp(value) {
    if (value === null || value === undefined) return { variant: 'warn', note: 'No reading', label: 'N/A' };
    if (value >= 35) return { variant: 'critical', note: 'Too hot', label: 'Critical' };
    if (value <= 5) return { variant: 'warn', note: 'Too cold', label: 'Low' };
    return { variant: 'ok', note: 'Comfort range', label: 'OK' };
}

function classifyHum(value) {
    if (value === null || value === undefined) return { variant: 'warn', note: 'No reading', label: 'N/A' };
    if (value >= 80) return { variant: 'warn', note: 'High humidity', label: 'High' };
    if (value <= 30) return { variant: 'warn', note: 'Too dry', label: 'Low' };
    return { variant: 'ok', note: 'Stable', label: 'OK' };
}

function classifyDistance(value) {
    if (value === null || value === undefined) return { variant: 'warn', note: 'No reading', label: 'N/A' };
    if (value <= 2) return { variant: 'critical', note: 'Water very close', label: 'Critical' };
    if (value <= 4) return { variant: 'warn', note: 'Watch the level', label: 'Watch' };
    return { variant: 'ok', note: 'Safe distance', label: 'OK' };
}

function classifyVibration(value) {
    if (value === null || value === undefined) return { variant: 'warn', note: 'No reading', label: 'N/A', cardClass: 'low', status: 'Pending' };
    const mag = parseFloat(value);
    if (isNaN(mag)) return { variant: 'warn', note: 'Invalid data', label: 'N/A', cardClass: 'low', status: 'Error' };

    if (mag >= 4.0) {
        return { variant: 'critical', note: 'EVACUATE IMMEDIATELY', label: 'DANGER', cardClass: 'high', status: 'Strong Quake' };
    }
    if (mag >= 2.0) {
        return { variant: 'warn', note: 'Seek safe location', label: 'WARNING', cardClass: 'medium', status: 'Minor Quake' };
    }
    return { variant: 'ok', note: 'Safe conditions', label: 'NORMAL', cardClass: 'low', status: 'Normal' };
}

function formatTs(ts) {
    const date = new Date(ts);
    if (isNaN(date.getTime())) return '--';
    return date.toLocaleString();
}

function setCard(idBase, value, unit, classifier) {
    const valEl = document.getElementById(idBase + 'Value');
    const statusEl = document.getElementById(idBase + 'Status');
    const noteEl = document.getElementById(idBase + 'Note');
    const info = classifier(value);
    const formatted = (value === null || value === undefined || value === '') ? '--' : Number(value).toFixed(1);

    if (valEl) valEl.innerHTML = formatted + '<small class="text-base align-top ml-1 text-white">' + unit + '</small>';
    if (statusEl) {
        const pillCls = PILL_BASE + ' ' + (PILL_VARIANTS[info.variant] || PILL_VARIANTS.warn);
        statusEl.className = pillCls;
        statusEl.textContent = info.label;
    }
    if (noteEl) noteEl.textContent = info.note;
}

function applyVibrationState(cardId, info, vibValue, shouldShake) {
    const card = document.getElementById(cardId);
    const levelEl = document.getElementById(cardId === 'vibration-card' ? 'vibration-level' : 'vibration-level2');
    const statusEl = document.getElementById(cardId === 'vibration-card' ? 'vibration-status' : 'vibration-status2');
    if (!card || !levelEl || !statusEl) return;

    levelEl.textContent = (vibValue !== null && vibValue !== undefined) ? parseFloat(vibValue).toFixed(1) : '0.0';
    const variant = info.cardClass || 'low';
    const cardCls = VIBE_CARD_BASE + ' ' + (VIBE_CARD_VARIANTS[variant] || VIBE_CARD_VARIANTS.low);
    card.className = cardCls;
    statusEl.className = VIBE_STATUS_BASE + ' ' + (VIBE_STATUS_VARIANTS[variant] || VIBE_STATUS_VARIANTS.low);
    statusEl.textContent = info.status;
}

function updateLiveCards(data) {
    lastLiveData = data;
    const temperature = pickReading(data, ['temperature', 'temp', 'Temperature']);
    const humidity = pickReading(data, ['humidity', 'hum', 'Humidity']);
    const distance = pickReading(data, ['distance', 'dist', 'Distance']);

    setCard('temp', temperature, '°C', classifyTemp);
    setCard('hum', humidity, '%', classifyHum);
    setCard('dist', distance, 'cm', classifyDistance);

    setCard('temp2', temperature, '°C', classifyTemp);
    setCard('hum2', humidity, '%', classifyHum);
    setCard('dist2', distance, 'cm', classifyDistance);

    const vibValue = pickReading(data, ['magnitude', 'vibration', 'vib', 'Vibration'], 0);
    const vibInfo = classifyVibration(vibValue);
    const isQuakeDetected = vibInfo.cardClass === 'medium' || vibInfo.cardClass === 'high';

    if (isQuakeDetected) {
        if (vibrationAlertTimeout) clearTimeout(vibrationAlertTimeout);

        isVibrationAlertActive = true;
        lastAlertInfo = vibInfo;

        const shakeNow = vibInfo.cardClass === 'high';
        applyVibrationState('vibration-card', vibInfo, vibValue, shakeNow);
        applyVibrationState('vibration-card2', vibInfo, vibValue, shakeNow);

        // Keep shaking longer for strong quakes
        const alertDurationMs = vibInfo.cardClass === 'high' ? 10000 : 5000;
        vibrationAlertTimeout = setTimeout(function() {
            isVibrationAlertActive = false;
            lastAlertInfo = null;

            // Re-evaluate to unstick UI if no new data arrives
            const currentData = lastLiveData || {};
            const currentVib = currentData.magnitude || currentData.vibration || 0;
            const currentInfo = classifyVibration(currentVib);
            applyVibrationState('vibration-card', currentInfo, currentVib, false);
            applyVibrationState('vibration-card2', currentInfo, currentVib, false);
        }, alertDurationMs);
    } else if (!isVibrationAlertActive) {
        applyVibrationState('vibration-card', vibInfo, vibValue, false);
        applyVibrationState('vibration-card2', vibInfo, vibValue, false);
    } else if (lastAlertInfo) {
        const shakeActive = lastAlertInfo.cardClass === 'high';
        applyVibrationState('vibration-card', lastAlertInfo, vibValue, shakeActive);
        applyVibrationState('vibration-card2', lastAlertInfo, vibValue, shakeActive);
    }
}

const historyRows = [];

function renderHistory() {
    if (!historyBodyEl) return;

    if (historyRows.length === 0) {
        historyBodyEl.innerHTML = '<tr><td class="px-4 py-3 text-center text-muted" colspan="4">No history yet</td></tr>';
        return;
    }

    const rows = historyRows
        .slice()
        .sort((a, b) => b.timestamp - a.timestamp)
        .map(entry => {
            return '<tr>' +
                '<td class="px-4 py-3">' + formatTs(entry.timestamp) + '</td>' +
                '<td class="px-4 py-3">' + (entry.temperature !== undefined ? Number(entry.temperature).toFixed(1) : '--') + '</td>' +
                '<td class="px-4 py-3">' + (entry.humidity !== undefined ? Number(entry.humidity).toFixed(1) : '--') + '</td>' +
                '<td class="px-4 py-3">' + (entry.distance !== undefined ? Number(entry.distance).toFixed(1) : '--') + '</td>' +
            '</tr>';
        })
        .join('');

    historyBodyEl.innerHTML = rows;
}

function initFirebase() {
    const firebaseConfig = {
        apiKey: "YOUR_API_KEY",
        authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
        databaseURL: "https://sensordb-450ca-default-rtdb.firebaseio.com/",
        projectId: "YOUR_PROJECT_ID",
        storageBucket: "YOUR_PROJECT_ID.appspot.com",
        messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
        appId: "YOUR_APP_ID"
    };

    firebase.initializeApp(firebaseConfig);
    const db = firebase.database();
    liveRef = db.ref('sensor_data');
    historyRef = db.ref('sensor_history').limitToLast(50);

    liveRef.on('value', function(snapshot) {
        const data = snapshot.val() || {};

        if (liveUpdateTimer) {
            clearTimeout(liveUpdateTimer);
        }

        liveUpdateTimer = setTimeout(function() {
            updateLiveCards(data);
            const ts = data.timestamp || Date.now();
            const stamp = 'Updated ' + formatTs(ts);
            if (lastUpdatedEl) lastUpdatedEl.textContent = stamp;
            const lastUpdated2 = document.getElementById('lastUpdated2');
            if (lastUpdated2) lastUpdated2.textContent = stamp;
            if (liveStatusEl) liveStatusEl.textContent = 'Live from Realtime Database';
        }, 1000);
    }, function(error) {
        if (liveStatusEl) liveStatusEl.textContent = 'Live feed error';
        console.error('Realtime listener error', error);
    });

    historyRef.on('child_added', function(snapshot) {
        const payload = snapshot.val() || {};
        const ts = payload.timestamp || Number(snapshot.key) || Date.now();
        historyRows.push({
            timestamp: ts,
            temperature: pickReading(payload, ['temperature', 'temp', 'Temperature']),
            humidity: pickReading(payload, ['humidity', 'hum', 'Humidity']),
            distance: pickReading(payload, ['distance', 'dist', 'Distance'])
        });
        if (historyRows.length > 50) historyRows.shift();
        renderHistory();
    });
}

function initApp() {
    liveStatusEl = document.getElementById('liveStatus');
    lastUpdatedEl = document.getElementById('lastUpdated');
    historyBodyEl = document.getElementById('historyBody');

    window.switchTab = switchTab;
    initFirebase();
}

document.addEventListener('DOMContentLoaded', initApp);