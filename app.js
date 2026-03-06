/**
 * APP.JS - Versione Integrale con Fix Nav Bar e Glow
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
    // --- AGGIUNTA: Ripristino unità Ah/Wh ---
    const savedBattUnit = localStorage.getItem('vibe_batt_unit') || 'Ah';
    const savedPsUnit = localStorage.getItem('vibe_ps_unit') || 'Wh';
    
    if(document.getElementById('batt_unit')) {
        document.getElementById('batt_unit').value = savedBattUnit;
    }
    if(document.getElementById('ps_unit')) {
        document.getElementById('ps_unit').value = savedPsUnit;
    }
    // Aggiorna le scritte di conversione (es. "Capacità stimata...") subito all'avvio
    if (typeof updateConversions === 'function') updateConversions();
    // ----------------------------------------
    setupStars();
    generaBottoniGiorni();
    
    // 1. ATTIVAZIONE NAV BAR: Mostra la Dashboard (live) all'avvio
    switchView('live', document.querySelector('[data-view="live"]')); // <--- FIX NAV BAR

    // 2. Avvio automatico dati
    const gpsBtn = document.getElementById('btn-gps');
    if (gpsBtn) gpsBtn.click();
};

function initEventListeners() {
    // Navigazione
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', () => switchView(item.dataset.view, item));
    });
    
    document.getElementById('btn-gps').addEventListener('click', handleGpsSync);

    const cityInput = document.getElementById('city-input');
    if (cityInput) {
        cityInput.addEventListener('change', function () {
            const query = this.value.trim();
            if (query.length >= 3) searchCityCoords(query);
        });
    }

    ['input-time', 'input-date', 'input-lat', 'input-lng'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('change', updateAll);
    });

    document.getElementById('btn-save-name').onclick = saveGarageSettings;
    document.getElementById('edit-batt-btn').onclick = () => editSpec('batt');
    document.getElementById('edit-pan-btn').onclick = () => editSpec('pan');
    document.getElementById('edit-ps-btn').onclick = () => editSpec('ps');
    document.getElementById('edit-pan-ps-btn').onclick = () => editSpec('panPs');

    // --- AGGIUNTA PER GESTIONE UNITÀ Ah/Wh ---
    // Questi "ascoltano" quando cambi la scelta nel menu a tendina del Garage
    document.getElementById('batt_unit').onchange = () => {
        localStorage.setItem('vibe_batt_unit', document.getElementById('batt_unit').value);
        if (typeof updateConversions === 'function') updateConversions();
        if (typeof updateChargeReports === 'function') updateChargeReports();
    };

    document.getElementById('ps_unit').onchange = () => {
        localStorage.setItem('vibe_ps_unit', document.getElementById('ps_unit').value);
        if (typeof updateConversions === 'function') updateConversions();
        if (typeof updateChargeReports === 'function') updateChargeReports();
    };
}

// --- FUNZIONE GPS CON RIPRISTINO GLOW ---
async function handleGpsSync() {
    isGpsSyncing = true;
    const btn = document.getElementById('btn-gps');
    if (!btn) return;

    btn.disabled = true;
    btn.innerText = "🛰️ RICERCA POSIZIONE...";

    try {
        const coords = await WeatherAPI.getUserLocation();
        const now = new Date();
        
        document.getElementById('input-lat').value = coords.latitude.toFixed(4);
        document.getElementById('input-lng').value = coords.longitude.toFixed(4);
        document.getElementById('input-time').value = now.getHours().toString().padStart(2,'0') + ":" + now.getMinutes().toString().padStart(2,'0');
        
        dataSelezionata = new Date();
        generaBottoniGiorni();
        aggiornaTuttaInterfaccia();

        // --- EFFETTO GLOW ---
        btn.innerText = "✅ SINCRONIZZAZIONE RIUSCITA";
        btn.style.background = "#22c55e"; 
        btn.style.boxShadow = "0 0 20px #22c55e"; // <--- RIPRISTINO GLOW
        btn.style.borderColor = "#4ade80";

    } catch (err) {
        btn.innerText = "❌ ERRORE GPS";
        btn.style.background = "#ef4444";
        btn.style.boxShadow = "0 0 20px #ef4444"; // <--- GLOW ROSSO ERRORE
    } finally {
        btn.disabled = false;
        isGpsSyncing = false;
        
        setTimeout(() => { 
            btn.innerText = "📡 AGGIORNA GPS E ORA ATTUALE"; 
            btn.style.background = ""; 
            btn.style.boxShadow = ""; // <--- SPEGNE GLOW
            btn.style.borderColor = "";
        }, 3000);
    }
}

// --- TUTTO IL RESTO RIMANE INVARIATO (LOGICA E CALCOLI) ---

async function updateAll() {
    const lat = document.getElementById('input-lat').value;
    const lng = document.getElementById('input-lng').value;
    const date = dataSelezionata.toISOString().split('T')[0];
    const time = document.getElementById('input-time').value;
    const displayVal = document.getElementById('w_out');
    if (!lat || !lng || !displayVal) return;

    try {
        if (isGpsSyncing) await updateCityName(lat, lng); 
        state.weatherData = await WeatherAPI.fetchForecast(lat, lng, date);
        if (!state.weatherData) return;

        const hourIdx = parseInt(time.split(':')[0]);
        const hDec = SolarEngine.timeToDecimal(time);
        const hourly = state.weatherData.hourly;
        const daily = state.weatherData.daily;

        // --- INIZIO AGGIORNAMENTO BADGE METEO ---
        // Preleviamo i dati dall'oggetto 'hourly' dell'API usando l'indice dell'ora (hourIdx)
        if (document.getElementById('r-wind')) 
            document.getElementById('r-wind').innerText = Math.round(hourly.wind_speed_10m[hourIdx]) + " km/h";

        if (document.getElementById('r-hum')) 
            document.getElementById('r-hum').innerText = hourly.relative_humidity_2m[hourIdx] + "%";

        if (document.getElementById('r-temp')) 
            document.getElementById('r-temp').innerText = Math.round(hourly.temperature_2m[hourIdx]) + "°C";

        if (document.getElementById('r-cloud-percent')) 
            document.getElementById('r-cloud-percent').innerText = hourly.cloud_cover[hourIdx] + "%";
        // --- FINE AGGIORNAMENTO BADGE METEO ---

        const sunrise = daily.sunrise[0].split('T')[1].substring(0, 5);
        const sunset = daily.sunset[0].split('T')[1].substring(0, 5);
        
        document.getElementById('sunrise-txt').innerText = sunrise;
        document.getElementById('sunset-txt').innerText = sunset;
        document.getElementById('display-hour-center').innerText = time;

        const sunH = SolarEngine.timeToDecimal(sunrise);
        const setH = SolarEngine.timeToDecimal(sunset);

        // Calcolo delle potenze basato sulla copertura nuvolosa attuale
        const pServices = SolarEngine.calculatePower(hDec, sunH, setH, state.panelWp, hourly.cloud_cover[hourIdx]);
        const pPS = SolarEngine.calculatePower(hDec, sunH, setH, state.panelPsWp, hourly.cloud_cover[hourIdx]);
        const totalPower = pServices + pPS;

        displayVal.innerText = Math.round(totalPower) + " W";
        if (document.getElementById('w_services')) document.getElementById('w_services').innerText = Math.round(pServices) + " W";
        if (document.getElementById('w_ps')) document.getElementById('w_ps').innerText = Math.round(pPS) + " W";

        updateSunUI(hDec, sunH, setH);
        updateReportUI(totalPower, sunH, setH);
    } catch (e) { console.error("Errore nel caricamento dati:", e); }
}

function updateReportUI(currentPower, sunH, setH) {
    const chart = document.getElementById('hourly-chart');
    const totalDisplay = document.getElementById('total-wh-day');
    if (!chart || !state.weatherData) return;

    const capS = state.battAh || 0;
    const capPS = state.psAh || 0;

    if (capPS > 0) {
        document.getElementById('ps_charge_80_txt').innerText = SolarEngine.estimateChargeTime(state.currentPsSOC, 80, currentPower, capPS);
        document.getElementById('ps_charge_90_txt').innerText = SolarEngine.estimateChargeTime(state.currentPsSOC, 90, currentPower, capPS);
        document.getElementById('ps_charge_100_txt').innerText = SolarEngine.estimateChargeTime(state.currentPsSOC, 100, currentPower, capPS);
    }
    if (capS > 0) {
        document.getElementById('batt_charge_80_txt').innerText = SolarEngine.estimateChargeTime(state.currentSOC, 80, currentPower, capS);
        document.getElementById('batt_charge_90_txt').innerText = SolarEngine.estimateChargeTime(state.currentSOC, 90, currentPower, capS);
        document.getElementById('batt_charge_100_txt').innerText = SolarEngine.estimateChargeTime(state.currentSOC, 100, currentPower, capS);
    }

    chart.innerHTML = "";
    let dailyTotal = 0;
    const startH = Math.floor(sunH);
    const endH = Math.ceil(setH);

    for (let h = startH; h <= endH; h++) {
        const cloud = state.weatherData.hourly.cloud_cover[h] || 0;
        const hP = SolarEngine.calculatePower(h, sunH, setH, state.panelWp, cloud);
        dailyTotal += hP;
        const bar = document.createElement('div');
        bar.className = 'bar';
        bar.style.height = Math.max(5, (hP / (state.panelWp || 1) * 100)) + "%";
        bar.onclick = () => {
            document.querySelectorAll('.bar').forEach(b => b.classList.remove('active'));
            bar.classList.add('active');
            const detailBox = document.getElementById('detail-display');
            if (detailBox) detailBox.innerHTML = `<span style="color:#fbbf24;">ORE ${h}:00 → ${Math.round(hP)} W</span>`;
            setTimeout(() => { bar.classList.remove('active'); resetDetailDisplay(); }, 2000);
        };
        chart.appendChild(bar);
    }
    if (totalDisplay) totalDisplay.innerText = Math.round(dailyTotal) + " Wh";
}

function switchView(vId, el) {
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
    const target = document.getElementById('view-' + vId);
    if (target) target.classList.add('active');
    if (el) el.classList.add('active');
}

function initSliders() {
    const sliders = [{ id: 'ps-soc-slider', valId: 'ps-soc-val', stateKey: 'currentPsSOC' }, { id: 'soc-slider', valId: 'soc-val', stateKey: 'currentSOC' }];
    sliders.forEach(s => {
        const el = document.getElementById(s.id);
        if (el) {
            el.addEventListener('input', (e) => {
                state[s.stateKey] = e.target.value;
                if (document.getElementById(s.valId)) document.getElementById(s.valId).innerText = e.target.value + "%";
                updateSliderFill(el);
                updateAll();
            });
            updateSliderFill(el);
        }
    });
}

function updateSliderFill(slider) { slider.style.setProperty('--value', slider.value + '%'); }

function editSpec(type) {
    // 1. Identifichiamo il valore attuale e l'unità di misura selezionata
    let current = type === 'batt' ? state.battAh : 
                  type === 'pan' ? state.panelWp : 
                  type === 'ps' ? state.psAh : state.panelPsWp;
    // Recuperiamo l'unità (se è batteria o PS) per mostrarla nel prompt
    let unitLabel = "";
    if (type === 'batt') unitLabel = document.getElementById('batt_unit').value;
    else if (type === 'ps') unitLabel = document.getElementById('ps_unit').value;
    else unitLabel = "W"; // Per i pannelli è sempre Watt
    // 2. Chiediamo il valore includendo l'unità nel messaggio
    let v = prompt(`Inserisci valore (${unitLabel}):`, current);
    if (v !== null && v !== "" && !isNaN(v)) {
        if (type === 'batt') state.battAh = parseFloat(v);
        else if (type === 'pan') state.panelWp = parseFloat(v);
        else if (type === 'ps') state.psAh = parseFloat(v);
        else if (type === 'panPs') state.panelPsWp = parseFloat(v);
        // 3. Salviamo e ricarichiamo i dati a video
        saveGarageSettings();
        loadSavedData();
        // 4. AGGIUNTA: Forza l'aggiornamento immediato delle conversioni (Wh/Ah) e dei report
        if (typeof updateConversions === 'function') updateConversions();
        if (typeof updateChargeReports === 'function') updateChargeReports();
    }
}
/**
 * Calcola e scrive la conversione Wh/Ah subito sotto i valori principali nel Garage.
 * Utilizza il coefficiente 12.8V per batterie LiFePO4.
 */
