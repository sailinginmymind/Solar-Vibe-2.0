/**
 * APP.JS
 * Il controller principale che coordina UI e logica.
 */

// Stato dell'applicazione
// 1. Questa deve stare in cima al file app.js
let wattMode = 'W';
let state = {
    isWh: false,
    currentSOC: 50,
    battAh: parseFloat(localStorage.getItem('vibe_batt_ah')) || 100,
    panelWp: parseFloat(localStorage.getItem('vibe_panel_wp')) || 100,
    weatherData: null
};

// Inizializzazione al caricamento
window.onload = () => {
    setupStars();
    initEventListeners();
    loadSavedData();
    // Esegue una sincronizzazione iniziale
    document.getElementById('btn-gps').click();
};

function toggleWattMode() {
    // Cambia lo stato
    wattMode = (wattMode === 'W') ? 'Wh' : 'W'; 
    state.isWh = (wattMode === 'Wh');

    const displayVal = document.querySelector('.main-wattage');
    const displayLabel = document.getElementById('watt-label');

    if (state.isWh) {
        displayVal.setAttribute('style', 'color: #fbbf24 !important'); // Forza il giallo
        if(displayLabel) displayLabel.innerText = "ENERGIA ACCUMULATA (Wh)";
    } else {
        displayVal.setAttribute('style', 'color: #38bdf8 !important'); // Forza l'azzurro
        if(displayLabel) displayLabel.innerText = "POTENZA ISTANTANEA (W)";
    }

    updateAll(); 
}

function initEventListeners() {
    // Gestione click sul numero grande (Unificato)
    document.querySelector('.main-wattage').addEventListener('click', toggleWattMode);
    
    document.getElementById('btn-save-name').addEventListener('click', saveGarageName);
    
    // Navbar
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', () => switchView(item.dataset.view, item));
    });

    // Inputs Dashboard
    ['input-time', 'input-date', 'input-lat', 'input-lng'].forEach(id => {
        document.getElementById(id).addEventListener('change', updateAll);
    });

    // GPS Button
    document.getElementById('btn-gps').addEventListener('click', handleGpsSync);

    // Slider SOC
    document.getElementById('soc-slider').addEventListener('input', (e) => {
        state.currentSOC = e.target.value;
        document.getElementById('soc-val').innerText = state.currentSOC + "%";
        updateAll();
    });

    // Garage
    document.getElementById('edit-batt-btn').addEventListener('click', () => editSpec('batt'));
    document.getElementById('edit-pan-btn').addEventListener('click', () => editSpec('pan'));
}

// Funzioni di navigazione e UI
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
        console.error("Dettaglio Errore GPS:", err);
        // Questo switch ci dice la verità:
        let msg = "ERRORE GPS";
        if (err.code === 1) msg = "PERMESSO NEGATO";
        if (err.code === 2) msg = "POSIZIONE NON DISP.";
        if (err.code === 3) msg = "TIMEOUT GPS";
        
        btn.innerText = "❌ " + msg;
    } finally {
        setTimeout(() => { 
            btn.classList.remove('syncing'); 
            btn.innerText = "📡 AGGIORNA GPS E ORA ATTUALE"; 
        }, 3000);
    }
}

