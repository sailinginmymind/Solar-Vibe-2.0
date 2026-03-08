/**
 * APP.JS - Versione Definitiva Corretta
 */
let chartSelectionTimer;
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
    
    const savedColor = localStorage.getItem('vibe_solar_bg_color');
    if (savedColor) changeBg(savedColor);

    if (typeof updateConversions === 'function') updateConversions();
    
    setupStars();
    generaBottoniGiorni();
    
    switchView('live', document.querySelector('[data-view=\"live\"]'));

    const latVal = document.getElementById('input-lat').value;
    if (!latVal) {
        handleGpsSync(); 
    } else {
        updateAll();
    }
};

function initEventListeners() {
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', () => switchView(item.dataset.view, item));
    });
    
    const gpsBtn = document.getElementById('btn-gps');
    if (gpsBtn) gpsBtn.addEventListener('click', handleGpsSync);

    // FIX: Usiamo 'input' invece di 'change' per aggiornamento istantaneo
    const timeInput = document.getElementById('input-time');
    if (timeInput) {
        timeInput.addEventListener('input', () => updateAll(true)); 
    }

    const dateInput = document.getElementById('input-date');
    if (dateInput) {
        dateInput.addEventListener('input', (e) => {
            if (!e.target.value) return;
            dataSelezionata = new Date(e.target.value);
            aggiornaTuttaInterfaccia(true);
        });
    }

    const cityInput = document.getElementById('city-input');
    if (cityInput) {
        cityInput.addEventListener('change', function () {
            const query = this.value.trim();
            if (query.length >= 3) searchCityCoords(query);
        });
    }

    ['input-lat', 'input-lng'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('change', () => updateAll(false));
    });

    const saveNameBtn = document.getElementById('btn-save-name');
    if (saveNameBtn) saveNameBtn.onclick = saveGarageSettings;
}

async function handleGpsSync() {
    isGpsSyncing = true;
    const btn = document.getElementById('btn-gps');
    const timeInput = document.getElementById('input-time');
    const dateInput = document.getElementById('input-date');
    const latInput = document.getElementById('input-lat');
    const lngInput = document.getElementById('input-lng');

    if (!btn) return;
    btn.disabled = true;
    btn.innerText = "🛰️ RICERCA POSIZIONE...";

    try {
        const coords = await WeatherAPI.getUserLocation();
        const now = new Date();
        
        if (latInput) latInput.value = coords.latitude.toFixed(4);
        if (lngInput) lngInput.value = coords.longitude.toFixed(4);

        const oraStringa = now.getHours().toString().padStart(2,'0') + ":" + now.getMinutes().toString().padStart(2,'0');
        if (timeInput) timeInput.value = oraStringa;

        dataSelezionata = new Date();
        if (dateInput) dateInput.value = dataSelezionata.toISOString().split('T')[0];

        await updateCityName(coords.latitude, coords.longitude);
        
        generaBottoniGiorni();
        updateAll(false); // Falso perché vogliamo che l'API calcoli il fuso locale

        btn.innerText = "✅ SINCRONIZZAZIONE RIUSCITA";
        btn.style.background = "#22c55e"; 
    } catch (err) {
        btn.innerText = "❌ ERRORE GPS";
    } finally {
        btn.disabled = false;
        isGpsSyncing = false;
        setTimeout(() => { 
            btn.innerText = "📡 AGGIORNA GPS E ORA ATTUALE"; 
            btn.style.background = ""; 
        }, 2000);
    }
}

