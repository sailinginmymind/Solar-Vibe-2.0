/**
 * APP.JS - VERSIONE DEFINITIVA FIX "VIAGGIO NEL TEMPO"
 */
let dataSelezionata = new Date(); 
let isGpsSyncing = false; 

let state = {
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
    
    // Tema salvato
    const savedColor = localStorage.getItem('vibe_solar_bg_color');
    if (savedColor) changeBg(savedColor);

    setupStars();
    generaBottoniGiorni();

    // Impostiamo ora attuale SOLO all'avvio se il campo è vuoto
    const timeInput = document.getElementById('input-time');
    const dateInput = document.getElementById('input-date');
    if (timeInput && !timeInput.value) {
        const ora = new Date();
        timeInput.value = ora.getHours().toString().padStart(2,'0') + ":" + ora.getMinutes().toString().padStart(2,'0');
    }
    if (dateInput && !dateInput.value) {
        dateInput.value = dataSelezionata.toISOString().split('T')[0];
    }

    updateAll();
};

function initEventListeners() {
    // Navigazione
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', () => switchView(item.dataset.view, item));
    });
    
    // GPS (L'unico che può resettare l'ora all'attuale)
    const gpsBtn = document.getElementById('btn-gps');
    if (gpsBtn) gpsBtn.addEventListener('click', handleGpsSync);

    // FIX ORA E DATA: Reagiscono istantaneamente al cambiamento
    const timeInput = document.getElementById('input-time');
    if (timeInput) {
        timeInput.addEventListener('input', () => {
            updateAll(); // Aggiorna mentre cambi
        });
    }

    const dateInput = document.getElementById('input-date');
    if (dateInput) {
        dateInput.addEventListener('change', (e) => {
            dataSelezionata = new Date(e.target.value);
            generaBottoniGiorni();
            updateAll();
        });
    }

    // Ricerca città
    const cityInput = document.getElementById('city-input');
    if (cityInput) {
        cityInput.addEventListener('change', function() {
            if (this.value.length > 2) searchCityCoords(this.value);
        });
    }

    // Coordinate manuali
    ['input-lat', 'input-lng'].forEach(id => {
        document.getElementById(id)?.addEventListener('change', updateAll);
    });

    document.getElementById('btn-save-name').onclick = saveGarageSettings;
}

async function updateAll() {
    const lat = document.getElementById('input-lat').value;
    const lng = document.getElementById('input-lng').value;
    const timeVal = document.getElementById('input-time').value;

    if (!lat || !lng || !timeVal) return;

    try {
        const dateStr = dataSelezionata.toISOString().split('T')[0];
        // Fetch dati (Open-Meteo vuole la data YYYY-MM-DD)
        state.weatherData = await WeatherAPI.fetchForecast(lat, lng, dateStr);
        
        if (!state.weatherData) return;

        // Elaborazione ora scelta dall'utente
        const [ore, minuti] = timeVal.split(':').map(Number);
        const hourIdx = ore; 
        const hDec = ore + (minuti / 60);

        const hourly = state.weatherData.hourly;
        const daily = state.weatherData.daily;

        // Aggiornamento interfaccia con i dati dell'ora scelta
        document.getElementById('r-wind').innerText = Math.round(hourly.wind_speed_10m[hourIdx]) + " km/h";
        document.getElementById('r-hum').innerText = hourly.relative_humidity_2m[hourIdx] + "%";
        document.getElementById('r-temp').innerText = Math.round(hourly.temperature_2m[hourIdx]) + "°C";
        document.getElementById('r-cloud-percent').innerText = hourly.cloud_cover[hourIdx] + "%";
        document.getElementById('display-hour-center').innerText = timeVal;

        const sunrise = daily.sunrise[0].split('T')[1].substring(0, 5);
        const sunset = daily.sunset[0].split('T')[1].substring(0, 5);
        document.getElementById('sunrise-txt').innerText = sunrise;
        document.getElementById('sunset-txt').innerText = sunset;

        const sunH = SolarEngine.timeToDecimal(sunrise);
        const setH = SolarEngine.timeToDecimal(sunset);

        // Calcolo Watt
        const pServ = SolarEngine.calculatePower(hDec, sunH, setH, state.panelWp, hourly.cloud_cover[hourIdx]);
        const pPS = SolarEngine.calculatePower(hDec, sunH, setH, state.panelPsWp, hourly.cloud_cover[hourIdx]);
        
        document.getElementById('w_out').innerText = Math.round(pServ + pPS) + " W";
        document.getElementById('w_services').innerText = Math.round(pServ) + " W";
        document.getElementById('w_ps').innerText = Math.round(pPS) + " W";

        updateSunUI(hDec, sunH, setH);
        updateReportUI(pServ + pPS, sunH, setH);

    } catch (e) { console.error("Update Error:", e); }
}