// --- UNICA FUNZIONE UPDATEALL CORRETTA ---
async function updateAll() {
    const lat = document.getElementById('input-lat').value;
    const lng = document.getElementById('input-lng').value;
    const date = document.getElementById('input-date').value;
    const time = document.getElementById('input-time').value;
    const displayVal = document.querySelector('.main-wattage');

    if (!displayVal) return;

    // 1. Gestione Colore e Stato
    if (wattMode === 'Wh') {
        displayVal.style.color = "#fbbf24"; // Giallo
        state.isWh = true;
    } else {
        displayVal.style.color = "#38bdf8"; // Azzurro
        state.isWh = false;
    }

    if (!lat || !lng) return;

    try {
        // 2. Fetch dati meteo
        state.weatherData = await WeatherAPI.fetchForecast(lat, lng, date);
        
        if(!state.weatherData || !state.weatherData.hourly) {
            console.error("Dati meteo mancanti");
            return;
        }

        const hourIdx = parseInt(time.split(':')[0]);
        const hDec = SolarEngine.timeToDecimal(time);
        
        const sunriseStr = state.weatherData.daily.sunrise[0].split('T')[1];
        const sunsetStr = state.weatherData.daily.sunset[0].split('T')[1];
        const sunH = SolarEngine.timeToDecimal(sunriseStr);
        const setH = SolarEngine.timeToDecimal(sunsetStr);

        // 3. Aggiornamento UI Dashboard
        document.getElementById('sunrise-txt').innerText = sunriseStr;
        document.getElementById('sunset-txt').innerText = sunsetStr;
        document.getElementById('display-hour-center').innerText = time;
        
        const cloud = state.weatherData.hourly.cloud_cover[hourIdx];
        const temp = state.weatherData.hourly.temperature_2m[hourIdx];
        const hum = state.weatherData.hourly.relative_humidity_2m[hourIdx];
        const wind = state.weatherData.hourly.wind_speed_10m[hourIdx];

        document.getElementById('r-cloud-percent').innerText = cloud + "%";
        document.getElementById('r-temp').innerText = Math.round(temp) + "°";
        document.getElementById('r-hum').innerText = hum + "%";
        document.getElementById('r-wind').innerText = Math.round(wind) + " km/h";
        
        // 4. Calcolo Potenza
        const power = SolarEngine.calculatePower(hDec, sunH, setH, state.panelWp, cloud);
        
        updateSunUI(hDec, sunH, setH);
        
        // Scrive il numero grande (W o Wh)
        const valFinale = Math.round(state.isWh ? power * 0.9 : power); 
        displayVal.innerText = valFinale + (state.isWh ? " Wh" : " W");

        updateReportUI(power, sunH, setH);

    } catch (error) {
        console.error("Errore nel calcolo:", error);
    }
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
    // Tempi di carica
    const t80 = SolarEngine.estimateChargeTime(state.currentSOC, 80, currentPower, state.battAh);
    const t90 = SolarEngine.estimateChargeTime(state.currentSOC, 90, currentPower, state.battAh);
    const t100 = SolarEngine.estimateChargeTime(state.currentSOC, 100, currentPower, state.battAh);

    document.getElementById('charge_80_txt').innerText = t80;
    document.getElementById('charge_90_txt').innerText = t90;
    document.getElementById('charge_100_txt').innerText = t100;

    // Grafico e Totale
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
    const oldVal = type === 'batt' ? state.battAh : state.panelWp;
    let v = prompt(label, oldVal);
    if(v && !isNaN(v)) {
        if(type === 'batt') {
            state.battAh = v;
            localStorage.setItem('vibe_batt_ah', v);
            document.getElementById('batt_val').innerText = v;
        } else {
            state.panelWp = v;
            localStorage.setItem('vibe_panel_wp', v);
            document.getElementById('panel_val').innerText = v;
        }
        updateAll();
    }
}

function saveGarageName() {
    const btn = document.getElementById('btn-save-name');
    const val = document.getElementById('camper_name_input').value;
    
    // 1. Salva nel localStorage
    localStorage.setItem('vibe_camper_name', val);
    
    // 2. Aggiorna il titolo principale (solo ORA al click)
    // Se è vuoto, usa un fallback
    const displayName = (val || "IL MIO VAN").toUpperCase();
    document.getElementById('camper-name-display').innerText = displayName;
    
    // 3. Feedback visivo sul mini-pulsante
    btn.innerText = "✅";
    btn.style.background = "#22c55e"; // Verde
    
    setTimeout(() => {
        btn.innerText = "💾";
        btn.style.background = "#38bdf8"; // Torna all'azzurro originale
    }, 1500);
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
    for (let i = 0; i < 50; i++) {
        const star = document.createElement('div');
        star.className = 'star';
        star.style.left = Math.random() * 100 + '%';
        star.style.top = Math.random() * 60 + '%';
        star.style.width = star.style.height = Math.random() * 2 + 'px';
        container.appendChild(star);
    }
}