async function updateAll(isManualTime = false) {
    const lat = document.getElementById('input-lat').value;
    const lng = document.getElementById('input-lng').value;
    const timeInput = document.getElementById('input-time');
    const dateInput = document.getElementById('input-date');

    if (!lat || !lng) return;

    if (!timeInput.value) {
        const now = new Date();
        timeInput.value = now.getHours().toString().padStart(2,'0') + ":" + now.getMinutes().toString().padStart(2,'0');
    }

    try {
        const dateStr = dataSelezionata.toISOString().split('T')[0];
        
        // Passiamo il parametro all'API per decidere se aggiornare l'ora dell'input
        state.weatherData = await WeatherAPI.fetchForecast(lat, lng, dateStr, !isManualTime);
        
        if (!state.weatherData) return;

        let time = timeInput.value;
        const [ore, minuti] = time.split(':').map(Number);
        const hourIdx = Math.min(ore, 23); // Sicurezza indice array
        const hDec = ore + (minuti / 60);

        const hourly = state.weatherData.hourly;
        const daily = state.weatherData.daily;

        document.getElementById('r-wind').innerText = Math.round(hourly.wind_speed_10m[hourIdx]) + " km/h";
        document.getElementById('r-hum').innerText = hourly.relative_humidity_2m[hourIdx] + "%";
        document.getElementById('r-temp').innerText = Math.round(hourly.temperature_2m[hourIdx]) + "°C";
        document.getElementById('r-cloud-percent').innerText = hourly.cloud_cover[hourIdx] + "%";

        const sunrise = daily.sunrise[0].split('T')[1].substring(0, 5);
        const sunset = daily.sunset[0].split('T')[1].substring(0, 5);
        document.getElementById('sunrise-txt').innerText = sunrise;
        document.getElementById('sunset-txt').innerText = sunset;
        
        document.getElementById('display-hour-center').innerText = time;

        const sunH = SolarEngine.timeToDecimal(sunrise);
        const setH = SolarEngine.timeToDecimal(sunset);

        const pServ = SolarEngine.calculatePower(hDec, sunH, setH, state.panelWp, hourly.cloud_cover[hourIdx]);
        const pPS = SolarEngine.calculatePower(hDec, sunH, setH, state.panelPsWp, hourly.cloud_cover[hourIdx]);
        
        document.getElementById('w_out').innerText = Math.round(pServ + pPS) + " W";
        if (document.getElementById('w_services')) document.getElementById('w_services').innerText = Math.round(pServ) + " W";
        if (document.getElementById('w_ps')) document.getElementById('w_ps').innerText = Math.round(pPS) + " W";

        updateSunUI(hDec, sunH, setH);
        updateReportUI(pServ + pPS, sunH, setH);

    } catch (e) { console.error(e); }
}

// --- FUNZIONI GARAGE E LOGICA ---
function editSpec(type) {
    let current = 0; let label = "";
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
        saveGarageSettings(); loadSavedData(); updateConversions(); updateAll();
    }
}

function updateConversions() {
    const bAh = parseFloat(document.getElementById('batt_val').innerText) || 0;
    const bConvVal = document.getElementById('batt_conv_val');
    if (bConvVal) bConvVal.innerText = Math.round(bAh * 12.8);
    const pWh = parseFloat(document.getElementById('ps_val').innerText) || 0;
    const pConvVal = document.getElementById('ps_conv_val');
    if (pConvVal) pConvVal.innerText = Math.round(pWh / 12.8);
}

