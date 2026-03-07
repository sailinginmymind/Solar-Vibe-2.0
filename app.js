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
    
    // 1. Carichiamo i dati salvati (Nome, Ah e Watt)
    loadSavedData();
    
    // 2. SINCRONIZZAZIONE AVVIO
    // Calcoliamo subito i Wh basandoci sui Ah appena caricati
    if (typeof updateConversions === 'function') updateConversions();
    
    // Ricalcoliamo tutta l'interfaccia (Meteo e Report) con i dati salvati
    if (typeof updateAll === 'function') updateAll();
    
    // 3. Estetica e Giorni
    setupStars();
    generaBottoniGiorni();
    
    // 4. ATTIVAZIONE NAV BAR: Mostra la Dashboard all'avvio
    switchView('live', document.querySelector('[data-view="live"]'));

    // 5. Avvio automatico dati GPS
    const gpsBtn = document.getElementById('btn-gps');
    if (gpsBtn) gpsBtn.click();
};

/**
 * Inizializza tutti i collegamenti ai tasti e agli input.
 * Spiegazione: Ho rimosso i riferimenti a 'batt_unit' e 'ps_unit' perché 
 * abbiamo eliminato i menu a tendina. Ho anche rimosso i collegamenti 
 * via ID per i tasti EDIT, dato che ora usiamo l'onclick diretto nell'HTML.
 */
function initEventListeners() {
    // 1. Navigazione tra le schermate (Dashboard, Report, Garage)
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', () => switchView(item.dataset.view, item));
    });
    
    // 2. Tasto GPS
    const gpsBtn = document.getElementById('btn-gps');
    if (gpsBtn) gpsBtn.addEventListener('click', handleGpsSync);

    // 3. Ricerca città manuale
    const cityInput = document.getElementById('city-input');
    if (cityInput) {
        cityInput.addEventListener('change', function () {
            const query = this.value.trim();
            if (query.length >= 3) searchCityCoords(query);
        });
    }

    // 4. Input manuali (Ora, Data, Coordinate)
    ['input-time', 'input-date', 'input-lat', 'input-lng'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('change', updateAll);
    });

    // 5. Salvataggio nome camper
    const saveNameBtn = document.getElementById('btn-save-name');
    if (saveNameBtn) saveNameBtn.onclick = saveGarageSettings;
    // NOTA: I tasti EDIT (batt, ps, pan, panPs) ora sono gestiti 
    // direttamente dall'attributo onclick="editSpec(...)" nel file HTML.
    // Non serve aggiungere altro qui per evitare conflitti.
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
/**
 * FUNZIONE EDIT UNIVERSALE
 * Spiegazione: Gestisce i prompt per tutti i valori del garage.
 * Nota: 'ps' salva Wh (Wattora), 'batt' salva Ah (Ampere/ora).
 */
function editSpec(type) {
    console.log("Apertura edit per:", type); // Serve per vedere se il tasto risponde

    let current = 0;
    let label = "";

    // 1. Recupero il valore attuale dallo 'state'
    if (type === 'batt') {
        current = state.battAh || 0;
        label = "Capacità Batteria SERVIZI (Ah)";
    } else if (type === 'ps') {
        current = state.psAh || 0; 
        label = "Capacità POWER STATION (Wh)";
    } else if (type === 'pan') {
        current = state.panelWp || 0;
        label = "Potenza Pannelli Camper (W)";
    } else if (type === 'panPs') {
        current = state.panelPsWp || 0;
        label = "Potenza Pannelli PS (W)";
    }

    // 2. Mostro il box di inserimento
    const v = prompt(`Modifica ${label}:`, current);

    // 3. Se l'utente preme OK e mette un numero
    if (v !== null && v !== "" && !isNaN(v)) {
        const val = parseFloat(v);
        
        // Aggiorno lo stato
        if (type === 'batt') state.battAh = val;
        else if (type === 'ps') state.psAh = val;
        else if (type === 'pan') state.panelWp = val;
        else if (type === 'panPs') state.panelPsWp = val;

        // 4. Salvo e rinfresco tutta l'app
        saveGarageSettings(); // Salva su memoria telefono
        if (typeof loadSavedData === 'function') loadSavedData();      // Aggiorna i testi
        if (typeof updateConversions === 'function') updateConversions(); // Aggiorna i Wh/Ah piccoli
        if (typeof updateAll === 'function') updateAll();              // Ricalcola il Report
        
        console.log("Valore aggiornato:", val);
    }
}
// --- TUTTO IL RESTO RIMANE INVARIATO (LOGICA E CALCOLI) ---

