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
let liveStatusEl;
let lastUpdatedEl;
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
let alertBanner = null;
let alertMessage = null;
let closeAlertBtn = null;
let refreshBtn = null;
let currentAlerts = [];
let shakeTimeout = null;
let isShaking = false;

// Chart instances
let distanceChart = null;
let vibrationChart = null;

// Statistics tracking
let distanceHistory = [];
let vibrationHistory = [];
const MAX_HISTORY_SIZE = 100; // Keep last 100 readings for statistics

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
    const levelEl = document.getElementById('vibration-level');
    const statusEl = document.getElementById('vibration-status');
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

    const card = document.getElementById('smoke-card');
    const valEl = document.getElementById('smokeValue');
    const statusEl = document.getElementById('airStatus');
    if (!card || !valEl || !statusEl) return;

    const numeric = Number(smokeVal);
    const isDanger = (airStatus === 'SMOKE DETECTED') || (!isNaN(numeric) && numeric > 600);

    valEl.textContent = smokeVal !== null && smokeVal !== undefined ? smokeVal : '--';
    statusEl.textContent = airStatus;

    const variant = isDanger ? 'danger' : 'safe';
    card.className = SMOKE_CARD_BASE + ' ' + (SMOKE_CARD_VARIANTS[variant] || SMOKE_CARD_VARIANTS.safe);
}

function calculateStats(values) {
    if (!values || values.length === 0) {
        return {
            current: null,
            average: null,
            min: null,
            max: null,
            count: 0
        };
    }

    const validValues = values.filter(v => v !== null && v !== undefined && !isNaN(v)).map(v => parseFloat(v));
    
    if (validValues.length === 0) {
        return {
            current: null,
            average: null,
            min: null,
            max: null,
            count: 0
        };
    }

    const sum = validValues.reduce((a, b) => a + b, 0);
    const avg = sum / validValues.length;
    const min = Math.min(...validValues);
    const max = Math.max(...validValues);

    return {
        current: validValues[validValues.length - 1],
        average: avg,
        min: min,
        max: max,
        count: validValues.length
    };
}

function updateStatistics() {
    // Update Water Distance Statistics
    const distStats = calculateStats(distanceHistory);
    const distCurrentEl = document.getElementById('stat-dist-current');
    const distAvgEl = document.getElementById('stat-dist-avg');
    const distMinEl = document.getElementById('stat-dist-min');
    const distMaxEl = document.getElementById('stat-dist-max');

    if (distCurrentEl) distCurrentEl.textContent = distStats.current !== null ? distStats.current.toFixed(1) + ' cm' : '--';
    if (distAvgEl) distAvgEl.textContent = distStats.average !== null ? distStats.average.toFixed(1) + ' cm' : '--';
    if (distMinEl) distMinEl.textContent = distStats.min !== null ? distStats.min.toFixed(1) + ' cm' : '--';
    if (distMaxEl) distMaxEl.textContent = distStats.max !== null ? distStats.max.toFixed(1) + ' cm' : '--';

    // Update Vibration Level Statistics
    const vibStats = calculateStats(vibrationHistory);
    const vibCurrentEl = document.getElementById('stat-vib-current');
    const vibAvgEl = document.getElementById('stat-vib-avg');
    const vibMinEl = document.getElementById('stat-vib-min');
    const vibMaxEl = document.getElementById('stat-vib-max');

    if (vibCurrentEl) vibCurrentEl.textContent = vibStats.current !== null ? vibStats.current.toFixed(1) : '--';
    if (vibAvgEl) vibAvgEl.textContent = vibStats.average !== null ? vibStats.average.toFixed(2) : '--';
    if (vibMinEl) vibMinEl.textContent = vibStats.min !== null ? vibStats.min.toFixed(2) : '--';
    if (vibMaxEl) vibMaxEl.textContent = vibStats.max !== null ? vibStats.max.toFixed(2) : '--';

    // Update charts
    updateCharts();
}

function showAlert(message, type = 'warning') {
    if (!alertBanner || !alertMessage) return;
    
    // Check if alert already exists
    if (currentAlerts.includes(message)) return;
    
    currentAlerts.push(message);
    alertMessage.textContent = message;
    alertBanner.classList.remove('hidden');
    
    // Auto-hide after 10 seconds
    setTimeout(() => {
        hideAlert();
    }, 10000);
}

function hideAlert() {
    if (!alertBanner) return;
    alertBanner.classList.add('hidden');
    currentAlerts = [];
}