function updateConversions() {
    // 1. GESTIONE BATTERIA SERVIZIO
    const bVal = parseFloat(document.getElementById('batt_val').innerText) || 0;
    const bUnit = document.getElementById('batt_unit').value;
    const bConvVal = document.getElementById('batt_conv_val');

    if (bConvVal) {
        if (bUnit === "Ah") {
            // Se inserisci Ah, calcola i Wh
            bConvVal.innerText = Math.round(bVal * 12.8);
            bConvVal.nextSibling.textContent = " Wh";
        } else {
            // Se inserisci Wh, calcola gli Ah
            bConvVal.innerText = Math.round(bVal / 12.8);
            bConvVal.nextSibling.textContent = " Ah";
        }
    }

    // 2. GESTIONE POWER STATION
    const pVal = parseFloat(document.getElementById('ps_val').innerText) || 0;
    const pUnit = document.getElementById('ps_unit').value;
    const pConvVal = document.getElementById('ps_conv_val');

    if (pConvVal) {
        if (pUnit === "Ah") {
            pConvVal.innerText = Math.round(pVal * 12.8);
            pConvVal.nextSibling.textContent = " Wh";
        } else {
            pConvVal.innerText = Math.round(pVal / 12.8);
            pConvVal.nextSibling.textContent = " Ah";
        }
    }
}

