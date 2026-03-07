/**
 * APP.JS - VERSIONE STABILE RIPRISTINATA
 */
let dataSelezionata = new Date(); 
let isGpsSyncing = false; 

let state = {
    isWh: false,
    currentSOC: 50,
    currentPsSOC: 50, 
    camperName: localStorage.getItem('vibe_camper_name') || "",
    battAh: parseFloat(localStorage.getItem('vibe_batt_ah')) || 0,
    psAh: parseFloat(localStorage.getItem('vibe_ps_ah')) || 0, 
    panelWp: parseFloat(localStorage.getItem('vibe_panel_wp')) || 0,
    panelPsWp: parseFloat(localStorage.getItem('vibe_panel_ps_wp')) || 0, 
    weatherData: null
};

window.onload = () => {
    initEventListeners();
    initSliders(); 
    loadSavedData();
    if (typeof updateConversions === 'function') updateConversions();
    updateAll();
    setupStars();
    generaBottoniGiorni();
    switchView('live', document.querySelector('[data-view="live"]'));

    // Sincronizzazione automatica all'avvio
    const gpsBtn = document.getElementById('btn-gps');
    if (gpsBtn) gpsBtn.click();
};

function initEventListeners() {
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', () => switchView(item.dataset.view, item));
    });
    
    const gpsBtn = document.getElementById('btn-gps');
    if (gpsBtn) gpsBtn.addEventListener('click', handleGpsSync);

    const cityInput = document.getElementById('city-input');
    if (cityInput) {
        cityInput.addEventListener('change', function () {
            const query = this.value.trim();
            if (query.length >= 3) searchCityCoords(query);
        });
    }

    // Input manuali (Ora, Data, Coordinate)
    ['input-time', 'input-date', 'input-lat', 'input-lng'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('change', updateAll);
    });

    const saveNameBtn = document.getElementById('btn-save-name');
    if (saveNameBtn) saveNameBtn.onclick = saveGarageSettings;
}

async function handleGpsSync() {
    isGpsSyncing = true;
    const btn = document.getElementById('btn-gps');
    if (!btn) return;

    btn.disabled = true;
    btn.innerText = "🛰️ RICERCA POSIZIONE...";

    try {
        const coords = await WeatherAPI.getUserLocation();
        const now = new Date();
        
        document.getElementById('input-lat').value = coords.latitude.toFixed(4);
        document.getElementById('input-lng').value = coords.longitude.toFixed(4);
        document.getElementById('input-time').value = now.getHours().toString().padStart(2,'0') + ":" + now.getMinutes().toString().padStart(2,'0');
        
        dataSelezionata = new Date();
        aggiornaTuttaInterfaccia();

        btn.innerText = "✅ SINCRONIZZAZIONE RIUSCITA";
        btn.style.background = "#22c55e"; 
        btn.style.boxShadow = "0 0 20px #22c55e";
        btn.style.borderColor = "#4ade80";

    } catch (err) {
        btn.innerText = "❌ ERRORE GPS";
        btn.style.background = "#ef4444";
        btn.style.boxShadow = "0 0 20px #ef4444";
    } finally {
        btn.disabled = false;
        isGpsSyncing = false;
        setTimeout(() => { 
            btn.innerText = "📡 AGGIORNA GPS E ORA ATTUALE"; 
            btn.style.background = ""; 
            btn.style.boxShadow = ""; 
            btn.style.borderColor = "";
        }, 3000);
    }
}