function checkForAlerts(data) {
    const alerts = [];
    
    // Check temperature
    if (data.temperature !== null && data.temperature !== undefined) {
        const temp = parseFloat(data.temperature);
        if (temp >= 35) {
            alerts.push(`⚠️ Critical: Temperature is ${temp.toFixed(1)}°C - Too hot!`);
        } else if (temp <= 5) {
            alerts.push(`⚠️ Warning: Temperature is ${temp.toFixed(1)}°C - Too cold!`);
        }
    }
    
    // Check water distance
    if (data.distance !== null && data.distance !== undefined) {
        const dist = parseFloat(data.distance);
        if (dist <= 1) {
            alerts.push(`🚨 DANGER: Water at ${dist.toFixed(1)}cm - EVACUATE IMMEDIATELY! Flood danger!`);
        } else if (dist <= 2) {
            alerts.push(`⚠️ WARNING: Water at ${dist.toFixed(1)}cm - Water rising, prepare to evacuate!`);
        }
    }
    
    // Check vibration
    const vibValue = data.magnitude || data.vibration || 0;
    if (vibValue !== null && vibValue !== undefined) {
        const mag = parseFloat(vibValue);
        if (mag >= 4.0) {
            alerts.push(`🚨 DANGER: Strong earthquake detected (${mag.toFixed(1)}) - EVACUATE IMMEDIATELY!`);
        } else if (mag >= 2.0) {
            alerts.push(`⚠️ Warning: Minor earthquake detected (${mag.toFixed(1)}) - Seek safe location!`);
        }
    }
    
    // Check smoke
    const smokeVal = pickSmokeValue(data);
    const airStatus = data?.airStatus || 'Normal';
    if (smokeVal !== null && smokeVal !== undefined) {
        const numeric = Number(smokeVal);
        if (airStatus === 'SMOKE DETECTED' || (!isNaN(numeric) && numeric > 600)) {
            alerts.push(`🚨 CRITICAL: Smoke detected! Air quality: ${smokeVal} - Evacuate immediately!`);
        }
    }
    
    // Show most critical alert
    if (alerts.length > 0) {
        showAlert(alerts[0], 'critical');
    } else {
        hideAlert();
    }
}

function updateLiveCards(data) {
    lastLiveData = data;
    setCard('temp', data.temperature, '°C', classifyTemp);
    setCard('hum', data.humidity, '%', classifyHum);
    setCard('dist', data.distance, 'cm', classifyDistance);

    updateSmokeCard(data);
    
    // Check for alerts
    checkForAlerts(data);

    // Track statistics for water distance
    const distance = data.distance;
    if (distance !== null && distance !== undefined && distance !== '') {
        distanceHistory.push(parseFloat(distance));
        if (distanceHistory.length > MAX_HISTORY_SIZE) {
            distanceHistory.shift(); // Remove oldest entry
        }
    }

    const vibValue = data.magnitude || data.vibration || 0;
    
    // Track statistics for vibration level
    if (vibValue !== null && vibValue !== undefined && vibValue !== '') {
        const vibNum = parseFloat(vibValue);
        if (!isNaN(vibNum)) {
            vibrationHistory.push(vibNum);
            if (vibrationHistory.length > MAX_HISTORY_SIZE) {
                vibrationHistory.shift(); // Remove oldest entry
            }
        }
    }
    const vibInfo = classifyVibration(vibValue);
    const mag = parseFloat(vibValue) || 0;
    const isQuakeDetected = vibInfo.cardClass === 'medium' || vibInfo.cardClass === 'high';
    const shouldHold = mag >= 1.7; // Hold for 5 seconds if magnitude >= 1.7

    // If vibration is currently held, don't update it
    if (isVibrationHeld) {
        // Use the held values instead
        if (heldVibrationValue !== null && heldVibrationInfo) {
            const shakeActive = heldVibrationInfo.cardClass === 'high';
            applyVibrationState('vibration-card', heldVibrationInfo, heldVibrationValue, shakeActive);
        }
        // Update statistics even when vibration is held
        updateStatistics();
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
        applyVibrationState('vibration-card', vibInfo, vibValue, shakeNow);

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
            applyVibrationState('vibration-card', currentInfo, currentVib, false);
        }, 5000);

        const alertDurationMs = vibInfo.cardClass === 'high' ? 10000 : 5000;
        vibrationAlertTimeout = setTimeout(function() {
            isVibrationAlertActive = false;
            lastAlertInfo = null;
        }, alertDurationMs);
    } else if (!isVibrationAlertActive) {
        applyVibrationState('vibration-card', vibInfo, vibValue, false);
    } else if (lastAlertInfo) {
        const shakeActive = lastAlertInfo.cardClass === 'high';
        applyVibrationState('vibration-card', lastAlertInfo, vibValue, shakeActive);
    }

    // Update statistics display
    updateStatistics();
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

