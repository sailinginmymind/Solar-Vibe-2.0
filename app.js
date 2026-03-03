/**
 * APP.JS
 * Versione Corretta - Ripristino GPS, Report e Colori
 */

let wattMode = 'W';
let state = {
    isWh: false,
    currentSOC: 50,
    battAh: parseFloat(localStorage.getItem('vibe_batt_ah')) || 100,
    panelWp: parseFloat(localStorage.getItem('vibe_panel_wp')) || 100,
    weatherData: null
};

window.onload = () => {
    setupStars();
    initEventListeners();
    loadSavedData();
    // Esegue una sincronizzazione iniziale
    document.getElementById('btn-gps').click();
};

function toggleWattMode() {
    wattMode = (wattMode === 'W') ? 'Wh' : 'W';
    state.isWh = (wattMode === 'Wh');
    updateAll(); 
}

function initEventListeners() {
    // Click sul numero grande
    const mainWatt = document.querySelector('.main-wattage');
    if(mainWatt) mainWatt.addEventListener('click', toggleWattMode);
    
    document.getElementById('btn-save-name').addEventListener('click', saveGarageName);
    
    // Navbar
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', () => switchView(item.dataset.view, item));
    });

    // Inputs Dashboard
    ['input-time', 'input-date', 'input-lat', 'input-lng'].forEach(id => {
        const el = document.getElementById(id);
        if(el) el.addEventListener('change', updateAll);
    });

    // GPS Button
    document.getElementById('btn-gps').addEventListener('click', handleGpsSync);

    // Slider SOC
    const socSlider = document.getElementById('soc-slider');
    if(socSlider) {
        socSlider.addEventListener('input', (e) => {
            state.currentSOC = e.target.value;
            document.getElementById('soc-val').innerText = state.currentSOC + "%";
            updateAll();
        });
    }

    // Garage
    document.getElementById('edit-batt-btn').addEventListener('click', () => editSpec('batt'));
    document.getElementById('edit-pan-btn').addEventListener('click', () => editSpec('pan'));
}

function switchView(vId, el) {
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
    document.getElementById('view-' + vId).classList.add('active');
    el.classList.add('active');
}

async function handleGpsSync() {
    const btn = document.getElementById('btn-gps');
    btn.classList.add('syncing');
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
        setTimeout(() => { 
            btn.classList.remove('syncing'); 
            btn.innerText = "📡 AGGIORNA GPS E ORA ATTUALE"; 
        }, 3000);
    }
}