async function updateAll() {
    const lat = document.getElementById('input-lat').value;
    const lng = document.getElementById('input-lng').value;
    const timeInput = document.getElementById('input-time').value;
    const dateInput = document.getElementById('input-date').value;

    if (dateInput) dataSelezionata = new Date(dateInput);
    const date = dataSelezionata.toISOString().split('T')[0];
    const time = timeInput || "12:00";
    
    const displayVal = document.getElementById('w_out');
    if (!lat || !lng || !displayVal) return;

    try {
        if (isGpsSyncing) await updateCityName(lat, lng); 
        state.weatherData = await WeatherAPI.fetchForecast(lat, lng, date);
        if (!state.weatherData) return;

        const hourIdx = parseInt(time.split(':')[0]);
        const hDec = SolarEngine.timeToDecimal(time);
        const hourly = state.weatherData.hourly;
        const daily = state.weatherData.daily;

        // Badge Meteo
        if (document.getElementById('r-wind')) document.getElementById('r-wind').innerText = Math.round(hourly.wind_speed_10m[hourIdx]) + " km/h";
        if (document.getElementById('r-hum')) document.getElementById('r-hum').innerText = hourly.relative_humidity_2m[hourIdx] + "%";
        if (document.getElementById('r-temp')) document.getElementById('r-temp').innerText = Math.round(hourly.temperature_2m[hourIdx]) + "°C";
        if (document.getElementById('r-cloud-percent')) document.getElementById('r-cloud-percent').innerText = hourly.cloud_cover[hourIdx] + "%";

        const sunrise = daily.sunrise[0].split('T')[1].substring(0, 5);
        const sunset = daily.sunset[0].split('T')[1].substring(0, 5);
        document.getElementById('sunrise-txt').innerText = sunrise;
        document.getElementById('sunset-txt').innerText = sunset;
        document.getElementById('display-hour-center').innerText = time;

        const sunH = SolarEngine.timeToDecimal(sunrise);
        const setH = SolarEngine.timeToDecimal(sunset);

        const pServices = SolarEngine.calculatePower(hDec, sunH, setH, state.panelWp, hourly.cloud_cover[hourIdx]);
        const pPS = SolarEngine.calculatePower(hDec, sunH, setH, state.panelPsWp, hourly.cloud_cover[hourIdx]);
        const totalPower = pServices + pPS;

        displayVal.innerText = Math.round(totalPower) + " W";
        if (document.getElementById('w_services')) document.getElementById('w_services').innerText = Math.round(pServices) + " W";
        if (document.getElementById('w_ps')) document.getElementById('w_ps').innerText = Math.round(pPS) + " W";

        updateSunUI(hDec, sunH, setH);
        updateReportUI(totalPower, sunH, setH);
    } catch (e) { console.error(e); }
}

// --- FUNZIONE EDIT UNIVERSALE ---
function editSpec(type) {
    let current = 0;
    let label = "";
    if (type === 'batt') { current = state.battAh; label = "Capacità Batteria (Ah)"; }
    else if (type === 'ps') { current = state.psAh; label = "Capacità Power Station (Wh)"; }
    else if (type === 'pan') { current = state.panelWp; label = "Potenza Pannelli Camper (W)"; }
    else if (type === 'panPs') { current = state.panelPsWp; label = "Potenza Pannelli PS (W)"; }

    const v = prompt(`Modifica ${label}:`, current);
    if (v !== null && v !== "" && !isNaN(v)) {
        const val = parseFloat(v);
        if (type === 'batt') state.battAh = val;
        else if (type === 'ps') state.psAh = val;
        else if (type === 'pan') state.panelWp = val;
        else if (type === 'panPs') state.panelPsWp = val;
        saveGarageSettings();
        loadSavedData();
        updateConversions();
        updateAll();
    }
}

// --- FUNZIONI DI SUPPORTO ---
function saveGarageSettings() {
    const name = document.getElementById('camper_name_input').value.trim();
    localStorage.setItem('vibe_camper_name', name);
    localStorage.setItem('vibe_batt_ah', state.battAh);
    localStorage.setItem('vibe_panel_wp', state.panelWp);
    localStorage.setItem('vibe_ps_ah', state.psAh);
    localStorage.setItem('vibe_ps_panel_wp', state.panelPsWp);
    const display = document.getElementById('camper-name-display');
    if (display && name !== "") display.innerText = name.toUpperCase();
    updateAll();
}

function loadSavedData() {
    const savedName = localStorage.getItem('vibe_camper_name');
    if (savedName) {
        state.camperName = savedName;
        document.getElementById('camper-name-display').innerText = savedName.toUpperCase();
        document.getElementById('camper_name_input').value = savedName;
    }
    document.getElementById('batt_val').innerText = state.battAh;
    document.getElementById('panel_val').innerText = state.panelWp;
    document.getElementById('ps_val').innerText = state.psAh;
    document.getElementById('panel_ps_val').innerText = state.panelPsWp;
}

function updateConversions() {
    const bAh = state.battAh || 0;
    const pWh = state.psAh || 0;
    if (document.getElementById('batt_conv_val')) document.getElementById('batt_conv_val').innerText = Math.round(bAh * 12.8);
    if (document.getElementById('ps_conv_val')) document.getElementById('ps_conv_val').innerText = Math.round(pWh / 12.8);
}