async function handleGpsSync() {
    const btn = document.getElementById('btn-gps');
    btn.disabled = true;
    btn.innerText = "🛰️ SINCRONIZZAZIONE...";
    try {
        const coords = await WeatherAPI.getUserLocation();
        document.getElementById('input-lat').value = coords.latitude.toFixed(4);
        document.getElementById('input-lng').value = coords.longitude.toFixed(4);
        
        // Il GPS resetta all'ora attuale
        const ora = new Date();
        document.getElementById('input-time').value = ora.getHours().toString().padStart(2,'0') + ":" + ora.getMinutes().toString().padStart(2,'0');
        dataSelezionata = new Date();
        document.getElementById('input-date').value = dataSelezionata.toISOString().split('T')[0];

        await updateCityName(coords.latitude, coords.longitude);
        updateAll();
        btn.innerText = "✅ SINCRONIZZATO";
    } catch (e) { btn.innerText = "❌ ERRORE GPS"; }
    setTimeout(() => { btn.disabled = false; btn.innerText = "📡 AGGIORNA GPS E ORA ATTUALE"; }, 2000);
}

// --- LOGICA GARAGE E UI ---

function editSpec(type) {
    let current = 0;
    if (type === 'batt') current = state.battAh;
    else if (type === 'ps') current = state.psAh;
    else if (type === 'pan') current = state.panelWp;
    else if (type === 'panPs') current = state.panelPsWp;

    const v = prompt("Inserisci nuovo valore:", current);
    if (v !== null && v !== "") {
        const val = parseFloat(v);
        if (type === 'batt') state.battAh = val;
        else if (type === 'ps') state.psAh = val;
        else if (type === 'pan') state.panelWp = val;
        else if (type === 'panPs') state.panelPsWp = val;
        saveGarageSettings();
        loadSavedData();
        updateAll();
    }
}

function saveGarageSettings() {
    localStorage.setItem('vibe_camper_name', document.getElementById('camper_name_input').value);
    localStorage.setItem('vibe_batt_ah', state.battAh);
    localStorage.setItem('vibe_ps_ah', state.psAh);
    localStorage.setItem('vibe_panel_wp', state.panelWp);
    localStorage.setItem('vibe_panel_ps_wp', state.panelPsWp);
    document.getElementById('camper-name-display').innerText = document.getElementById('camper_name_input').value.toUpperCase();
}

function loadSavedData() {
    document.getElementById('batt_val').innerText = state.battAh;
    document.getElementById('ps_val').innerText = state.psAh;
    document.getElementById('panel_val').innerText = state.panelWp;
    document.getElementById('panel_ps_val').innerText = state.panelPsWp;
    document.getElementById('camper_name_input').value = state.camperName;
    document.getElementById('camper-name-display').innerText = state.camperName.toUpperCase() || "IL MIO CAMPER";
    
    // Update conversioni visuali Ah/Wh
    document.getElementById('batt_conv_val').innerText = Math.round(state.battAh * 12.8);
    document.getElementById('ps_conv_val').innerText = Math.round(state.psAh / 12.8);
}

