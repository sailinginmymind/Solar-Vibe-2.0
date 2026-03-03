/**
 * APP.JS - Configurato esattamente per il tuo index.html
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
    // Esegue il primo aggiornamento automatico
    document.getElementById('btn-gps').click();
};

function initEventListeners() {
    // Gestione click sul numero grande (w_out)
    const displayVal = document.getElementById('w_out');
    if (displayVal) {
        displayVal.addEventListener('click', () => {
            state.isWh = !state.isWh;
            updateAll();
        });
    }

    // Navbar
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', () => switchView(item.dataset.view, item));
    });

    // GPS Button
    document.getElementById('btn-gps').addEventListener('click', handleGpsSync);

    // Inputs Dashboard
    ['input-time', 'input-date', 'input-lat', 'input-lng'].forEach(id => {
        document.getElementById(id).addEventListener('change', updateAll);
    });

    // Slider Batteria
    document.getElementById('soc-slider').addEventListener('input', (e) => {
        state.currentSOC = e.target.value;
        document.getElementById('soc-val').innerText = state.currentSOC + "%";
        updateAll();
    });

    // Garage
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

    // Cambia Colore e Etichetta
    displayVal.style.color = state.isWh ? "#fbbf24" : "#38bdf8";
    if (displayLabel) displayLabel.innerText = state.isWh ? "Clicca per i Watt" : "Clicca per i Wattora";

    try {
        state.weatherData = await WeatherAPI.fetchForecast(lat, lng, date);
        if (!state.weatherData) return;

        const hourIdx = parseInt(time.split(':')[0]);
        const hDec = SolarEngine.timeToDecimal(time);
        
        const hourly = state.weatherData.hourly;
        const daily = state.weatherData.daily;

        // Dati Alba/Tramonto
        const sunrise = daily.sunrise[0].split('T')[1].substring(0, 5);
        const sunset = daily.sunset[0].split('T')[1].substring(0, 5);
        document.getElementById('sunrise-txt').innerText = sunrise;
        document.getElementById('sunset-txt').innerText = sunset;
        document.getElementById('display-hour-center').innerText = time;

        // Badge Meteo
        document.getElementById('r-cloud-percent').innerText = hourly.cloud_cover[hourIdx] + "%";
        document.getElementById('r-temp').innerText = Math.round(hourly.temperature_2m[hourIdx]) + "°";
        document.getElementById('r-hum').innerText = hourly.relative_humidity_2m[hourIdx] + "%";
        document.getElementById('r-wind').innerText = Math.round(hourly.wind_speed_10m[hourIdx]) + " km/h";

        // Calcolo Potenza
        const sunH = SolarEngine.timeToDecimal(sunrise);
        const setH = SolarEngine.timeToDecimal(sunset);
        const power = SolarEngine.calculatePower(hDec, sunH, setH, state.panelWp, hourly.cloud_cover[hourIdx]);
        
        // Aggiorna numero grande
        displayVal.innerText = Math.round(state.isWh ? power * 0.9 : power) + (state.isWh ? " Wh" : " W");

        // UI Extra
        if (typeof updateSunUI === 'function') updateSunUI(hDec, sunH, setH);
        updateReportUI(power, sunH, setH);

    } catch (e) { console.error("Errore updateAll:", e); }
}

// Navigazione
function switchView(vId, el) {
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
    document.getElementById('view-' + vId).classList.add('active');
    el.classList.add('active');
}

function updateReportUI(currentPower, sunH, setH) {
    // Aggiorna tempi di carica (basati sulla batteria salvata)
    document.getElementById('charge_80_txt').innerText = SolarEngine.estimateChargeTime(state.currentSOC, 80, currentPower, state.battAh);
    document.getElementById('charge_90_txt').innerText = SolarEngine.estimateChargeTime(state.currentSOC, 90, currentPower, state.battAh);
    document.getElementById('charge_100_txt').innerText = SolarEngine.estimateChargeTime(state.currentSOC, 100, currentPower, state.battAh);

    const chart = document.getElementById('hourly-chart');
    if (!chart) return;
    chart.innerHTML = "";
    
    let dailyTotal = 0;
    
    // Ciclo dalle ore di luce (arrotondate)
    const startHour = Math.floor(sunH);
    const endHour = Math.ceil(setH);

for (let h = startHour; h <= endHour; h++) {
        const cloud = state.weatherData.hourly.cloud_cover[h];
        const hP = SolarEngine.calculatePower(h, sunH, setH, state.panelWp, cloud);
        dailyTotal += hP;

        const bar = document.createElement('div');
        bar.className = 'bar';
        bar.style.height = (hP / state.panelWp * 100) + "%";

        const showDetail = () => {
            // Rimuove "active" da tutte le altre barre
            document.querySelectorAll('.bar').forEach(b => b.classList.remove('active'));
            // Aggiunge "active" a quella cliccata
            bar.classList.add('active');
            
            // Scrive il dato GRANDE nel nuovo contenitore
            const detailBox = document.getElementById('detail-display');
            detailBox.innerHTML = `ORE ${h}:00 <span style="margin:0 10px">→</span> ${Math.round(hP)} W`;
            detailBox.style.transform = "scale(1.1)";
            
            // Feedback anche sulla label totale
            const totalDisplay = document.getElementById('total-wh-day');
            totalDisplay.innerText = Math.round(hP); 
        };

        bar.addEventListener('mouseenter', showDetail); // Per PC
        bar.addEventListener('touchstart', (e) => {     // Per Mobile (più reattivo)
            e.preventDefault();
            showDetail();
        });

        chart.appendChild(bar);
    }
        // Evento per mostrare i Watt (Desktop e Mobile)
        const showVal = () => {
            const displayTotal = document.getElementById('total-wh-day');
            displayTotal.innerHTML = `Ore ${h}:00 → <b>${Math.round(hP)} W</b>`;
            // Ripristina il totale dopo 3 secondi
            setTimeout(() => {
                displayTotal.innerText = Math.round(dailyTotal);
            }, 3000);
        };

        bar.addEventListener('mouseenter', showVal);
        bar.addEventListener('click', showVal);

        chart.appendChild(bar);
    }
    document.getElementById('total-wh-day').innerText = Math.round(dailyTotal);
}

function editSpec(type) {
    let v = prompt(type === 'batt' ? "Ah Batteria:" : "Watt Pannelli (Wp):");
    if (v && !isNaN(v)) {
        if (type === 'batt') {
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
    for (let i = 0; i < 50; i++) {
        const star = document.createElement('div');
        star.className = 'star';
        star.style.left = Math.random() * 100 + '%';
        star.style.top = Math.random() * 60 + '%';
        star.style.width = star.style.height = Math.random() * 2 + 'px';
        container.appendChild(star);
    }
}
