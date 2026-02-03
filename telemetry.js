// Tailwind-driven UI helpers
const PILL_BASE = 'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-semibold tracking-tight';
const PILL_VARIANTS = {
    ok: 'text-teal-100 bg-teal-500/10 border-teal-400/40',
    warn: 'text-amber-200 bg-amber-500/10 border-amber-400/40',
    critical: 'text-rose-200 bg-rose-500/10 border-rose-400/40'
};

const VIBE_STATUS_BASE = 'inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-semibold border tracking-tight';
const VIBE_STATUS_VARIANTS = {
    low: 'border-emerald-300/50 bg-emerald-500/10 text-emerald-100',
    medium: 'border-amber-300/60 bg-amber-500/10 text-amber-100',
    high: 'border-rose-300/60 bg-rose-500/15 text-rose-100'
};

const VIBE_CARD_BASE = 'group relative overflow-hidden glass-effect border border-border/50 rounded-xl p-5 shadow-card hover:shadow-glow-amber transition-all duration-300 hover:scale-[1.02]';
const VIBE_CARD_VARIANTS = {
    low: 'border-l-4 border-emerald-400/60',
    medium: 'border-l-4 border-amber-400/60',
    high: 'border-l-4 border-rose-400/60'
};

const SMOKE_CARD_BASE = 'group relative overflow-hidden glass-effect border border-border/50 rounded-xl p-5 shadow-card hover:shadow-glow transition-all duration-300 hover:scale-[1.02]';
const SMOKE_CARD_VARIANTS = {
    safe: 'border-l-4 border-emerald-400/60',
    danger: 'border-l-4 border-rose-500/60'
};

let liveRef;
let historyRef;
let liveStatusEl;
let lastUpdatedEl;
let historyBodyEl;
let historyCountEl;
let smokeHistoryBodyEl;
let smokeHistoryCountEl;
let vibrationAlertTimeout = null;
let isVibrationAlertActive = false;
let lastAlertInfo = null;
let liveUpdateTimer = null;
let lastLiveData = null;
let vibrationHoldTimeout = null;
let isVibrationHeld = false;
let heldVibrationValue = null;
let heldVibrationInfo = null;
let vibrationHoldStartTime = null;
let shakeTimeout = null;
let isShaking = false;

// Realtime history tracking - tracks every sensor data change
let sensorHistory = [];
let smokeHistory = []; // Separate history for smoke sensor
let lastSensorData = null;
const MAX_SENSOR_HISTORY = 500; // Keep last 500 records
const MAX_SMOKE_HISTORY = 500; // Keep last 500 smoke records