async function updateAll() {
    const lat = document.getElementById('input-lat').value;
    const lng = document.getElementById('input-lng').value;
    const date = document.getElementById('input-date').value;
    const time = document.getElementById('input-time').value;
    const displayVal = document.querySelector('.main-wattage');
    const displayLabel = document.getElementById('watt-label');

    if (!displayVal) return;

    // Gestione Colore e Testo
    if (state.isWh) {
        displayVal.style.color = "#fbbf24";
        if(displayLabel) displayLabel.innerText = "ENERGIA ACCUMULATA (Wh)";
    } else {
        displayVal.style.color = "#38bdf8";
        if(displayLabel) displayLabel.innerText = "POTENZA ISTANTANEA (W)";
    }

    if (!lat || !lng) return;

   // Cerca questo blocco dentro updateAll e sostituiscilo/controllalo:
try {
    state.weatherData = await WeatherAPI.fetchForecast(lat, lng, date);
    
    // Se i dati non arrivano, usciamo per non rompere il resto
    if(!state.weatherData || !state.weatherData.hourly || !state.weatherData.daily) {
        console.error("Dati meteo non ricevuti dall'API");
        return;
    }

    const hourIdx = parseInt(time.split(':')[0]);
    // Prendi i dati dall'ora corrente (0-23)
    const cloud = state.weatherData.hourly.cloud_cover[hourIdx];
    const temp = state.weatherData.hourly.temperature_2m[hourIdx];
    const hum = state.weatherData.hourly.relative_humidity_2m[hourIdx];
    const wind = state.weatherData.hourly.wind_speed_10m[hourIdx];

    // Aggiorna i testi dei badge
    document.getElementById('r-cloud-percent').innerText = cloud + "%";
    document.getElementById('r-temp').innerText = Math.round(temp) + "°";
    document.getElementById('r-hum').innerText = hum + "%";
    document.getElementById('r-wind').innerText = Math.round(wind) + " km/h";

    // Alba e Tramonto (Prendiamo il primo giorno)
    const sunriseStr = state.weatherData.daily.sunrise[0].split('T')[1].substring(0, 5);
    const sunsetStr = state.weatherData.daily.sunset[0].split('T')[1].substring(0, 5);
    
    document.getElementById('sunrise-txt').innerText = sunriseStr;
    document.getElementById('sunset-txt').innerText = sunsetStr;

    // Calcolo per il movimento del sole
    const hDec = SolarEngine.timeToDecimal(time);
    const sunH = SolarEngine.timeToDecimal(sunriseStr);
    const setH = SolarEngine.timeToDecimal(sunsetStr);
    
    updateSunUI(hDec, sunH, setH);

} catch (e) {
    console.error("Errore durante il recupero del meteo:", e);
}

function updateSunUI(hDec, sunH, setH) {
    const sun = document.getElementById('sun-body');
    const sky = document.getElementById('sky-box');
    const stars = document.getElementById('stars-container');
    if (hDec < sunH || hDec > setH) {
        sky.classList.add('is-night-sky');
        stars.style.opacity = "1";
        sun.style.top = "380px";
    } else {
        sky.classList.remove('is-night-sky');
        stars.style.opacity = "0";
        const progress = (hDec - sunH) / (setH - sunH);
        const arc = Math.sin(progress * Math.PI);
        sun.style.left = `${progress * 100}%`;
        sun.style.top = `${230 - (arc * 200)}px`;
    }
}

function updateReportUI(currentPower, sunH, setH) {
    const t80 = SolarEngine.estimateChargeTime(state.currentSOC, 80, currentPower, state.battAh);
    document.getElementById('charge_80_txt').innerText = t80;
    document.getElementById('charge_90_txt').innerText = SolarEngine.estimateChargeTime(state.currentSOC, 90, currentPower, state.battAh);
    document.getElementById('charge_100_txt').innerText = SolarEngine.estimateChargeTime(state.currentSOC, 100, currentPower, state.battAh);

    const chart = document.getElementById('hourly-chart');
    chart.innerHTML = "";
    let dailyTotal = 0;
    for(let h=0; h<24; h++) {
        const cloud = state.weatherData.hourly.cloud_cover[h];
        const hP = SolarEngine.calculatePower(h, sunH, setH, state.panelWp, cloud);
        dailyTotal += hP;
        const bar = document.createElement('div');
        bar.className = 'bar';
        bar.style.height = (hP / state.panelWp * 100) + "%";
        chart.appendChild(bar);
    }
    document.getElementById('total-wh-day').innerText = Math.round(dailyTotal);
}

function editSpec(type) {
    const label = type === 'batt' ? "Ah Batteria:" : "Watt Pannelli (Wp):";
    let v = prompt(label, type === 'batt' ? state.battAh : state.panelWp);
    if(v && !isNaN(v)) {
        if(type === 'batt') { state.battAh = v; localStorage.setItem('vibe_batt_ah', v); document.getElementById('batt_val').innerText = v; }
        else { state.panelWp = v; localStorage.setItem('vibe_panel_wp', v); document.getElementById('panel_val').innerText = v; }
        updateAll();
    }
}

function saveGarageName() {
    const val = document.getElementById('camper_name_input').value;
    localStorage.setItem('vibe_camper_name', val);
    document.getElementById('camper-name-display').innerText = (val || "IL MIO VAN").toUpperCase();
    const btn = document.getElementById('btn-save-name');
    btn.innerText = "✅";
    setTimeout(() => { btn.innerText = "💾"; }, 1500);
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
    if(!container) return;
    for (let i = 0; i < 50; i++) {
        const star = document.createElement('div');
        star.className = 'star';
        star.style.left = Math.random() * 100 + '%';
        star.style.top = Math.random() * 60 + '%';
        star.style.width = star.style.height = Math.random() * 2 + 'px';
        container.appendChild(star);
    }
}
