/**
 * APP.JS - Versione Integrata (Correzione Taipei + GPS)
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
    // Primo avvio automatico
    document.getElementById('btn-gps').click();
};

function initEventListeners() {
    // 1. NAVIGAZIONE
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', () => switchView(item.dataset.view, item));
    });

    // 2. TASTO GPS
    document.getElementById('btn-gps').addEventListener('click', handleGpsSync);

    // 3. CAMBIO MANUALE LAT/LNG (Aggiorna anche ora locale del posto)
    ['input-lat', 'input-lng'].forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener('change', async () => {
                const lat = document.getElementById('input-lat').value;
                const lng = document.getElementById('input-lng').value;
                if (lat && lng) {
                    await updateCityName(lat, lng);
                    await syncLocalTime(lat, lng); // Sincronizza ora di Taipei/Pisa
                    updateAll(); 
                }
            });
        }
    });

    // 4. CAMBIO MANUALE ORA/DATA
    ['input-time', 'input-date'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('change', updateAll);
    });

    // 5. RICERCA CITTÀ
    const cityInput = document.getElementById('city-input');
    if (cityInput) {
        cityInput.addEventListener('keypress', function (e) {
            if (e.key === 'Enter') {
                searchCityCoords(this.value);
            }
        });
    }

    // 6. CONTROLLI GARAGE & SLIDER
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
 * FUNZIONE CHIAVE: Sincronizza i quadratini Data/Ora e il cerchio centrale
 * con l'ora locale delle coordinate fornite.
 */
async function syncLocalTime(lat, lng) {
    try {
        const resp = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=time&timezone=auto`);
        const data = await resp.json();
        if (data.current) {
            const parts = data.current.time.split('T');
            const localDate = parts[0];
            const localTime = parts[1].substring(0, 5);

            document.getElementById('input-date').value = localDate;
            document.getElementById('input-time').value = localTime;
            document.getElementById('display-hour-center').innerText = localTime;
        }
    } catch (e) {
        console.error("Errore sincronizzazione ora:", e);
    }
}

async function handleGpsSync() {
    const btn = document.getElementById('btn-gps');
    const originalText = "📡 AGGIORNA GPS E ORA ATTUALE ⏱️";
    btn.innerText = "SINCRONIZZAZIONE IN CORSO...";
    btn.disabled = true;

    if (!navigator.geolocation) {
        alert("GPS non supportato");
        btn.disabled = false;
        return;
    }

    navigator.geolocation.getCurrentPosition(async (pos) => {
        const lat = pos.coords.latitude.toFixed(4);
        const lng = pos.coords.longitude.toFixed(4);
        
        document.getElementById('input-lat').value = lat;
        document.getElementById('input-lng').value = lng;

        const now = new Date();
        document.getElementById('input-date').value = now.toISOString().split('T')[0];
        document.getElementById('input-time').value = now.getHours().toString().padStart(2,'0') + ":" + now.getMinutes().toString().padStart(2,'0');

        await updateCityName(lat, lng);
        await updateAll();

        btn.innerText = "✅ SINCRONIZZAZIONE RIUSCITA";
        btn.style.background = "#22c55e";
        setTimeout(() => {
            btn.innerText = originalText;
            btn.style.background = "";
            btn.disabled = false;
        }, 2000);
    }, (err) => {
        btn.innerText = "❌ ERRORE GPS";
        btn.disabled = false;
    });
}

async function updateCityName(lat, lng) {
    const cityInput = document.getElementById('city-input');
    try {
        const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}`);
        const data = await res.json();
        const city = data.address.city || data.address.town || data.address.village || "SCONOSCIUTO";
        if (cityInput) cityInput.value = city.toUpperCase();
    } catch (e) {
        console.error(e);
    }
}

