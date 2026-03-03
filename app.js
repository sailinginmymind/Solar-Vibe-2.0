/**
 * APP.JS - Versione Definitiva e Pulita
 */

let state = {
    isWh: false,
    currentSOC: 50,
    battAh: parseFloat(localStorage.getItem('vibe_batt_ah')) || 100,
    panelWp: parseFloat(localStorage.getItem('vibe_panel_wp')) || 100,
    weatherData: null
};

window.onload = () => {
    initEventListeners();
    loadSavedData();
    setupStars();
    // Primo avvio automatico
    document.getElementById('btn-gps').click();
};

function initEventListeners() {
    const displayVal = document.getElementById('w_out');
    if (displayVal) {
        displayVal.addEventListener('click', () => {
            state.isWh = !state.isWh;
            updateAll();
        });
    }

    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', () => switchView(item.dataset.view, item));
    });

    document.getElementById('btn-gps').addEventListener('click', handleGpsSync);

    ['input-time', 'input-date', 'input-lat', 'input-lng'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('change', updateAll);
    });

    const socSlider = document.getElementById('soc-slider');
    if (socSlider) {
        socSlider.addEventListener('input', (e) => {
            state.currentSOC = e.target.value;
            document.getElementById('soc-val').innerText = state.currentSOC + "%";
            updateAll();
        });
    }

    document.getElementById('btn-save-name').addEventListener('click', saveGarageName);
    document.getElementById('edit-batt-btn').addEventListener('click', () => editSpec('batt'));
    document.getElementById('edit-pan-btn').addEventListener('click', () => editSpec('pan'));
}

async function handleGpsSync() {
    const btn = document.getElementById('btn-gps');
    btn.innerText = "SINCRO IN CORSO...";
    try {
        const coords = await WeatherAPI.getUserLocation();
        const now = new Date();
        document.getElementById('input-lat').value = coords.latitude.toFixed(4);
        document.getElementById('input-lng').value = coords.longitude.toFixed(4);
        document.getElementById('input-date').value = now.toISOString().split('T')[0];
        document.getElementById('input-time').value = now.getHours().toString().padStart(2,'0') + ":" + now.getMinutes().toString().padStart(2,'0');
        await updateAll();
        btn.innerText = "✅ SINCRO COMPLETATA";
    } catch (err) {
        btn.innerText = "❌ ERRORE GPS";
    } finally {
        setTimeout(() => { btn.innerText = "📡 AGGIORNA GPS E ORA ATTUALE"; }, 3000);
    }
}

async function updateAll() {
    const lat = document.getElementById('input-lat').value;
    const lng = document.getElementById('input-lng').value;
    const date = document.getElementById('input-date').value;
    const time = document.getElementById('input-time').value;
    const displayVal = document.getElementById('w_out');
    const displayLabel = document.getElementById('unit-label');

    if (!lat || !lng || !displayVal) return;

    displayVal.style.color = state.isWh ? "#fbbf24" : "#38bdf8";
    if (displayLabel) displayLabel.innerText = state.isWh ? "Clicca per i Watt" : "Clicca per i Wattora";

    try {
        state.weatherData = await WeatherAPI.fetchForecast(lat, lng, date);
        if (!state.weatherData) return;

        const hourIdx = parseInt(time.split(':')[0]);
        const hDec = SolarEngine.timeToDecimal(time);
        const hourly = state.weatherData.hourly;
        const daily = state.weatherData.daily;

        const sunrise = daily.sunrise[0].split('T')[1].substring(0, 5);
        const sunset = daily.sunset[0].split('T')[1].substring(0, 5);
        document.getElementById('sunrise-txt').innerText = sunrise;
        document.getElementById('sunset-txt').innerText = sunset;
        document.getElementById('display-hour-center').innerText = time;

        document.getElementById('r-cloud-percent').innerText = hourly.cloud_cover[hourIdx] + "%";
        document.getElementById('r-temp').innerText = Math.round(hourly.temperature_2m[hourIdx]) + "°";
        document.getElementById('r-hum').innerText = hourly.relative_humidity_2m[hourIdx] + "%";
        document.getElementById('r-wind').innerText = Math.round(hourly.wind_speed_10m[hourIdx]) + " km/h";

        const sunH = SolarEngine.timeToDecimal(sunrise);
        const setH = SolarEngine.timeToDecimal(sunset);
        const power = SolarEngine.calculatePower(hDec, sunH, setH, state.panelWp, hourly.cloud_cover[hourIdx]);
        
        displayVal.innerText = Math.round(state.isWh ? power * 0.9 : power) + (state.isWh ? " Wh" : " W");

        updateReportUI(power, sunH, setH);
    } catch (e) { console.error("Errore updateAll:", e); }
}

