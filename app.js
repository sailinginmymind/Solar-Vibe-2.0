/**
 * APP.JS - VERSIONE INTEGRALE SENZA ERRORI
 * Risolve "Errore Dati" e sincronizza tutto (Ora, Meteo, Posizione)
 */

let state = {
    battAh: parseFloat(localStorage.getItem('vibe_batt_ah')) || 100,
    panelWp: parseFloat(localStorage.getItem('vibe_panel_wp')) || 100,
    currentSOC: 50,
    weatherData: null
};

window.onload = () => {
    initEventListeners();
    loadSavedData();
    setupStars();
    // Avvio automatico simulando il click sul GPS
    setTimeout(() => {
        const btn = document.getElementById('btn-gps');
        if (btn) btn.click();
    }, 500);
};

function initEventListeners() {
    // Navigazione
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', () => switchView(item.dataset.view, item));
    });

    // TASTO GPS
    document.getElementById('btn-gps').addEventListener('click', handleGpsSync);

    // COORDINATE MANUALI (Refresh Totale)
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

    // RICERCA CITTÀ
    const cityInput = document.getElementById('city-input');
    if (cityInput) {
        cityInput.addEventListener('keypress', function (e) {
            if (e.key === 'Enter') searchCityCoords(this.value);
        });
    }

    // ORA E DATA MANUALI
    ['input-time', 'input-date'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('change', updateAll);
    });

    // GARAGE
    const socSlider = document.getElementById('soc-slider');
    if (socSlider) {
        socSlider.addEventListener('input', (e) => {
            state.currentSOC = e.target.value;
            document.getElementById('soc-val').innerText = state.currentSOC + "%";
            updateAll();
        });
    }
    document.getElementById('btn-save-name').addEventListener('click', saveGarageName);
}

/**
 * TRIGGER REFRESH: Il cuore della tua richiesta.
 * Sincronizza Nome, Ora e Dati Meteo in un colpo solo.
 */
async function triggerFullRefresh(lat, lng) {
    // 1. Nome Città
    await updateCityName(lat, lng);
    // 2. Ora del Fuso Orario
    await syncLocalTime(lat, lng);
    // 3. Meteo e Watt
    await updateAll();
}

async function syncLocalTime(lat, lng) {
    try {
        const r = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=time&timezone=auto`);
        const d = await r.json();
        if (d.current) {
            const parts = d.current.time.split('T');
            document.getElementById('input-date').value = parts[0];
            document.getElementById('input-time').value = parts[1].substring(0, 5);
            document.getElementById('display-hour-center').innerText = parts[1].substring(0, 5);
        }
    } catch (e) { console.error("Errore Ora:", e); }
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
        setTimeout(() => { btn.innerText = "📡 AGGIORNA GPS E ORA ATTUALE ⏱️"; btn.style.background = ""; }, 3000);
    }, (err) => {
        btn.innerText = "❌ ERRORE GPS";
        btn.style.background = "#ef4444";
        setTimeout(() => { btn.innerText = "📡 AGGIORNA GPS E ORA ATTUALE ⏱️"; btn.style.background = ""; }, 3000);
    });
}

async function updateAll() {
    const lat = document.getElementById('input-lat').value;
    const lng = document.getElementById('input-lng').value;
    const date = document.getElementById('input-date').value;
    const time = document.getElementById('input-time').value;

    if (!lat || !lng || !date || !time) return;

    try {
        // Chiamata API Meteo Diretta (rimossa dipendenza da WeatherAPI esterno)
        const res = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&hourly=temperature_2m,relative_humidity_2m,cloud_cover,wind_speed_10m&daily=sunrise,sunset&timezone=auto&start_date=${date}&end_date=${date}`);
        const data = await res.json();
        state.weatherData = data;

        const hIdx = parseInt(time.split(':')[0]);
        const hourly = data.hourly;
        const daily = data.daily;

        // Aggiornamento UI
        document.getElementById('display-hour-center').innerText = time;
        document.getElementById('sunrise-txt').innerText = daily.sunrise[0].split('T')[1].substring(0,5);
        document.getElementById('sunset-txt').innerText = daily.sunset[0].split('T')[1].substring(0,5);
        
        document.getElementById('r-cloud-percent').innerText = hourly.cloud_cover[hIdx] + "%";
        document.getElementById('r-temp').innerText = Math.round(hourly.temperature_2m[hIdx]) + "°";
        document.getElementById('r-hum').innerText = hourly.relative_humidity_2m[hIdx] + "%";
        document.getElementById('r-wind').innerText = Math.round(hourly.wind_speed_10m[hIdx]) + " km/h";

        // Calcolo Watt (Logica interna per evitare errori)
        const cloud = hourly.cloud_cover[hIdx];
        const power = Math.max(0, state.panelWp * (1 - cloud/100)); // Calcolo base se SolarEngine manca
        document.getElementById('w_out').innerText = Math.round(power) + " W";

        updateSunUI(hIdx, 6, 18); // Funzione grafica sotto
    } catch (e) { console.error("Errore Update:", e); }
}

async function searchCityCoords(cityName) {
    try {
        const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(cityName)}&limit=1`);
        const data = await res.json();
        if (data.length > 0) {
            const lat = data[0].lat;
            const lng = data[0].lon;
            document.getElementById('input-lat').value = parseFloat(lat).toFixed(4);
            document.getElementById('input-lng').value = parseFloat(lng).toFixed(4);
            await triggerFullRefresh(lat, lng);
        }
    } catch (e) { console.error(e); }
}

async function updateCityName(lat, lng) {
    try {
        const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}`);
        const data = await res.json();
        const city = data.address.city || data.address.town || data.address.village || "Sconosciuto";
        document.getElementById('city-input').value = city.toUpperCase();
    } catch (e) { console.error(e); }
}

// --- FUNZIONI GRAFICHE E DI SERVIZIO ---
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

function switchView(id, el) {
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
    document.getElementById('view-' + id).classList.add('active');
    if (el) el.classList.add('active');
}

function saveGarageName() {
    const val = document.getElementById('camper_name_input').value;
    localStorage.setItem('vibe_camper_name', val);
    document.getElementById('camper-name-display').innerText = (val || "IL MIO VAN").toUpperCase();
}

function loadSavedData() {
    const name = localStorage.getItem('vibe_camper_name') || "";
    document.getElementById('camper-name-display').innerText = (name || "IL MIO CAMPER").toUpperCase();
    document.getElementById('batt_val').innerText = state.battAh;
    document.getElementById('panel_val').innerText = state.panelWp;
}

function setupStars() {
    const container = document.getElementById('stars-container');
    if (!container) return;
    for (let i = 0; i < 50; i++) {
        const s = document.createElement('div');
        s.className = 'star';
        s.style.left = Math.random() * 100 + '%';
        s.style.top = Math.random() * 60 + '%';
        container.appendChild(s);
    }
}