async function searchCityCoords(cityName) {
    const cityInput = document.getElementById('city-input');
    try {
        cityInput.style.color = "#fbbf24";
        const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(cityName)}&limit=1`);
        const data = await res.json();
        if (data.length > 0) {
            const lat = parseFloat(data[0].lat).toFixed(4);
            const lng = parseFloat(data[0].lon).toFixed(4);
            document.getElementById('input-lat').value = lat;
            document.getElementById('input-lng').value = lng;
            cityInput.value = data[0].display_name.split(',')[0].toUpperCase();
            
            await syncLocalTime(lat, lng); // Questo cambia l'ora a Taipei o ovunque
            updateAll();
            cityInput.style.color = "#38bdf8";
        }
    } catch (e) {
        cityInput.style.color = "#ef4444";
    }
}

async function updateAll() {
    const lat = document.getElementById('input-lat').value;
    const lng = document.getElementById('input-lng').value;
    const date = document.getElementById('input-date').value;
    const time = document.getElementById('input-time').value;
    const displayVal = document.getElementById('w_out');

    if (!lat || !lng || !displayVal) return;

    try {
        state.weatherData = await WeatherAPI.fetchForecast(lat, lng, date);
        if (!state.weatherData) return;

        const hourIdx = parseInt(time.split(':')[0]);
        const hDec = SolarEngine.timeToDecimal(time);
        const hourly = state.weatherData.hourly;
        const daily = state.weatherData.daily;

        document.getElementById('sunrise-txt').innerText = daily.sunrise[0].split('T')[1].substring(0, 5);
        document.getElementById('sunset-txt').innerText = daily.sunset[0].split('T')[1].substring(0, 5);
        document.getElementById('display-hour-center').innerText = time;

        document.getElementById('r-cloud-percent').innerText = hourly.cloud_cover[hourIdx] + "%";
        document.getElementById('r-temp').innerText = Math.round(hourly.temperature_2m[hourIdx]) + "°";
        document.getElementById('r-hum').innerText = hourly.relative_humidity_2m[hourIdx] + "%";
        document.getElementById('r-wind').innerText = Math.round(hourly.wind_speed_10m[hourIdx]) + " km/h";

        const sunH = SolarEngine.timeToDecimal(document.getElementById('sunrise-txt').innerText);
        const setH = SolarEngine.timeToDecimal(document.getElementById('sunset-txt').innerText);
        
        const power = SolarEngine.calculatePower(hDec, sunH, setH, state.panelWp, hourly.cloud_cover[hourIdx]);
        displayVal.innerText = Math.round(power) + " W";

        if (typeof updateSunUI === 'function') updateSunUI(hDec, sunH, setH);
        updateReportUI(power, sunH, setH);

    } catch (e) { console.error(e); }
}

// --- MANTENGO LE TUE FUNZIONI DI SUPPORTO (Report, Garage, Stars, SunUI) ---
function updateReportUI(currentPower, sunH, setH) {
    const chart = document.getElementById('hourly-chart');
    const totalDisplay = document.getElementById('total-wh-day');
    if (!chart || !state.weatherData) return;

    document.getElementById('charge_80_txt').innerText = SolarEngine.estimateChargeTime(state.currentSOC, 80, currentPower, state.battAh);
    document.getElementById('charge_90_txt').innerText = SolarEngine.estimateChargeTime(state.currentSOC, 90, currentPower, state.battAh);
    document.getElementById('charge_100_txt').innerText = SolarEngine.estimateChargeTime(state.currentSOC, 100, currentPower, state.battAh);

    chart.innerHTML = "";
    let dailyTotal = 0;
    for (let h = Math.floor(sunH); h <= Math.ceil(setH); h++) {
        const cloud = state.weatherData.hourly.cloud_cover[h] || 0;
        const hP = SolarEngine.calculatePower(h, sunH, setH, state.panelWp, cloud);
        dailyTotal += hP;
        const bar = document.createElement('div');
        bar.className = 'bar';
        bar.style.height = Math.max(5, (hP / state.panelWp * 100)) + "%";
        chart.appendChild(bar);
    }
    if (totalDisplay) totalDisplay.innerText = Math.round(dailyTotal) + " Wh";
}

function switchView(vId, el) {
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
    document.getElementById('view-' + vId).classList.add('active');
    if (el) el.classList.add('active');
}

function editSpec(type) {
    let v = prompt(type === 'batt' ? "Ah Batteria:" : "Watt Pannelli (Wp):");
    if (v && !isNaN(v)) {
        if (type === 'batt') {
            state.battAh = parseFloat(v);
            localStorage.setItem('vibe_batt_ah', v);
            document.getElementById('batt_val').innerText = v;
        } else {
            state.panelWp = parseFloat(v);
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
    container.innerHTML = "";
    for (let i = 0; i < 50; i++) {
        const star = document.createElement('div');
        star.className = 'star';
        star.style.left = Math.random() * 100 + '%';
        star.style.top = Math.random() * 60 + '%';
        star.appendChild(container); // Correzione sintassi
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
        sky.style.background = (progress < 0.2 || progress > 0.8) 
            ? "linear-gradient(to bottom, #f59e0b, #7c2d12)" 
            : "linear-gradient(to bottom, #38bdf8, #1d4ed8)";
    }
}
