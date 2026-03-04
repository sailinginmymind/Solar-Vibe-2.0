/**
 * APP.JS - VERSIONE UNIFICATA DEFINITIVA
 * Sincronizzazione totale: GPS = Ricerca Città = Inserimento Manuale
 */

let state = {
    isWh: false,
    currentSOC: 50,
    battAh: parseFloat(localStorage.getItem('vibe_batt_ah')) || 100,
    panelWp: parseFloat(localStorage.getItem('vibe_panel_wp')) || 100,
    weatherData: null
};

// 1. AVVIO: Carica tutto e clicca il GPS per partire dalla posizione attuale
window.onload = () => {
    initEventListeners();
    loadSavedData();
    setupStars();
    
    setTimeout(() => {
        const btnGps = document.getElementById('btn-gps');
        if (btnGps) btnGps.click();
    }, 500);
};

function initEventListeners() {
    // Navigazione tra le viste
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', () => switchView(item.dataset.view, item));
    });

    // TASTO GPS
    document.getElementById('btn-gps').addEventListener('click', handleGpsSync);

    // INSERIMENTO MANUALE COORDINATE (Trigger Refresh Totale)
    ['input-lat', 'input-lng'].forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener('change', async () => {
                const lat = document.getElementById('input-lat').value;
                const lng = document.getElementById('input-lng').value;
                if (lat && lng) await triggerFullRefresh(lat, lng);
            });
        }
    });

    // RICERCA CITTÀ (Trigger Refresh Totale)
    const cityInput = document.getElementById('city-input');
    if (cityInput) {
        cityInput.addEventListener('keypress', function (e) {
            if (e.key === 'Enter') searchCityCoords(this.value);
        });
    }

    // CAMBIO MANUALE ORA/DATA (Aggiorna solo il calcolo, non il fuso)
    ['input-time', 'input-date'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('change', updateAll);
    });

    // CONTROLLI GARAGE
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

/**
 * FUNZIONE CORE: triggerFullRefresh
 * Spiegazione: Fa tabula rasa e ricarica i dati del posto scelto.
 * Equivale a un "refresh di pagina" ma per una località specifica.
 */
async function triggerFullRefresh(lat, lng) {
    console.log("Inizio refresh totale per:", lat, lng);
    // 1. Scrive il nome del posto nella barra
    await updateCityName(lat, lng);
    // 2. Chiede l'ora esatta del fuso orario e la scrive negli input
    await syncLocalTime(lat, lng);
    // 3. Con l'ora corretta, scarica il meteo e disegna il sole
    await updateAll();
}

async function syncLocalTime(lat, lng) {
    try {
        const resp = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=time&timezone=auto`);
        const data = await resp.json();
        if (data.current) {
            const parts = data.current.time.split('T');
            document.getElementById('input-date').value = parts[0];
            document.getElementById('input-time').value = parts[1].substring(0, 5);
            document.getElementById('display-hour-center').innerText = parts[1].substring(0, 5);
            return true;
        }
    } catch (e) { console.error("Errore fuso orario:", e); }
    return false;
}

async function handleGpsSync() {
    const btn = document.getElementById('btn-gps');
    btn.innerText = "🛰️ SINCRONIZZAZIONE...";
    
    navigator.geolocation.getCurrentPosition(async (pos) => {
        const lat = pos.coords.latitude.toFixed(4);
        const lng = pos.coords.longitude.toFixed(4);
        document.getElementById('input-lat').value = lat;
        document.getElementById('input-lng').value = lng;

        await triggerFullRefresh(lat, lng);

        btn.innerText = "✅ SINCRONIZZAZIONE RIUSCITA";
        btn.style.background = "#22c55e";
        setTimeout(() => { 
            btn.innerText = "📡 AGGIORNA GPS E ORA ATTUALE ⏱️"; 
            btn.style.background = ""; 
        }, 3000);
    }, (err) => {
        btn.innerText = "❌ ERRORE GPS";
        btn.style.background = "#ef4444";
        setTimeout(() => { btn.innerText = "📡 AGGIORNA GPS E ORA ATTUALE ⏱️"; btn.style.background = ""; }, 3000);
    });
}

async function searchCityCoords(cityName) {
    const cityInput = document.getElementById('city-input');
    try {
        cityInput.style.color = "#fbbf24";
        const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(cityName)}&limit=1`);
        const data = await res.json();
        if (data && data.length > 0) {
            const lat = parseFloat(data[0].lat).toFixed(4);
            const lng = parseFloat(data[0].lon).toFixed(4);
            document.getElementById('input-lat').value = lat;
            document.getElementById('input-lng').value = lng;
            
            await triggerFullRefresh(lat, lng);
            cityInput.style.color = "#38bdf8";
        }
    } catch (e) { cityInput.style.color = "#ef4444"; }
}