async function updateAll() {
    const lat = document.getElementById('input-lat').value;
    const lng = document.getElementById('input-lng').value;
    const dateInput = document.getElementById('input-date');

    if (dateInput && dateInput.value) {
        dataSelezionata = new Date(dateInput.value);
    }

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

        // --- AGGIORNAMENTO BADGE METEO ---
        if (document.getElementById('r-wind')) 
            document.getElementById('r-wind').innerText = Math.round(hourly.wind_speed_10m[hourIdx]) + " km/h";

        if (document.getElementById('r-hum')) 
            document.getElementById('r-hum').innerText = hourly.relative_humidity_2m[hourIdx] + "%";

        if (document.getElementById('r-temp')) 
            document.getElementById('r-temp').innerText = Math.round(hourly.temperature_2m[hourIdx]) + "°C";

        if (document.getElementById('r-cloud-percent')) 
            document.getElementById('r-cloud-percent').innerText = hourly.cloud_cover[hourIdx] + "%";

        // --- CALCOLO ALBA E TRAMONTO ---
        const sunrise = daily.sunrise[0].split('T')[1].substring(0, 5);
        const sunset = daily.sunset[0].split('T')[1].substring(0, 5);
        
        document.getElementById('sunrise-txt').innerText = sunrise;
        document.getElementById('sunset-txt').innerText = sunset;
        document.getElementById('display-hour-center').innerText = time;

        const sunH = SolarEngine.timeToDecimal(sunrise);
        const setH = SolarEngine.timeToDecimal(sunset);

        // Calcolo potenze
        const pServices = SolarEngine.calculatePower(hDec, sunH, setH, state.panelWp, hourly.cloud_cover[hourIdx]);
        const pPS = SolarEngine.calculatePower(hDec, sunH, setH, state.panelPsWp, hourly.cloud_cover[hourIdx]);
        const totalPower = pServices + pPS;

        displayVal.innerText = Math.round(totalPower) + " W";
        if (document.getElementById('w_services')) document.getElementById('w_services').innerText = Math.round(pServices) + " W";
        if (document.getElementById('w_ps')) document.getElementById('w_ps').innerText = Math.round(pPS) + " W";

        updateSunUI(hDec, sunH, setH);
        updateReportUI(totalPower, sunH, setH);
        
        // <--- QUI HO TOLTO generaBottoniGiorni() PER EVITARE IL RESET DELL'ORA

    } catch (e) { 
        console.error("Errore nel caricamento dati:", e); 
    }
}