/**
 * Calcola i tempi di ricarica per il Report basandosi sulle unità scelte
 */
function updateChargeReports() {
    const wattServizi = parseFloat(document.getElementById('w_services')?.innerText) || 0;
    const wattPS = parseFloat(document.getElementById('w_ps')?.innerText) || 0;
    
    // Capacità in Wh (moneta comune per il calcolo)
    const bUnit = document.getElementById('batt_unit').value;
    const pUnit = document.getElementById('ps_unit').value;
    
    const capS_Wh = bUnit === "Ah" ? (state.battAh * 12.8) : state.battAh;
    const capPS_Wh = pUnit === "Ah" ? (state.psAh * 12.8) : state.psAh;

    // Aggiorna i testi nel report chiamando la tua funzione esistente nel SolarEngine
    // Nota: SolarEngine.estimateChargeTime deve essere aggiornato per gestire Wh se passi Wh
    if (capPS_Wh > 0) {
        document.getElementById('ps_charge_80_txt').innerText = SolarEngine.estimateChargeTime(state.currentPsSOC, 80, wattPS, capPS_Wh / 12.8);
        document.getElementById('ps_charge_90_txt').innerText = SolarEngine.estimateChargeTime(state.currentPsSOC, 90, wattPS, capPS_Wh / 12.8);
        document.getElementById('ps_charge_100_txt').innerText = SolarEngine.estimateChargeTime(state.currentPsSOC, 100, wattPS, capPS_Wh / 12.8);
    }
    
    if (capS_Wh > 0) {
        document.getElementById('batt_charge_80_txt').innerText = SolarEngine.estimateChargeTime(state.currentSOC, 80, wattServizi, capS_Wh / 12.8);
        document.getElementById('batt_charge_90_txt').innerText = SolarEngine.estimateChargeTime(state.currentSOC, 90, wattServizi, capS_Wh / 12.8);
        document.getElementById('batt_charge_100_txt').innerText = SolarEngine.estimateChargeTime(state.currentSOC, 100, wattServizi, capS_Wh / 12.8);
    }
}
function saveGarageSettings() {
    // 1. Preleviamo il valore dall'input
    const nameInput = document.getElementById('camper_name_input');
    const name = nameInput.value.trim();
    // 2. Salvataggio nel localStorage
    localStorage.setItem('vibe_camper_name', name);
    localStorage.setItem('vibe_batt_ah', state.battAh);
    localStorage.setItem('vibe_panel_wp', state.panelWp);
    localStorage.setItem('vibe_ps_ah', state.psAh);
    localStorage.setItem('vibe_ps_panel_wp', state.panelPsWp);
    // 3. Aggiornamento istantaneo del titolo in alto
    const display = document.getElementById('camper-name-display');
    if (display && name !== "") {
        display.innerText = name.toUpperCase();
    }
    // 4. EFFETTO GLOW VERDE DI CONFERMA
    const saveBtn = document.getElementById('btn-save-name');
    if (saveBtn) {
        // Applichiamo lo stile di successo (Glow Verde)
        saveBtn.style.transition = "all 0.3s ease"; // Rende l'effetto fluido
        saveBtn.style.background = "#16a34a";       // Verde scuro
        saveBtn.style.boxShadow = "0 0 20px #22c55e"; // Bagliore verde neon
        saveBtn.style.borderColor = "#4ade80";      // Bordo più chiaro
        // Dopo 1.5 secondi torna allo stile originale
        setTimeout(() => {
            saveBtn.style.background = ""; 
            saveBtn.style.boxShadow = "";
            saveBtn.style.borderColor = "";
        }, 1500);
    }

    updateAll();
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
        btn.onclick = () => { dataSelezionata = new Date(d); generaBottoniGiorni(); aggiornaTuttaInterfaccia(); };
        container.appendChild(btn);
    }
}