async function updateCityName(lat, lng) {
    try {
        const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}`);
        const data = await res.json();
        const city = data.address.city || data.address.town || data.address.village || "POSIZIONE IGNOTA";
        document.getElementById('city-input').value = city.toUpperCase();
    } catch (e) { console.error(e); }
}

/**
 * Funzione: updateAll
 * Spiegazione: Legge i dati dagli input e aggiorna l'intera interfaccia.
 */
async function updateAll() {
    const lat = document.getElementById('input-lat').value;
    const lng = document.getElementById('input-lng').value;
    const date = document.getElementById('input-date').value;
    const time = document.getElementById('input-time').value;
    
    if (!lat || !lng || !date || !time) return;

    try {
        state.weatherData = await WeatherAPI.fetchForecast(lat, lng, date);
        if (!state.weatherData) return;

        const hourIdx = parseInt(time.split(':')[0]);
        const hDec = SolarEngine.timeToDecimal(time);
        const hourly = state.weatherData.hourly;
        const daily = state.weatherData.daily;

        // 1. Aggiorna Alba e Tramonto
        const sunrise = daily.sunrise[0].split('T')[1].substring(0, 5);
        const sunset = daily.sunset[0].split('T')[1].substring(0, 5);
        document.getElementById('sunrise-txt').innerText = sunrise;
        document.getElementById('sunset-txt').innerText = sunset;
        
        // 2. Aggiorna Orologio Centrale
        document.getElementById('display-hour-center').innerText = time;

        // 3. Aggiorna Dati Meteo (Riquadri)
        document.getElementById('r-cloud-percent').innerText = hourly.cloud_cover[hourIdx] + "%";
        document.getElementById('r-temp').innerText = Math.round(hourly.temperature_2m[hourIdx]) + "°";
        document.getElementById('r-hum').innerText = hourly.relative_humidity_2m[hourIdx] + "%";
        document.getElementById('r-wind').innerText = Math.round(hourly.wind_speed_10m[hourIdx]) + " km/h";

        // 4. Calcola e mostra Watt
        const sunH = SolarEngine.timeToDecimal(sunrise);
        const setH = SolarEngine.timeToDecimal(sunset);
        const power = SolarEngine.calculatePower(hDec, sunH, setH, state.panelWp, hourly.cloud_cover[hourIdx]);
        document.getElementById('w_out').innerText = Math.round(power) + " W";

        // 5. Aggiorna Grafica Sole e Grafico Orario
        updateSunUI(hDec, sunH, setH);
        updateReportUI(power, sunH, setH);

    } catch (e) { console.error("Errore aggiornamento interfaccia:", e); }
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

function updateReportUI(currentPower, sunH, setH) {
    const chart = document.getElementById('hourly-chart');
    if (!chart || !state.weatherData) return;

    document.getElementById('charge_80_txt').innerText = SolarEngine.estimateChargeTime(state.currentSOC, 80, currentPower, state.battAh);
    document.getElementById('charge_90_txt').innerText = SolarEngine.estimateChargeTime(state.currentSOC, 90, currentPower, state.battAh);
    document.getElementById('charge_100_txt').innerText = SolarEngine.estimateChargeTime(state.currentSOC, 100, currentPower, state.battAh);
    
    chart.innerHTML = "";
    let total = 0;
    for (let h = Math.floor(sunH); h <= Math.ceil(setH); h++) {
        const p = SolarEngine.calculatePower(h, sunH, setH, state.panelWp, state.weatherData.hourly.cloud_cover[h] || 0);
        total += p;
        const bar = document.createElement('div');
        bar.className = 'bar';
        bar.style.height = (p / state.panelWp * 100) + "%";
        chart.appendChild(bar);
    }
    document.getElementById('total-wh-day').innerText = Math.round(total) + " Wh";
}

function switchView(vId, el) {
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
    const target = document.getElementById('view-' + vId);
    if (target) target.classList.add('active');
    if (el) el.classList.add('active');
}

function editSpec(type) {
    let v = prompt("Inserisci valore:");
    if (v && !isNaN(v)) {
        if (type === 'batt') { state.battAh = v; localStorage.setItem('vibe_batt_ah', v); document.getElementById('batt_val').innerText = v; }
        else { state.panelWp = v; localStorage.setItem('vibe_panel_wp', v); document.getElementById('panel_val').innerText = v; }
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
        const s = document.createElement('div');
        s.className = 'star';
        s.style.left = Math.random() * 100 + '%';
        s.style.top = Math.random() * 60 + '%';
        container.appendChild(s);
    }
}