function updateReportUI(totalPower, sunH, setH) {
    const chart = document.getElementById('hourly-chart');
    const totalDisplay = document.getElementById('total-wh-day');
    if (!chart || !state.weatherData) return;

    // 1. Recupero Watt istantanei
    const wServ = parseFloat(document.getElementById('w_services')?.innerText) || 0;
    const wPS = parseFloat(document.getElementById('w_ps')?.innerText) || 0;
    const psAhEquiv = state.psAh / 12.8; 

    const safeSet = (id, val) => {
        const el = document.getElementById(id);
        if (el) el.innerText = val;
    };

    // 2. Aggiornamento tempi di ricarica
    safeSet('batt_charge_80_txt', SolarEngine.estimateChargeTime(state.currentSOC, 80, wServ, state.battAh));
    safeSet('batt_charge_90_txt', SolarEngine.estimateChargeTime(state.currentSOC, 90, wServ, state.battAh));
    safeSet('batt_charge_100_txt', SolarEngine.estimateChargeTime(state.currentSOC, 100, wServ, state.battAh));
    safeSet('ps_charge_80_txt', SolarEngine.estimateChargeTime(state.currentPsSOC, 80, wPS, psAhEquiv));
    safeSet('ps_charge_90_txt', SolarEngine.estimateChargeTime(state.currentPsSOC, 90, wPS, psAhEquiv));
    safeSet('ps_charge_100_txt', SolarEngine.estimateChargeTime(state.currentPsSOC, 100, wPS, psAhEquiv));

    // 3. DISEGNO GRAFICO (Solo ore di luce)
    chart.innerHTML = "";
    let dailyTotal = 0;
    
    // Arrotondiamo l'alba per difetto e il tramonto per eccesso per includere le mezze ore
    const startH = Math.floor(sunH);
    const endH = Math.ceil(setH);

    for (let h = startH; h <= endH; h++) {
        // Calcoliamo la produzione per ogni ora
        const cloud = state.weatherData.hourly.cloud_cover[h] || 0;
        const hP = SolarEngine.calculatePower(h, sunH, setH, state.panelWp + state.panelPsWp, cloud);
        dailyTotal += hP;

        const bar = document.createElement('div');
        bar.className = 'bar';
        
        const maxPotenza = (state.panelWp + state.panelPsWp) || 1;
        bar.style.height = Math.max(5, (hP / maxPotenza * 100)) + "%";
        
        // Evidenzia l'ora selezionata se rientra nel range visualizzato
        const timeInput = document.getElementById('input-time');
        if (timeInput && timeInput.value) {
            const currentH = parseInt(timeInput.value.split(':')[0]);
            if (h === currentH) bar.style.background = "var(--accent, #fbbf24)";
        }

        bar.onclick = () => {
            const detail = document.getElementById('detail-display');
            if (detail) detail.innerHTML = `<span style="color:#fbbf24;">ORE ${h}:00 → ${Math.round(hP)} W</span>`;
        };
        chart.appendChild(bar);
    }

    if (totalDisplay) totalDisplay.innerText = Math.round(dailyTotal) + " Wh";
}function saveGarageSettings() {
    const name = document.getElementById('camper_name_input').value.trim();
    localStorage.setItem('vibe_camper_name', name);
    localStorage.setItem('vibe_batt_ah', state.battAh);
    localStorage.setItem('vibe_panel_wp', state.panelWp);
    localStorage.setItem('vibe_ps_ah', state.psAh);
    localStorage.setItem('vibe_panel_ps_wp', state.panelPsWp);
    const display = document.getElementById('camper-name-display');
    if (display && name) display.innerText = name.toUpperCase();
    const btn = document.getElementById('btn-save-name');
    btn.style.background = "#16a34a";
    setTimeout(() => { btn.style.background = ""; }, 1500);
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
        btn.onclick = () => { dataSelezionata = new Date(d); aggiornaTuttaInterfaccia(); };
        container.appendChild(btn);
    }
}

function aggiornaTuttaInterfaccia(isManual = true) {
    const inputDate = document.getElementById('input-date');
    if (inputDate) inputDate.value = dataSelezionata.toISOString().split('T')[0];
    
    generaBottoniGiorni();
    updateAll(isManual); // Passa il comando a updateAll
}

async function updateCityName(lat, lng) {
    try {
        const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&accept-language=it`);
        const data = await response.json();
        const city = data.address.city || data.address.town || data.address.village || "POSIZIONE";
        document.getElementById('city-input').value = city.toUpperCase();
    } catch (e) { console.error(e); }
}

async function searchCityCoords(cityName) {
    try {
        const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(cityName)}&limit=1`);
        const data = await response.json();
        if (data?.[0]) {
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

function changeBg(color) {
    document.body.classList.remove('tema-verde', 'tema-rosso', 'tema-grigio');
    if (color === '#062c1f') document.body.classList.add('tema-verde');
    else if (color === '#2d0a1a') document.body.classList.add('tema-rosso');
    else if (color === '#1a1a1a') document.body.classList.add('tema-grigio');
    document.body.style.backgroundColor = color;
    localStorage.setItem('vibe_solar_bg_color', color);
}

function switchView(vId, el) {
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
    const target = document.getElementById('view-' + vId);
    if (target) target.classList.add('active');
    if (el) el.classList.add('active');
}

function initSliders() {
    [{ id: 'ps-soc-slider', valId: 'ps-soc-val', stateKey: 'currentPsSOC' }, { id: 'soc-slider', valId: 'soc-val', stateKey: 'currentSOC' }].forEach(s => {
        const el = document.getElementById(s.id);
        if (el) {
            el.addEventListener('input', (e) => {
                state[s.stateKey] = e.target.value;
                document.getElementById(s.valId).innerText = e.target.value + "%";
                el.style.setProperty('--value', e.target.value + '%');
                updateAll();
            });
            el.style.setProperty('--value', el.value + '%');
        }
    });
}