function aggiornaTuttaInterfaccia() {
    const inputDate = document.getElementById('input-date');
    if (inputDate) inputDate.value = dataSelezionata.toISOString().split('T')[0];
    updateAll();
}

async function updateCityName(lat, lng) {
    try {
        const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&accept-language=it`);
        const data = await response.json();
        const city = data.address.city || data.address.town || data.address.village || "POSIZIONE GPS";
        document.getElementById('city-input').value = city.toUpperCase();
    } catch (e) { console.error(e); }
}

async function searchCityCoords(cityName) {
    try {
        const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(cityName)}&limit=1`);
        const data = await response.json();
        if (data && data.length > 0) {
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

function resetDetailDisplay() {
    const display = document.getElementById('detail-display');
    if (display) display.innerHTML = `<span style="color:#fbbf24;">TOCCA UNA BARRA PER I DETTAGLI</span>`;
}
/**
 
/**
 * Cambia il tema dell'app aggiungendo la classe corrispondente al body.
 * Sfrutta le variabili CSS già definite nel foglio di stile.
 * @param {string} color - Il codice colore esagonale passato dall'HTML
 */
function changeBg(color) {
    // 1. Rimuoviamo tutte le classi tema precedenti per evitare conflitti
    document.body.classList.remove('tema-verde', 'tema-rosso', 'tema-grigio');
    
    // 2. In base al colore cliccato, aggiungiamo la classe corretta
    // Nota: il tema blu (default) non ha bisogno di classe perché è nel :root
    if (color === '#062c1f') {
        document.body.classList.add('tema-verde');
    } else if (color === '#2d0a1a') {
        document.body.classList.add('tema-rosso');
    } else if (color === '#1a1a1a') {
        document.body.classList.add('tema-grigio');
    }
    
    // 3. Forziamo comunque il background-color per sicurezza (opzionale)
    document.body.style.backgroundColor = color;

    // 4. Salviamo la scelta nel browser
    localStorage.setItem('vibe_solar_bg_color', color);
}

// Al caricamento, ripristiniamo il tema salvato
window.addEventListener('DOMContentLoaded', () => {
    const saved = localStorage.getItem('vibe_solar_bg_color');
    if (saved) changeBg(saved);
});