function initCharts() {
    // Water Distance Chart
    const distCtx = document.getElementById('distanceChart');
    if (distCtx) {
        distanceChart = new Chart(distCtx, {
            type: 'line',
            data: {
                labels: [],
                datasets: [{
                    label: 'Water Distance',
                    data: [],
                    borderColor: 'rgba(96, 165, 250, 1)',
                    backgroundColor: function(context) {
                        const chart = context.chart;
                        const {ctx, chartArea} = chart;
                        if (!chartArea) return null;
                        const gradient = ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
                        gradient.addColorStop(0, 'rgba(96, 165, 250, 0.3)');
                        gradient.addColorStop(1, 'rgba(96, 165, 250, 0.01)');
                        return gradient;
                    },
                    borderWidth: 2,
                    fill: true,
                    tension: 0.4,
                    pointRadius: 0,
                    pointHoverRadius: 5,
                    pointHoverBackgroundColor: 'rgba(96, 165, 250, 1)',
                    pointHoverBorderColor: '#fff',
                    pointHoverBorderWidth: 2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        backgroundColor: 'rgba(15, 36, 56, 0.95)',
                        titleColor: 'rgba(96, 165, 250, 1)',
                        bodyColor: '#e8f0f8',
                        borderColor: 'rgba(96, 165, 250, 0.3)',
                        borderWidth: 1,
                        padding: 12,
                        displayColors: false,
                        callbacks: {
                            label: function(context) {
                                return context.parsed.y.toFixed(1) + ' cm';
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        display: false,
                        grid: { display: false }
                    },
                    y: {
                        border: { display: false },
                        grid: {
                            color: 'rgba(138, 163, 184, 0.1)',
                            drawBorder: false
                        },
                        ticks: {
                            color: 'rgba(138, 163, 184, 0.6)',
                            font: { size: 10 },
                            callback: function(value) {
                                return value.toFixed(0);
                            }
                        }
                    }
                },
                interaction: {
                    intersect: false,
                    mode: 'index'
                }
            }
        });
    }

    // Vibration Level Chart
    const vibCtx = document.getElementById('vibrationChart');
    if (vibCtx) {
        vibrationChart = new Chart(vibCtx, {
            type: 'line',
            data: {
                labels: [],
                datasets: [{
                    label: 'Vibration Level',
                    data: [],
                    borderColor: 'rgba(251, 191, 36, 1)',
                    backgroundColor: function(context) {
                        const chart = context.chart;
                        const {ctx, chartArea} = chart;
                        if (!chartArea) return null;
                        const gradient = ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
                        gradient.addColorStop(0, 'rgba(251, 191, 36, 0.3)');
                        gradient.addColorStop(1, 'rgba(251, 191, 36, 0.01)');
                        return gradient;
                    },
                    borderWidth: 2,
                    fill: true,
                    tension: 0.4,
                    pointRadius: 0,
                    pointHoverRadius: 5,
                    pointHoverBackgroundColor: 'rgba(251, 191, 36, 1)',
                    pointHoverBorderColor: '#fff',
                    pointHoverBorderWidth: 2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        backgroundColor: 'rgba(15, 36, 56, 0.95)',
                        titleColor: 'rgba(251, 191, 36, 1)',
                        bodyColor: '#e8f0f8',
                        borderColor: 'rgba(251, 191, 36, 0.3)',
                        borderWidth: 1,
                        padding: 12,
                        displayColors: false,
                        callbacks: {
                            label: function(context) {
                                return context.parsed.y.toFixed(2);
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        display: false,
                        grid: { display: false }
                    },
                    y: {
                        border: { display: false },
                        grid: {
                            color: 'rgba(138, 163, 184, 0.1)',
                            drawBorder: false
                        },
                        ticks: {
                            color: 'rgba(138, 163, 184, 0.6)',
                            font: { size: 10 },
                            callback: function(value) {
                                return value.toFixed(1);
                            }
                        }
                    }
                },
                interaction: {
                    intersect: false,
                    mode: 'index'
                }
            }
        });
    }
}

function updateCharts() {
    // Update distance chart - show last 50 points
    if (distanceChart && distanceHistory.length > 0) {
        const last50Distance = distanceHistory.slice(-50);
        const distLabels = last50Distance.map((_, i) => i + 1);
        
        distanceChart.data.labels = distLabels;
        distanceChart.data.datasets[0].data = last50Distance;
        distanceChart.update('none');
    }

    // Update vibration chart - show last 50 points
    if (vibrationChart && vibrationHistory.length > 0) {
        const last50Vibration = vibrationHistory.slice(-50);
        const vibLabels = last50Vibration.map((_, i) => i + 1);
        
        vibrationChart.data.labels = vibLabels;
        vibrationChart.data.datasets[0].data = last50Vibration;
        vibrationChart.update('none');
    }
}

function initApp() {
    liveStatusEl = document.getElementById('liveStatus');
    lastUpdatedEl = document.getElementById('lastUpdated');
    alertBanner = document.getElementById('alertBanner');
    alertMessage = document.getElementById('alertMessage');
    closeAlertBtn = document.getElementById('closeAlert');
    refreshBtn = document.getElementById('refreshBtn');
    
    // Setup alert close button
    if (closeAlertBtn) {
        closeAlertBtn.addEventListener('click', hideAlert);
    }
    
    // Setup refresh button
    if (refreshBtn) {
        refreshBtn.addEventListener('click', function() {
            refreshBtn.disabled = true;
            refreshBtn.innerHTML = '<svg class="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path></svg><span>Refreshing...</span>';
            
            // Force update if we have data
            if (lastLiveData) {
                updateLiveCards(lastLiveData);
            }
            
            setTimeout(() => {
                refreshBtn.disabled = false;
                refreshBtn.innerHTML = '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path></svg><span>Refresh</span>';
            }, 1000);
        });
    }
    
    initCharts();
    initFirebase();
}

document.addEventListener('DOMContentLoaded', initApp);
