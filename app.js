/**
 * APP.JS - VERSIONE DEFINITIVA RIPRISTINATA
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
    // Esegue una sincronizzazione iniziale simulando il click sul GPS
    const gpsBtn = document.getElementById('btn-gps');
    if(gpsBtn) gpsBtn.click();
};

function toggleWattMode() {
    wattMode = (wattMode === 'W') ? 'Wh' : 'W';
    state.isWh = (wattMode === 'Wh');
    updateAll(); 
}

function initEventListeners() {
    const mainWatt = document.querySelector('.main-wattage');
    if(mainWatt) mainWatt.addEventListener('click', toggleWattMode);
    
    const saveBtn = document.getElementById('btn-save-name');
    if(saveBtn) saveBtn.addEventListener('click', saveGarageName);
    
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', () => switchView(item.dataset.view, item));
    });

    ['input-time', 'input-date', 'input-lat', 'input-lng'].forEach(id => {
        const el = document.getElementById(id);
        if(el) el.addEventListener('change', updateAll);
    });

    const gpsBtn = document.getElementById('btn-gps');
    if(gpsBtn) gpsBtn.addEventListener('click', handleGpsSync);

    const socSlider = document.getElementById('soc-slider');
    if(socSlider) {
        socSlider.addEventListener('input', (e) => {
            state.currentSOC = e.target.value;
            const socVal = document.getElementById('soc-val');
            if(socVal) socVal.innerText = state.currentSOC + "%";
            updateAll();
        });
    }

    const editBatt = document.getElementById('edit-batt-btn');
    const editPan = document.getElementById('edit-pan-btn');
    if(editBatt) editBatt.addEventListener('click', () => editSpec('batt'));
    if(editPan) editPan.addEventListener('click', () => editSpec('pan'));
}

function switchView(vId, el) {
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
    const targetView = document.getElementById('view-' + vId);
    if(targetView) targetView.classList.add('active');
    if(el) el.classList.add('active');
}

async function handleGpsSync() {
    const btn = document.getElementById('btn-gps');
    if(!btn) return;
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

    // Colore e Testo modalità
    displayVal.style.color = state.isWh ? "#fbbf24" : "#38bdf8";
    if(displayLabel) displayLabel.innerText = state.isWh ? "ENERGIA ACCUMULATA (Wh)" : "POTENZA ISTANTANEA (W)";

    if (!lat || !lng) return;

    try {
        state.weatherData = await WeatherAPI.fetchForecast(lat, lng, date);
        if(!state.weatherData || !state.weatherData.hourly) return;

        const hourIdx = parseInt(time.split(':')[0]);
        const hDec = SolarEngine.timeToDecimal(time);
        
        // Dati Daily (Alba/Tramonto)
        const sunriseStr = state.weatherData.daily.sunrise[0].split('T')[1].substring(0, 5);
        const sunsetStr = state.weatherData.daily.sunset[0].split('T')[1].substring(0, 5);
        const sunH = SolarEngine.timeToDecimal(sunriseStr);
        const setH = SolarEngine.timeToDecimal(sunsetStr);

        document.getElementById('sunrise-txt').innerText = sunriseStr;
        document.getElementById('sunset-txt').innerText = sunsetStr;
        document.getElementById('display-hour-center').innerText = time;
        
        // Dati Hourly (Badge)
        const cloud = state.weatherData.hourly.cloud_cover[hourIdx];
        document.getElementById('r-cloud-percent').innerText = cloud + "%";
        document.getElementById('r-temp').innerText = Math.round(state.weatherData.hourly.temperature_2m[hourIdx]) + "°";
        document.getElementById('r-hum').innerText = state.weatherData.hourly.relative_humidity_2m[hourIdx] + "%";
        document.getElementById('r-wind').innerText = Math.round(state.weatherData.hourly.wind_speed_10m[hourIdx]) + " km/h";
        
        // Calcolo e Sole
        const power = SolarEngine.calculatePower(hDec, sunH, setH, state.panelWp, cloud);
        updateSunUI(hDec, sunH, setH);
        
        const valFinale = Math.round(state.isWh ? power * 0.9 : power); 
        displayVal.innerText = valFinale + (state.isWh ? " Wh" : " W");
        
        updateReportUI(power, sunH, setH);
    } catch (e) { console.error("Errore updateAll:", e); }
}

function updateSunUI(hDec, sunH, setH) {
    const sun = document.getElementById('sun-body');
    const sky = document.getElementById('sky-box');
    const stars = document.getElementById('stars-container');
    if(!sun || !sky || !stars) return;

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
    const t80Txt = document.getElementById('charge_80_txt');
    if(t80Txt) t80Txt.innerText = SolarEngine.estimateChargeTime(state.currentSOC, 80, currentPower, state.battAh);
    
    const t90Txt = document.getElementById('charge_90_txt');
    if(t90Txt) t90Txt.innerText = SolarEngine.estimateChargeTime(state.currentSOC, 90, currentPower, state.battAh);
    
    const t100Txt = document.getElementById('charge_100_txt');
    if(t100Txt) t100Txt.innerText = SolarEngine.estimateChargeTime(state.currentSOC, 100, currentPower, state.battAh);

    const chart = document.getElementById('hourly-chart');
    if(!chart) return;
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
    const totWh = document.getElementById('total-wh-day');
    if(totWh) totWh.innerText = Math.round(dailyTotal);
}

function editSpec(type) {
    const label = type === 'batt' ? "Ah Batteria:" : "Watt Pannelli (Wp):";
    let v = prompt(label, type === 'batt' ? state.battAh : state.panelWp);
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
    const input = document.getElementById('camper_name_input');
    if(!input) return;
    const val = input.value;
    localStorage.setItem('vibe_camper_name', val);
    const display = document.getElementById('camper-name-display');
    if(display) display.innerText = (val || "IL MIO VAN").toUpperCase();
    const btn = document.getElementById('btn-save-name');
    if(btn) {
        btn.innerText = "✅";
        setTimeout(() => { btn.innerText = "💾"; }, 1500);
    }
}

function loadSavedData() {
    const name = localStorage.getItem('vibe_camper_name') || "";
    const input = document.getElementById('camper_name_input');
    if(input) input.value = name;
    const display = document.getElementById('camper-name-display');
    if(display) display.innerText = (name || "IL MIO CAMPER").toUpperCase();
    const bVal = document.getElementById('batt_val');
    if(bVal) bVal.innerText = state.battAh;
    const pVal = document.getElementById('panel_val');
    if(pVal) pVal.innerText = state.panelWp;
}

function setupStars() {
    const container = document.getElementById('stars-container');
    if(!container) return;
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