function updateReportUI(totalPower, sunH, setH) {
    const chart = document.getElementById('hourly-chart');
    if (!chart || !state.weatherData) return;
    chart.innerHTML = "";
    let dailyTotal = 0;
    const hourly = state.weatherData.hourly;

    for (let h = 0; h < 24; h++) {
        const p = SolarEngine.calculatePower(h, sunH, setH, state.panelWp + state.panelPsWp, hourly.cloud_cover[h]);
        dailyTotal += p;
        const bar = document.createElement('div');
        bar.className = 'bar';
        const height = (p / (state.panelWp + state.panelPsWp || 1)) * 100;
        bar.style.height = Math.max(2, height) + "%";
        bar.onclick = () => {
            document.getElementById('detail-display').innerHTML = `ORE ${h}:00 <span style="color:#fff">→</span> ${Math.round(p)}W`;
        };
        chart.appendChild(bar);
    }
    document.getElementById('total-wh-day').innerText = Math.round(dailyTotal) + " Wh";
}

function updateSunUI(hDec, sunH, setH) {
    const sun = document.getElementById('sun-body');
    const sky = document.getElementById('sky-box');
    if (hDec < sunH || hDec > setH) {
        sun.style.display = "none";
        sky.style.background = "#0f172a";
    } else {
        sun.style.display = "block";
        const progress = (hDec - sunH) / (setH - sunH);
        sun.style.left = (10 + (progress * 80)) + "%";
        sun.style.bottom = (Math.sin(progress * Math.PI) * 40 + 10) + "%";
        sky.style.background = (progress < 0.2 || progress > 0.8) ? "linear-gradient(to bottom, #7c2d12, #0f172a)" : "linear-gradient(to bottom, #1d4ed8, #38bdf8)";
    }
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
        btn.innerHTML = `<span>${d.toLocaleDateString('it-IT',{weekday:'short'}).toUpperCase()}</span><b>${d.getDate()}</b>`;
        btn.onclick = () => {
            dataSelezionata = new Date(d);
            document.getElementById('input-date').value = dataSelezionata.toISOString().split('T')[0];
            generaBottoniGiorni();
            updateAll();
        };
        container.appendChild(btn);
    }
}

function switchView(viewId, navItem) {
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    document.getElementById('view-' + viewId).classList.add('active');
    navItem.classList.add('active');
}

function initSliders() {
    ['soc-slider', 'ps-soc-slider'].forEach(id => {
        const s = document.getElementById(id);
        s.addEventListener('input', (e) => {
            const valId = id === 'soc-slider' ? 'soc-val' : 'ps-soc-val';
            document.getElementById(valId).innerText = e.target.value + "%";
            if (id === 'soc-slider') state.currentSOC = e.target.value;
            else state.currentPsSOC = e.target.value;
            updateAll();
        });
    });
}

function setupStars() {
    const container = document.getElementById('stars-container');
    for (let i = 0; i < 30; i++) {
        const s = document.createElement('div');
        s.className = 'star';
        s.style.left = Math.random() * 100 + "%";
        s.style.top = Math.random() * 100 + "%";
        container.appendChild(s);
    }
}

function changeBg(color) {
    document.body.className = ""; 
    if (color === '#062c1f') document.body.classList.add('tema-verde');
    if (color === '#2d0a1a') document.body.classList.add('tema-rosso');
    if (color === '#1a1a1a') document.body.classList.add('tema-grigio');
    document.body.style.backgroundColor = color;
    localStorage.setItem('vibe_solar_bg_color', color);
}

async function searchCityCoords(city) {
    try {
        const r = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${city}&limit=1`);
        const d = await r.json();
        if (d[0]) {
            document.getElementById('input-lat').value = parseFloat(d[0].lat).toFixed(4);
            document.getElementById('input-lng').value = parseFloat(d[0].lon).toFixed(4);
            updateAll();
        }
    } catch (e) {}
}

async function updateCityName(lat, lng) {
    try {
        const r = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`);
        const d = await r.json();
        document.getElementById('city-input').value = (d.address.city || d.address.town || "POSIZIONE").toUpperCase();
    } catch (e) {}
}
