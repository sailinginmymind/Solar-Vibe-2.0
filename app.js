/**
 * APP.JS - FIX DEFINITIVO FUSO ORARIO
 * Forza l'app a usare l'ora calcolata per le coordinate, ignorando quella del PC.
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
    
    // Al caricamento cerchiamo subito la posizione reale
    setTimeout(() => {
        const btnGps = document.getElementById('btn-gps');
        if (btnGps) btnGps.click();
    }, 500);
};

function initEventListeners() {
    // 1. NAVIGAZIONE
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', () => switchView(item.dataset.view, item));
    });

    // 2. TASTO GPS
    document.getElementById('btn-gps').addEventListener('click', handleGpsSync);

    // 3. INSERIMENTO MANUALE COORDINATE (Refresh Totale)
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

    // 4. RICERCA CITTÀ (Refresh Totale)
    const cityInput = document.getElementById('city-input');
    if (cityInput) {
        cityInput.addEventListener('keypress', function (e) {
            if (e.key === 'Enter') searchCityCoords(this.value);
        });
    }

    // 5. CAMBIO MANUALE ORA/DATA
    ['input-time', 'input-date'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('change', updateAll);
    });

    // 6. GARAGE
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
 * TRIGGER FULL REFRESH
 * Questa funzione è il comando "Reset Totale" che cercavi.
 * Ordine: Coordinate -> Nome Posto -> Fuso Orario -> Meteo/Sole.
 */
async function triggerFullRefresh(lat, lng) {
    // 1. Trova nome città
    await updateCityName(lat, lng);
    // 2. Chiedi l'ora esatta di QUELLE coordinate (fondamentale per i fusi orari)
    await syncLocalTime(lat, lng);
    // 3. Una volta che l'ora è scritta negli input, aggiorna tutto il resto
    await updateAll();
}

async function syncLocalTime(lat, lng) {
    try {
        const resp = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=time&timezone=auto`);
        const data = await resp.json();
        if (data.current) {
            const parts = data.current.time.split('T');
            const localDate = parts[0];
            const localTime = parts[1].substring(0, 5);

            // Scriviamo l'ora del fuso orario negli input
            document.getElementById('input-date').value = localDate;
            document.getElementById('input-time').value = localTime;
            // E la mostriamo nel display centrale
            document.getElementById('display-hour-center').innerText = localTime;
            return true;
        }
    } catch (e) { console.error("Errore API Fuso Orario:", e); }
    return false;
}

async function handleGpsSync() {
    const btn = document.getElementById('btn-gps');
    const originalText = "📡 AGGIORNA GPS E ORA ATTUALE ⏱️";
    btn.innerText = "🛰️ SINCRONIZZAZIONE...";
    btn.disabled = true;
    
    navigator.geolocation.getCurrentPosition(async (pos) => {
        const lat = pos.coords.latitude.toFixed(4);
        const lng = pos.coords.longitude.toFixed(4);
        document.getElementById('input-lat').value = lat;
        document.getElementById('input-lng').value = lng;

        // Se è il GPS, carichiamo prima l'ora del posto (così l'app sa se siamo a casa o all'estero)
        await triggerFullRefresh(lat, lng);

        btn.innerText = "✅ SINCRONIZZAZIONE RIUSCITA";
        btn.style.background = "#22c55e";
        btn.disabled = false;
        setTimeout(() => { btn.innerText = originalText; btn.style.background = ""; }, 3000);
    }, (err) => {
        btn.innerText = "❌ ERRORE GPS";
        btn.style.background = "#ef4444";
        btn.disabled = false;
        setTimeout(() => { btn.innerText = originalText; btn.style.background = ""; }, 3000);
    });
}

async function searchCityCoords(cityName) {
    const cityInput = document.getElementById('city-input');
    try {
        const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(cityName)}&limit=1`);
        const data = await res.json();
        if (data && data.length > 0) {
            const lat = parseFloat(data[0].lat).toFixed(4);
            const lng = parseFloat(data[0].lon).toFixed(4);
            document.getElementById('input-lat').value = lat;
            document.getElementById('input-lng').value = lng;
            
            await triggerFullRefresh(lat, lng);
        }
    } catch (e) { console.error(e); }
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
 * UPDATE ALL
 * Fondamentale: legge l'ora SOLO dall'input, non dal PC.
 */
async function updateAll() {
    const lat = document.getElementById('input-lat').value;
    const lng = document.getElementById('input-lng').value;
    const date = document.getElementById('input-date').value;
    const time = document.getElementById('input-time').value; // <--- Legge l'ora scritta (es. quella di Taipei)
    
    if (!lat || !lng || !time) return;

    try {
        state.weatherData = await WeatherAPI.fetchForecast(lat, lng, date);
        if (!state.weatherData) return;

        const hourIdx = parseInt(time.split(':')[0]);
        const hDec = SolarEngine.timeToDecimal(time);
        const daily = state.weatherData.daily;
        const hourly = state.weatherData.hourly;

        // Aggiorna Alba/Tramonto del posto
        const sunrise = daily.sunrise[0].split('T')[1].substring(0, 5);
        const sunset = daily.sunset[0].split('T')[1].substring(0, 5);
        document.getElementById('sunrise-txt').innerText = sunrise;
        document.getElementById('sunset-txt').innerText = sunset;
        
        // Aggiorna l'orologio centrale con l'ora dell'input
        document.getElementById('display-hour-center').innerText = time;

        // Meteo
        document.getElementById('r-cloud-percent').innerText = hourly.cloud_cover[hourIdx] + "%";
        document.getElementById('r-temp').innerText = Math.round(hourly.temperature_2m[hourIdx]) + "°";
        document.getElementById('r-hum').innerText = hourly.relative_humidity_2m[hourIdx] + "%";
        document.getElementById('r-wind').innerText = Math.round(hourly.wind_speed_10m[hourIdx]) + " km/h";

        // Sole e Watt
        const sunH = SolarEngine.timeToDecimal(sunrise);
        const setH = SolarEngine.timeToDecimal(sunset);
        const power = SolarEngine.calculatePower(hDec, sunH, setH, state.panelWp, hourly.cloud_cover[hourIdx]);
        document.getElementById('w_out').innerText = Math.round(power) + " W";

        updateSunUI(hDec, sunH, setH);
        updateReportUI(power, sunH, setH);
    } catch (e) { console.error(e); }
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