function updateReportUI(currentPower, sunH, setH) {
    const chart = document.getElementById('hourly-chart');
    const totalDisplay = document.getElementById('total-wh-day');
    if (!chart || !state.weatherData) return;
    
    // Tempi ricarica
    const wattS = parseFloat(document.getElementById('w_services')?.innerText) || 0;
    const wattPS = parseFloat(document.getElementById('w_ps')?.innerText) || 0;
    
    document.getElementById('batt_charge_80_txt').innerText = SolarEngine.estimateChargeTime(state.currentSOC, 80, wattS, state.battAh);
    document.getElementById('batt_charge_100_txt').innerText = SolarEngine.estimateChargeTime(state.currentSOC, 100, wattS, state.battAh);
    document.getElementById('ps_charge_80_txt').innerText = SolarEngine.estimateChargeTime(state.currentPsSOC, 80, wattPS, state.psAh/12.8);
    document.getElementById('ps_charge_100_txt').innerText = SolarEngine.estimateChargeTime(state.currentPsSOC, 100, wattPS, state.psAh/12.8);

    chart.innerHTML = "";
    let dailyTotal = 0;
    for (let h = Math.floor(sunH); h <= Math.ceil(setH); h++) {
        const cloud = state.weatherData.hourly.cloud_cover[h] || 0;
        const hP = SolarEngine.calculatePower(h, sunH, setH, state.panelWp, cloud);
        dailyTotal += hP;
        const bar = document.createElement('div');
        bar.className = 'bar';
        bar.style.height = (hP / (state.panelWp || 1) * 100) + "%";
        chart.appendChild(bar);
    }
    if (totalDisplay) totalDisplay.innerText = Math.round(dailyTotal) + " Wh";
}

function generaBottoniGiorni() {
    const container = document.getElementById('days-selector');
    if (!container) return;
    container.innerHTML = "";
    const oggi = new Date();
    for (let i = 0; i < 7; i++) {
        const d = new Date(oggi);
        d.setDate(oggi.getDate() + i);
        const btn = document.createElement('div');
        btn.className = 'day-btn' + (d.toDateString() === dataSelezionata.toDateString() ? ' active' : '');
        btn.innerHTML = `<span>${d.toLocaleDateString('it-IT', {weekday:'short'}).charAt(0).toUpperCase()}</span><b>${d.getDate()}</b>`;
        btn.onclick = () => { dataSelezionata = new Date(d); generaBottoniGiorni(); aggiornaTuttaInterfaccia(); };
        container.appendChild(btn);
    }
}

function aggiornaTuttaInterfaccia() {
    const inputDate = document.getElementById('input-date');
    if (inputDate) inputDate.value = dataSelezionata.toISOString().split('T')[0];
    updateAll();
}

function switchView(vId, el) {
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
    const target = document.getElementById('view-' + vId);
    if (target) target.classList.add('active');
    if (el) el.classList.add('active');
}

function initSliders() {
    const sliders = [{ id: 'ps-soc-slider', valId: 'ps-soc-val', stateKey: 'currentPsSOC' }, { id: 'soc-slider', valId: 'soc-val', stateKey: 'currentSOC' }];
    sliders.forEach(s => {
        const el = document.getElementById(s.id);
        if (el) {
            el.addEventListener('input', (e) => {
                state[s.stateKey] = e.target.value;
                if (document.getElementById(s.valId)) document.getElementById(s.valId).innerText = e.target.value + "%";
                updateSliderFill(el);
                updateAll();
            });
            updateSliderFill(el);
        }
    });
}
function updateSliderFill(slider) { slider.style.setProperty('--value', slider.value + '%'); }

async function updateCityName(lat, lng) {
    try {
        const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&accept-language=it`);
        const data = await response.json();
        const city = data.address.city || data.address.town || data.address.village || "POSIZIONE GPS";
        document.getElementById('city-input').value = city.toUpperCase();
    } catch (e) { console.error(e); }
}

async function searchCityCoords(cityName) {
    try {
        const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(cityName)}&limit=1`);
        const data = await response.json();
        if (data && data.length > 0) {
            document.getElementById('input-lat').value = parseFloat(data[0].lat).toFixed(4);
            document.getElementById('input-lng').value = parseFloat(data[0].lon).toFixed(4);
            updateAll();
        }
    } catch (e) { console.error(e); }
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

function updateSunUI(hDec, sunH, setH) {
    const sun = document.getElementById('sun-body');
    const sky = document.getElementById('sky-box');
    if (!sun || !sky) return;
    if (hDec < sunH || hDec > setH) {
        sun.style.display = "none";
        sky.style.background = "linear-gradient(to bottom, #0f172a, #1e293b)";
    } else {
        sun.style.display = "block";
        const progress = (hDec - sunH) / (setH - sunH);
        sun.style.left = `${15 + (progress * 70)}%`;
        sun.style.bottom = `${(Math.sin(progress * Math.PI) * 35) + 10}%`;
        sky.style.background = (progress < 0.2 || progress > 0.8) ? "linear-gradient(to bottom, #f59e0b, #7c2d12)" : "linear-gradient(to bottom, #38bdf8, #1d4ed8)";
    }
}