function updateReportUI(currentPower, sunH, setH) {
    const chart = document.getElementById('hourly-chart');
    const totalDisplay = document.getElementById('total-wh-day');
    if (!chart || !state.weatherData) return;

    // --- 1. PREPARAZIONE DATI PER IL CALCOLO ---
    // Recuperiamo i Watt attuali dai display della Dashboard
    const wattServizi = parseFloat(document.getElementById('w_services')?.innerText) || 0;
    const wattPS = parseFloat(document.getElementById('w_ps')?.innerText) || 0;

    // --- 2. AGGIORNAMENTO TEMPI POWER STATION ---
    // NOTA: state.psAh ora contiene Wh. Dividiamo per 12.8 per dare gli Ah al motore
    if (state.psAh > 0) {
        const psAhEquiv = state.psAh / 12.8; 
        document.getElementById('ps_charge_80_txt').innerText = SolarEngine.estimateChargeTime(state.currentPsSOC, 80, wattPS, psAhEquiv);
        document.getElementById('ps_charge_90_txt').innerText = SolarEngine.estimateChargeTime(state.currentPsSOC, 90, wattPS, psAhEquiv);
        document.getElementById('ps_charge_100_txt').innerText = SolarEngine.estimateChargeTime(state.currentPsSOC, 100, wattPS, psAhEquiv);
    } else {
        document.getElementById('ps_charge_80_txt').innerText = "--";
        document.getElementById('ps_charge_90_txt').innerText = "--";
        document.getElementById('ps_charge_100_txt').innerText = "--";
    }
    
    // --- 3. AGGIORNAMENTO TEMPI BATTERIA SERVIZIO ---
    // Qui rimane tutto uguale perché state.battAh sono già Ah
    if (state.battAh > 0) {
        document.getElementById('batt_charge_80_txt').innerText = SolarEngine.estimateChargeTime(state.currentSOC, 80, wattServizi, state.battAh);
        document.getElementById('batt_charge_90_txt').innerText = SolarEngine.estimateChargeTime(state.currentSOC, 90, wattServizi, state.battAh);
        document.getElementById('batt_charge_100_txt').innerText = SolarEngine.estimateChargeTime(state.currentSOC, 100, wattServizi, state.battAh);
    } else {
        document.getElementById('batt_charge_80_txt').innerText = "--";
        document.getElementById('batt_charge_90_txt').innerText = "--";
        document.getElementById('batt_charge_100_txt').innerText = "--";
    }

    // --- 4. DISEGNO GRAFICO (Rimanente parte invariata) ---
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

/**
 * FUNZIONE EDIT UNIVERSALE
 * Spiegazione: Gestisce i prompt per tutti i valori del garage.
 * Nota: 'ps' salva Wh, 'batt' salva Ah.
 */
function editSpec(type) {
    // 1. Log di controllo (se premi F12 nel browser vedrai se la funzione parte)
    console.log("Tentativo di modifica per:", type);

    let current = 0;
    let label = "";

    // 2. Recupero dati dallo stato
    if (type === 'batt') {
        current = state.battAh || 0;
        label = "Capacità Batteria (Ah)";
    } else if (type === 'ps') {
        current = state.psAh || 0; // Salviamo Wh per la Power Station
        label = "Capacità Power Station (Wh)";
    } else if (type === 'pan') {
        current = state.panelWp || 0;
        label = "Potenza Pannelli Camper (W)";
    } else if (type === 'panPs') {
        current = state.panelPsWp || 0;
        label = "Potenza Pannelli PS (W)";
    }

    // 3. Apertura Prompt
    const v = prompt(`Inserisci ${label}:`, current);

    // 4. Validazione e salvataggio
    if (v !== null && v !== "" && !isNaN(v)) {
        const val = parseFloat(v);
        
        if (type === 'batt') state.battAh = val;
        else if (type === 'ps') state.psAh = val;
        else if (type === 'pan') state.panelWp = val;
        else if (type === 'panPs') state.panelPsWp = val;

        // 5. Aggiornamento a cascata
        saveGarageSettings();
        if (typeof loadSavedData === 'function') loadSavedData();
        if (typeof updateConversions === 'function') updateConversions();
        if (typeof updateAll === 'function') updateAll();
        
        console.log("Valore aggiornato con successo:", val);
    }
}
/**
 * Calcola e scrive la conversione Wh/Ah subito sotto i valori principali nel Garage.
 * Utilizza il coefficiente 12.8V per batterie LiFePO4.
 */
/**
 * Aggiorna le conversioni incrociate nel Garage
 * Spiegazione:
 * - Batteria: Valore in Ah (inserito) -> Calcola Wh (sotto) moltiplicando per 12.8
 * - Power Station: Valore in Wh (inserito) -> Calcola Ah (sotto) DIVIDENDO per 12.8
 */
function updateConversions() {
    // 1. GESTIONE BATTERIA SERVIZIO (Rimane Ah -> Wh)
    const bAh = parseFloat(document.getElementById('batt_val').innerText) || 0;
    const bConvVal = document.getElementById('batt_conv_val');

    if (bConvVal) {
        // Moltiplichiamo: Ah * 12.8 = Wh
        bConvVal.innerText = Math.round(bAh * 12.8);
    }

    // 2. GESTIONE POWER STATION (Invertita: Wh -> Ah)
    // Ora prendiamo il valore principale che l'utente inserisce come Wh
    const pWh = parseFloat(document.getElementById('ps_val').innerText) || 0;
    const pConvVal = document.getElementById('ps_conv_val');

    if (pConvVal) {
        // DIVIDIAMO: Wh / 12.8 = Ah
        // Esempio: 1280 Wh / 12.8 = 100 Ah
        pConvVal.innerText = Math.round(pWh / 12.8);
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