function pickSmokeValue(data) {
    if (!data) return null;
    if (data.smokeValue !== undefined) return data.smokeValue;
    if (data.smoke !== undefined) return data.smoke;
    if (data.gas !== undefined) return data.gas;
    return null;
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
    if (value <= 1) return { variant: 'critical', note: 'EVACUATE - Flood danger!', label: 'DANGER' };
    if (value <= 2) return { variant: 'warn', note: 'Warning - Water rising', label: 'WARNING' };
    if (value <= 4) return { variant: 'ok', note: 'Normal water level', label: 'NORMAL' };
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

function formatTsShort(ts) {
    const date = new Date(ts);
    if (isNaN(date.getTime())) return '--';
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    const seconds = date.getSeconds().toString().padStart(2, '0');
    return `${hours}:${minutes}:${seconds}`;
}

function setCard(idBase, value, unit, classifier) {
    const valEl = document.getElementById(idBase + 'Value2');
    const statusEl = document.getElementById(idBase + 'Status2');
    const noteEl = document.getElementById(idBase + 'Note2');
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
    const levelEl = document.getElementById('vibration-level2');
    const statusEl = document.getElementById('vibration-status2');
    if (!card || !levelEl || !statusEl) return;

    levelEl.textContent = (vibValue !== null && vibValue !== undefined) ? parseFloat(vibValue).toFixed(1) : '0.0';
    const variant = info.cardClass || 'low';
    const cardCls = VIBE_CARD_BASE + ' ' + (VIBE_CARD_VARIANTS[variant] || VIBE_CARD_VARIANTS.low);
    
    // Add shake animation if any magnitude is detected (above 0.1) for 10 seconds
    const mag = parseFloat(vibValue) || 0;
    
    if (mag > 0.1) {
        if (!isShaking) {
            // Start shaking for the first time
            isShaking = true;
            card.className = cardCls + ' animate-shake';
            
            // Clear any existing shake timeout
            if (shakeTimeout) clearTimeout(shakeTimeout);
            
            // Stop shaking after 10 seconds
            shakeTimeout = setTimeout(() => {
                isShaking = false;
                const currentCard = document.getElementById(cardId);
                if (currentCard) {
                    currentCard.className = cardCls;
                }
            }, 10000);
        } else {
            // Already shaking, keep the shake class
            card.className = cardCls + ' animate-shake';
        }
    } else {
        // No vibration detected
        if (!isShaking) {
            card.className = cardCls;
        } else {
            // Still within 10-second shake period, keep shaking
            card.className = cardCls + ' animate-shake';
        }
    }
    
    statusEl.className = VIBE_STATUS_BASE + ' ' + (VIBE_STATUS_VARIANTS[variant] || VIBE_STATUS_VARIANTS.low);
    statusEl.textContent = info.status;
}

function updateSmokeCard(data) {
    const smokeVal = pickSmokeValue(data);
    const airStatus = data?.airStatus || 'Normal';

    const card = document.getElementById('smoke-card2');
    const valEl = document.getElementById('smokeValue2');
    const statusEl = document.getElementById('airStatus2');
    if (!card || !valEl || !statusEl) return;

    const numeric = Number(smokeVal);
    const isDanger = (airStatus === 'SMOKE DETECTED') || (!isNaN(numeric) && numeric > 600);

    valEl.textContent = smokeVal !== null && smokeVal !== undefined ? smokeVal : '--';
    statusEl.textContent = airStatus;

    const variant = isDanger ? 'danger' : 'safe';
    card.className = SMOKE_CARD_BASE + ' ' + (SMOKE_CARD_VARIANTS[variant] || SMOKE_CARD_VARIANTS.safe);
}

function hasSensorDataChanged(newData, oldData) {
    if (!oldData) return true; // First reading, always record
    
    // Since Firebase only sends updates when data actually changes,
    // we can be more sensitive to changes. Track any numeric change > 0.01
    // or any non-numeric change
    const sensors = ['temperature', 'humidity', 'distance', 'magnitude', 'vibration'];
    
    for (let sensor of sensors) {
        const newVal = newData[sensor];
        const oldVal = oldData[sensor];
        
        // Check if value exists and has changed
        if (newVal !== undefined && newVal !== null && newVal !== '') {
            if (oldVal === undefined || oldVal === null || oldVal === '') {
                return true; // New sensor reading
            }
            
            // For numeric values, check if there's any change (more than 0.01 difference for precision)
            const newNum = parseFloat(newVal);
            const oldNum = parseFloat(oldVal);
            
            if (!isNaN(newNum) && !isNaN(oldNum)) {
                if (Math.abs(newNum - oldNum) > 0.01) {
                    return true; // Change detected
                }
            } else if (String(newVal) !== String(oldVal)) {
                return true; // Non-numeric value changed
            }
        } else if (oldVal !== undefined && oldVal !== null && oldVal !== '') {
            // Value was removed
            return true;
        }
    }
    
    // Also check timestamp - if timestamp changed significantly, it's a new reading
    const newTs = newData.timestamp || 0;
    const oldTs = oldData.timestamp || 0;
    if (Math.abs(newTs - oldTs) > 1000) { // More than 1 second difference
        return true;
    }
    
    return false; // No changes detected
}

function hasSmokeDataChanged(newData, oldData) {
    if (!oldData) return true; // First reading, always record
    
    const newSmokeVal = pickSmokeValue(newData);
    const oldSmokeVal = pickSmokeValue(oldData);
    const newAirStatus = newData?.airStatus || 'Normal';
    const oldAirStatus = oldData?.airStatus || 'Normal';
    
    // Check if smoke value changed
    if (newSmokeVal !== null && newSmokeVal !== undefined && newSmokeVal !== '') {
        if (oldSmokeVal === null || oldSmokeVal === undefined || oldSmokeVal === '') {
            return true; // New smoke reading
        }
        
        const newNum = parseFloat(newSmokeVal);
        const oldNum = parseFloat(oldSmokeVal);
        
        if (!isNaN(newNum) && !isNaN(oldNum)) {
            if (Math.abs(newNum - oldNum) > 0.01) {
                return true; // Smoke level changed
            }
        } else if (String(newSmokeVal) !== String(oldSmokeVal)) {
            return true; // Non-numeric value changed
        }
    } else if (oldSmokeVal !== null && oldSmokeVal !== undefined && oldSmokeVal !== '') {
        return true; // Smoke value was removed
    }
    
    // Check if air status changed
    if (newAirStatus !== oldAirStatus) {
        return true; // Air status changed
    }
    
    return false; // No smoke-related changes detected
}

function addToHistory(data) {
    const timestamp = data.timestamp || Date.now();
    const vibValue = data.magnitude || data.vibration || 0;
    const vibInfo = classifyVibration(vibValue);
    
    // Add to general sensor history (excluding smoke data)
    const sensorEntry = {
        timestamp: timestamp,
        temperature: data.temperature !== undefined ? parseFloat(data.temperature) : null,
        humidity: data.humidity !== undefined ? parseFloat(data.humidity) : null,
        distance: data.distance !== undefined ? parseFloat(data.distance) : null,
        vibration: vibValue !== null && vibValue !== undefined ? parseFloat(vibValue) : null,
        status: vibInfo.status || 'Normal'
    };
    
    sensorHistory.push(sensorEntry);
    
    // Keep history size manageable
    if (sensorHistory.length > MAX_SENSOR_HISTORY) {
        sensorHistory.shift(); // Remove oldest entry
    }
    
    renderHistory();
}

function addToSmokeHistory(data) {
    const timestamp = data.timestamp || Date.now();
    const smokeVal = pickSmokeValue(data);
    const airStatus = data.airStatus || 'Normal';
    
    // Determine status based on smoke level and air status
    let status = 'Normal';
    let statusClass = 'text-emerald-100 bg-emerald-500/10 border-emerald-400/40';
    
    const numeric = Number(smokeVal);
    const isDanger = (airStatus === 'SMOKE DETECTED') || (!isNaN(numeric) && numeric > 600);
    
    if (isDanger) {
        status = 'DANGER';
        statusClass = 'text-rose-100 bg-rose-500/10 border-rose-400/40';
    } else if (!isNaN(numeric) && numeric > 300) {
        status = 'WARNING';
        statusClass = 'text-amber-100 bg-amber-500/10 border-amber-400/40';
    }
    
    // Add to smoke sensor history
    const smokeEntry = {
        timestamp: timestamp,
        smoke: smokeVal !== null && smokeVal !== undefined ? parseFloat(smokeVal) : null,
        airStatus: airStatus,
        status: status,
        statusClass: statusClass
    };
    
    smokeHistory.push(smokeEntry);
    
    // Keep history size manageable
    if (smokeHistory.length > MAX_SMOKE_HISTORY) {
        smokeHistory.shift(); // Remove oldest entry
    }
    
    renderSmokeHistory();
}

let lastSmokeData = null;

function updateLiveCards(data) {
    lastLiveData = data;
    
    // Check if sensor data has changed and add to history (excluding smoke)
    if (hasSensorDataChanged(data, lastSensorData)) {
        addToHistory(data);
        lastSensorData = JSON.parse(JSON.stringify(data)); // Deep copy for comparison
    }
    
    // Check if smoke data has changed and add to smoke history separately
    if (hasSmokeDataChanged(data, lastSmokeData)) {
        addToSmokeHistory(data);
        lastSmokeData = JSON.parse(JSON.stringify(data)); // Deep copy for comparison
    }
    
    setCard('temp', data.temperature, '°C', classifyTemp);
    setCard('hum', data.humidity, '%', classifyHum);
    setCard('dist', data.distance, 'cm', classifyDistance);

    updateSmokeCard(data);

    const vibValue = data.magnitude || data.vibration || 0;
    const vibInfo = classifyVibration(vibValue);
    const mag = parseFloat(vibValue) || 0;
    const isQuakeDetected = vibInfo.cardClass === 'medium' || vibInfo.cardClass === 'high';
    const shouldHold = mag >= 1.7; // Hold for 5 seconds if magnitude >= 1.7

    // If vibration is currently held, don't update it
    if (isVibrationHeld) {
        // Use the held values instead
        if (heldVibrationValue !== null && heldVibrationInfo) {
            const shakeActive = heldVibrationInfo.cardClass === 'high';
            applyVibrationState('vibration-card2', heldVibrationInfo, heldVibrationValue, shakeActive);
        }
        return; // Skip vibration update during hold period
    }

    if (shouldHold) {
        // Start 5-second hold period
        if (vibrationHoldTimeout) clearTimeout(vibrationHoldTimeout);
        if (vibrationAlertTimeout) clearTimeout(vibrationAlertTimeout);

        isVibrationAlertActive = true;
        lastAlertInfo = vibInfo;
        isVibrationHeld = true;
        heldVibrationValue = vibValue;
        heldVibrationInfo = vibInfo;
        vibrationHoldStartTime = Date.now();

        const shakeNow = vibInfo.cardClass === 'high';
        applyVibrationState('vibration-card2', vibInfo, vibValue, shakeNow);

        // Hold vibration data for 5 seconds
        vibrationHoldTimeout = setTimeout(function() {
            isVibrationHeld = false;
            heldVibrationValue = null;
            heldVibrationInfo = null;
            vibrationHoldStartTime = null;

            // After hold period, update with current data
            const currentData = lastLiveData || {};
            const currentVib = currentData.magnitude || currentData.vibration || 0;
            const currentInfo = classifyVibration(currentVib);
            applyVibrationState('vibration-card2', currentInfo, currentVib, false);
        }, 5000);

        const alertDurationMs = vibInfo.cardClass === 'high' ? 10000 : 5000;
        vibrationAlertTimeout = setTimeout(function() {
            isVibrationAlertActive = false;
            lastAlertInfo = null;
        }, alertDurationMs);
    } else if (!isVibrationAlertActive) {
        applyVibrationState('vibration-card2', vibInfo, vibValue, false);
    } else if (lastAlertInfo) {
        const shakeActive = lastAlertInfo.cardClass === 'high';
        applyVibrationState('vibration-card2', lastAlertInfo, vibValue, shakeActive);
    }
}

function renderHistory() {
    if (!historyBodyEl) return;
    
    if (sensorHistory.length === 0) {
        historyBodyEl.innerHTML = '<tr class="hover:bg-card/30 transition-colors"><td class="px-3 py-2 text-center text-muted/70 font-medium text-xs" colspan="6">Waiting for sensor data…</td></tr>';
        if (historyCountEl) historyCountEl.textContent = '0';
        return;
    }
    
    // Sort by timestamp (newest first)
    const sortedHistory = sensorHistory.slice().sort((a, b) => b.timestamp - a.timestamp);
    
    const rows = sortedHistory.map(entry => {
        const temp = entry.temperature !== null ? Number(entry.temperature).toFixed(1) : '--';
        const hum = entry.humidity !== null ? Number(entry.humidity).toFixed(1) : '--';
        const dist = entry.distance !== null ? Number(entry.distance).toFixed(1) : '--';
        const vib = entry.vibration !== null ? Number(entry.vibration).toFixed(1) : '--';
        
        // Determine status badge color
        let statusClass = 'text-emerald-100 bg-emerald-500/10 border-emerald-400/40';
        let statusText = entry.status || 'Normal';
        if (entry.status === 'Strong Quake' || entry.status === 'DANGER') {
            statusClass = 'text-rose-100 bg-rose-500/10 border-rose-400/40';
            statusText = 'DANGER';
        } else if (entry.status === 'Minor Quake' || entry.status === 'WARNING') {
            statusClass = 'text-amber-100 bg-amber-500/10 border-amber-400/40';
            statusText = 'WARN';
        } else {
            statusText = 'OK';
        }
        
        return '<tr class="hover:bg-card/30 transition-colors">' +
            '<td class="px-3 py-2 font-mono text-[10px]">' + formatTsShort(entry.timestamp) + '</td>' +
            '<td class="px-3 py-2 text-xs">' + temp + '</td>' +
            '<td class="px-3 py-2 text-xs">' + hum + '</td>' +
            '<td class="px-3 py-2 text-xs">' + dist + '</td>' +
            '<td class="px-3 py-2 text-xs">' + vib + '</td>' +
            '<td class="px-3 py-2"><span class="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold border ' + statusClass + '">' + statusText + '</span></td>' +
        '</tr>';
    }).join('');
    
    historyBodyEl.innerHTML = rows;
    
    if (historyCountEl) {
        historyCountEl.textContent = sensorHistory.length;
    }
}

function renderSmokeHistory() {
    if (!smokeHistoryBodyEl) return;
    
    if (smokeHistory.length === 0) {
        smokeHistoryBodyEl.innerHTML = '<tr class="hover:bg-card/30 transition-colors"><td class="px-3 py-2 text-center text-muted/70 font-medium text-xs" colspan="4">Waiting for smoke sensor data…</td></tr>';
        if (smokeHistoryCountEl) smokeHistoryCountEl.textContent = '0';
        return;
    }
    
    // Sort by timestamp (newest first)
    const sortedHistory = smokeHistory.slice().sort((a, b) => b.timestamp - a.timestamp);
    
    const rows = sortedHistory.map(entry => {
        const smoke = entry.smoke !== null ? Number(entry.smoke).toFixed(0) : '--';
        
        // Determine air status color
        let airStatusClass = 'text-emerald-300';
        let airStatusText = entry.airStatus || 'Normal';
        if (entry.airStatus === 'SMOKE DETECTED') {
            airStatusClass = 'text-rose-300 font-semibold';
            airStatusText = 'SMOKE';
        } else if (entry.airStatus && entry.airStatus.includes('WARNING')) {
            airStatusClass = 'text-amber-300';
            airStatusText = 'WARN';
        } else {
            airStatusText = 'OK';
        }
        
        return '<tr class="hover:bg-card/30 transition-colors">' +
            '<td class="px-3 py-2 font-mono text-[10px]">' + formatTsShort(entry.timestamp) + '</td>' +
            '<td class="px-3 py-2 text-xs font-semibold">' + smoke + '</td>' +
            '<td class="px-3 py-2 text-xs"><span class="' + airStatusClass + '">' + airStatusText + '</span></td>' +
            '<td class="px-3 py-2"><span class="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold border ' + (entry.statusClass || 'text-emerald-100 bg-emerald-500/10 border-emerald-400/40') + '">' + (entry.status === 'DANGER' ? 'DANGER' : entry.status === 'WARNING' ? 'WARN' : 'OK') + '</span></td>' +
        '</tr>';
    }).join('');
    
    smokeHistoryBodyEl.innerHTML = rows;
    
    if (smokeHistoryCountEl) {
        smokeHistoryCountEl.textContent = smokeHistory.length;
    }
}

function clearHistory() {
    if (confirm('Are you sure you want to clear the sensor history? This action cannot be undone.')) {
        sensorHistory = [];
        renderHistory();
    }
}

function clearSmokeHistory() {
    if (confirm('Are you sure you want to clear the smoke sensor history? This action cannot be undone.')) {
        smokeHistory = [];
        renderSmokeHistory();
    }
}

// Make functions available globally
window.clearHistory = clearHistory;
window.clearSmokeHistory = clearSmokeHistory;

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
    historyRef = db.ref('sensor_history');

    // Load last 500 history records from Firebase on startup
    historyRef.limitToLast(MAX_SENSOR_HISTORY).once('value', function(snapshot) {
        sensorHistory = [];
        snapshot.forEach(function(childSnapshot) {
            const record = childSnapshot.val();
            if (record) {
                sensorHistory.push(record);
            }
        });
        renderHistory();
        console.log('Loaded ' + sensorHistory.length + ' history records from Firebase');
    }, function(error) {
        console.warn('Failed to load history from Firebase:', error);
    });

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
            if (liveStatusEl) liveStatusEl.textContent = 'Live from Realtime Database';
        }, 1000);
    }, function(error) {
        if (liveStatusEl) liveStatusEl.textContent = 'Live feed error';
        console.error('Realtime listener error', error);
    });
}

function initApp() {
    liveStatusEl = document.getElementById('liveStatus');
    lastUpdatedEl = document.getElementById('lastUpdated2');
    historyBodyEl = document.getElementById('historyBody');
    historyCountEl = document.getElementById('historyCount');
    smokeHistoryBodyEl = document.getElementById('smokeHistoryBody');
    smokeHistoryCountEl = document.getElementById('smokeHistoryCount');
    initFirebase();
    
    // Initialize empty histories
    renderHistory();
    renderSmokeHistory();
}

document.addEventListener('DOMContentLoaded', initApp);