function updateReportUI(currentPower, sunH, setH) {
    const chart = document.getElementById('hourly-chart');
    const detailBox = document.getElementById('detail-display');
    const totalDisplay = document.getElementById('total-wh-day');
    
    if (!chart || !state.weatherData) return;

    document.getElementById('charge_80_txt').innerText = SolarEngine.estimateChargeTime(state.currentSOC, 80, currentPower, state.battAh);
    document.getElementById('charge_90_txt').innerText = SolarEngine.estimateChargeTime(state.currentSOC, 90, currentPower, state.battAh);
    document.getElementById('charge_100_txt').innerText = SolarEngine.estimateChargeTime(state.currentSOC, 100, currentPower, state.battAh);

    chart.innerHTML = "";
    let dailyTotal = 0;
    const startHour = Math.floor(sunH);
    const endHour = Math.ceil(setH);

    for (let h = startHour; h <= endHour; h++) {
        const cloud = state.weatherData.hourly.cloud_cover[h] || 0;
        const hP = SolarEngine.calculatePower(h, sunH, setH, state.panelWp, cloud);
        dailyTotal += hP;

        const bar = document.createElement('div');
        bar.className = 'bar';
        bar.style.height = Math.max(5, (hP / state.panelWp * 100)) + "%";

        const showDetail = () => {
            document.querySelectorAll('.bar').forEach(b => b.classList.remove('active'));
            bar.classList.add('active');
            if (detailBox) {
                detailBox.innerHTML = `ORE ${h}:00 <span style="margin:0 10px; opacity:0.5;">→</span> <span style="color:#fff">${Math.round(hP)} W</span>`;
            }
        };

        bar.addEventListener('mouseenter', showDetail);
        bar.addEventListener('click', showDetail);
        chart.appendChild(bar);
    }
    if (totalDisplay) totalDisplay.innerText = Math.round(dailyTotal);
}

function switchView(vId, el) {
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
    const target = document.getElementById('view-' + vId);
    if (target) target.classList.add('active');
    if (el) el.classList.add('active');
}

function editSpec(type) {
    let v = prompt(type === 'batt' ? "Ah Batteria:" : "Watt Pannelli (Wp):");
    if (v && !isNaN(v)) {
        if (type === 'batt') {
            state.battAh = parseFloat(v);
            localStorage.setItem('vibe_batt_ah', v);
            document.getElementById('batt_val').innerText = v;
        } else {
            state.panelWp = parseFloat(v);
            localStorage.setItem('vibe_panel_wp', v);
            document.getElementById('panel_val').innerText = v;
        }
        updateAll();
    }
}

function saveGarageName() {
    const val = document.getElementById('camper_name_input').value;
    localStorage.setItem('vibe_camper_name', val);
    document.getElementById('camper-name-display').innerText = (val || "IL MIO VAN").toUpperCase();
}

function loadSavedData() {
    const name = localStorage.getItem('vibe_camper_name') || "";
    document.getElementById('camper_name_input').value = name;
    document.getElementById('camper-name-display').innerText = (name || "IL MIO CAMPER").toUpperCase();
    document.getElementById('batt_val').innerText = state.battAh;
    document.getElementById('panel_val').innerText = state.panelWp;
}

function setupStars() {
    const container = document.getElementById('stars-container');
    if (!container) return;
    container.innerHTML = "";
    for (let i = 0; i < 50; i++) {
        const star = document.createElement('div');
        star.className = 'star';
        star.style.left = Math.random() * 100 + '%';
        star.style.top = Math.random() * 60 + '%';
        star.style.width = star.style.height = Math.random() * 2 + 'px';
        container.appendChild(star);
    }
}
