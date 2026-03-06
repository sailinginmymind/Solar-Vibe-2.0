/**
 * APP.JS - Versione Definitiva e Pulita
 */
let chartSelectionTimer;
let dataSelezionata = new Date(); 
let isGpsSyncing = false; 

let state = {
    isWh: false,
    currentSOC: 50,
    currentPsSOC: 50, 
    // Se non c'è nulla in memoria, lasciamo il nome vuoto o un placeholder
    camperName: localStorage.getItem('vibe_camper_name') || "",
    // Cambiamo i '100' in '0' per i nuovi utenti
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
    setupStars();
    
    // Primo avvio automatico
    document.getElementById('btn-gps').click();
};

function initEventListeners() {
    // --- 1. NAVIGAZIONE E GPS ---
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', () => switchView(item.dataset.view, item));
    });
    document.getElementById('btn-gps').addEventListener('click', handleGpsSync);

    // --- 2. GESTIONE CITTA' ---
    const cityInput = document.getElementById('city-input');
    if (cityInput) {
        cityInput.addEventListener('change', function () {
            const query = this.value.trim();
            if (query.length >= 3) searchCityCoords(query);
        });
        cityInput.addEventListener('keydown', function (e) {
            if (e.key === 'Enter') {
                this.blur(); 
                const query = this.value.trim();
                if (query.length >= 3) searchCityCoords(query);
            }
        });
    }

    // --- 3. INPUT CAMPI MANUALE ---
    ['input-time', 'input-date', 'input-lat', 'input-lng'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('change', updateAll);
    });

 // --- SLIDER BATTERIA SERVIZI (A DESTRA) ---
    const socSlider = document.getElementById('soc-slider');
    if (socSlider) {
        socSlider.addEventListener('input', (e) => {
            state.currentSOC = e.target.value;
            document.getElementById('soc-val').innerText = state.currentSOC + "%";
            updateAll(); // Ricalcola i tempi di ricarica
        });
    }

   // Listener per lo slider Power Station (Sinistra)
const psSocSlider = document.getElementById('ps-soc-slider');
if (psSocSlider) {
    psSocSlider.addEventListener('input', (e) => {
        // 1. Legge il valore dallo slider (0-100)
        const val = e.target.value;
        
        // 2. Aggiorna l'oggetto state (il database temporaneo dell'app)
        state.currentPsSOC = val; 
        
        // 3. Aggiorna il testo a video sopra lo slider
        document.getElementById('ps-soc-val').innerText = val + "%";
        
        // 4. Lancia il ricalcolo di tutta l'energia (tempi di carica, Wh, ecc.)
        updateAll(); 
    });
}

    // --- 5. TASTI GARAGE E MODIFICHE (CORRETTO) ---
    // Colleghiamo il tasto Salva (Floppy) alla funzione che salva tutto
    document.getElementById('btn-save-name').onclick = saveGarageSettings;

    // Colleghiamo i 4 tasti di modifica alla funzione editSpec
    document.getElementById('edit-batt-btn').onclick = () => editSpec('batt');
    document.getElementById('edit-pan-btn').onclick = () => editSpec('pan');
    document.getElementById('edit-ps-btn').onclick = () => editSpec('ps');
    document.getElementById('edit-pan-ps-btn').onclick = () => editSpec('panPs');
}
/**
 * Spiegazione: Apre un box per inserire gli Ah della Power Station,
 * li salva nel browser e aggiorna i calcoli.
 */
function editPowerStation() {
    let v = prompt("Capacità Power Station (Ah):", state.powerStationAh);
    if (v !== null && !isNaN(v) && v !== "") {
        state.powerStationAh = parseFloat(v);
        localStorage.setItem('vibe_ps_ah', v);
        document.getElementById('ps_val').innerText = v;
        updateAll();
    }
}
function generaBottoniGiorni() {
    const container = document.getElementById('days-selector');
    if (!container) return;

    container.innerHTML = ""; 

    const oggi = new Date();

    for (let i = 0; i < 7; i++) {
        const dataBottone = new Date(oggi);
        dataBottone.setDate(oggi.getDate() + i); 

        const btn = document.createElement('div');
        btn.className = 'day-btn';
        
        // Controlla se è il giorno attivo per evidenziarlo
        if (dataBottone.toDateString() === dataSelezionata.toDateString()) {
            btn.classList.add('active');
        }

        const giornoSettimana = dataBottone.toLocaleDateString('it-IT', { weekday: 'short' })
                                           .charAt(0)
                                           .toUpperCase();
        
        const numeroGiorno = dataBottone.getDate();

        btn.innerHTML = `<span>${giornoSettimana}</span><b>${numeroGiorno}</b>`;
        
        // --- CORREZIONE QUI SOTTO ---
        btn.onclick = function() {
            // 1. Aggiorna la data globale usando dataBottone (non dataTasto!)
            dataSelezionata = new Date(dataBottone);
            
            // 2. Ridisegna i bottoni per spostare la classe 'active'
            generaBottoniGiorni();
            
            // 3. Aggiorna i grafici e il titolo
            aggiornaTuttaInterfaccia();
        };

        container.appendChild(btn);
    }
}

// IL REGISTA: Sincronizza tutta l'app
function aggiornaTuttaInterfaccia() {
    const inputDate = document.getElementById('input-date');
    if (inputDate) {
        inputDate.value = dataSelezionata.toISOString().split('T')[0];
    }
// --- AGGIUNTA PER SAFARI / IPHONE ---
    // Se hai un elemento testuale che mostra la data in dashboard (es. id="dashboard-date")
    const dashDate = document.getElementById('dashboard-date');
    if (dashDate) {
        const opzioniNumeriche = { day: '2-digit', month: '2-digit', year: 'numeric' };
        dashDate.innerText = dataSelezionata.toLocaleDateString('it-IT', opzioniNumeriche);
    }
    // ------------------------------------
    updateAll();

    const titoli = document.querySelectorAll('h3.section-title');
    let elementoTitolo = null;

    titoli.forEach(el => {
        if (el.innerText.includes("PREVISIONE")) {
            elementoTitolo = el;
        }
    });

    const oggi = new Date().toDateString();

    if (elementoTitolo) {
        if (dataSelezionata.toDateString() === oggi) {
            elementoTitolo.innerHTML = "PREVISIONE ODIERNA";
            elementoTitolo.style.color = "#38bdf8"; 
        } else {
            const opzioni = { day: 'numeric', month: 'long' };
            const dataEstesa = dataSelezionata.toLocaleDateString('it-IT', opzioni).toUpperCase();

            elementoTitolo.style.color = "#38bdf8"; 

            // Qui usiamo il <br> con la classe che abbiamo appena creato nel CSS
            elementoTitolo.innerHTML = `
                PREVISIONE PER IL GIORNO 
                <br class="mobile-break">
                <span style="color: #fbbf24;">${dataEstesa}</span>
            `;
        }
    }
}
// AVVIAMO LA CREAZIONE DEI GIORNI
generaBottoniGiorni();
/**
 * Funzione: handleGpsSync
 * Spiegazione: Ottiene la posizione GPS, aggiorna i dati e mostra 
 * direttamente il feedback verde di successo (senza scritte intermedie).
 */
async function handleGpsSync() {
    isGpsSyncing = true; // <--- 1. ACCENDE IL SEGNALE GPS
    const btn = document.getElementById('btn-gps');
    const originalText = "📡 AGGIORNA GPS E ORA ATTUALE ⏱️";

    btn.disabled = true;

    try {
        const coords = await WeatherAPI.getUserLocation();
        const now = new Date();
        
        // 1. Aggiorna i valori negli input
        document.getElementById('input-lat').value = coords.latitude.toFixed(4);
        document.getElementById('input-lng').value = coords.longitude.toFixed(4);
        document.getElementById('input-date').value = now.toISOString().split('T')[0];
        document.getElementById('input-time').value = now.getHours().toString().padStart(2,'0') + ":" + now.getMinutes().toString().padStart(2,'0');
        
        // 2. RESET DATA: riporta il "post-it" globale a oggi
        dataSelezionata = new Date(); 
        
        // 3. RESET BOTTONI: rigenera la lista giorni rimettendo il focus su "oggi"
        generaBottoniGiorni(); 

        // 4. AGGIORNA TUTTO: ricalcola i dati e resetta la scritta "PREVISIONE ODIERNA"
        aggiornaTuttaInterfaccia();

        // --- EFFETTO GLOW ---
        btn.innerText = "✅ SINCRONIZZAZIONE RIUSCITA";
        btn.style.background = "#22c55e"; 
        // Aggiungiamo l'ombra esterna (glow) verde
        btn.style.boxShadow = "0 0 20px #22c55e"; 
        btn.style.borderColor = "#4ade80";

    } catch (err) {
        btn.innerText = "❌ ERRORE GPS";
        btn.style.background = "#ef4444"; 
        btn.style.boxShadow = "0 0 20px #ef4444"; // Glow rosso in caso di errore
    } finally {
        btn.disabled = false;
        isGpsSyncing = false; // <--- 2. SPEGNE IL SEGNALE GPS (Così puoi scrivere a mano dopo)
        
        // Dopo 3 secondi riportiamo il tasto allo stato originale
        setTimeout(() => { 
            btn.innerText = originalText; 
            btn.style.background = ""; 
            btn.style.boxShadow = "";
            btn.style.borderColor = "";
        }, 3000);
    }
}

/**
 * Funzione: updateAll
 * Spiegazione: È il "cuore" che aggiorna tutto. 
 * Abbiamo aggiunto updateCityName per sincronizzare il testo della città.
 */
/**
 * Funzione: updateAll
 * Spiegazione: Calcola la potenza solare e aggiorna l'interfaccia.
 * Modifica: Ora aggiorna il nome della città solo se stiamo sincronizzando col GPS.
 */
async function updateAll() {
    const lat = document.getElementById('input-lat').value;
    const lng = document.getElementById('input-lng').value;
    const date = dataSelezionata.toISOString().split('T')[0];
    const time = document.getElementById('input-time').value;
    const displayVal = document.getElementById('w_out');
    const displayLabel = document.getElementById('unit-label');

    if (!lat || !lng || !displayVal) return;

    try {
        if (isGpsSyncing) {
            await updateCityName(lat, lng); 
        }

        state.weatherData = await WeatherAPI.fetchForecast(lat, lng, date);
        if (!state.weatherData) return;

        const hourIdx = parseInt(time.split(':')[0]);
        const hDec = SolarEngine.timeToDecimal(time);
        const hourly = state.weatherData.hourly;
        const daily = state.weatherData.daily;

        const sunrise = daily.sunrise[0].split('T')[1].substring(0, 5);
        const sunset = daily.sunset[0].split('T')[1].substring(0, 5);
        
        document.getElementById('sunrise-txt').innerText = sunrise;
        document.getElementById('sunset-txt').innerText = sunset;
        document.getElementById('display-hour-center').innerText = time;

        const sunH = SolarEngine.timeToDecimal(sunrise);
        const setH = SolarEngine.timeToDecimal(sunset);

        // 1. Calcolo Potenze separate
        const pServices = SolarEngine.calculatePower(hDec, sunH, setH, state.panelWp, hourly.cloud_cover[hourIdx]);
        const pPS = SolarEngine.calculatePower(hDec, sunH, setH, state.panelPsWp, hourly.cloud_cover[hourIdx]);
        const totalPower = pServices + pPS;

        // 2. Aggiornamento UI Dashboard
        displayVal.innerText = Math.round(totalPower) + " W";
        if (document.getElementById('w_services')) document.getElementById('w_services').innerText = Math.round(pServices) + " W";
        if (document.getElementById('w_ps')) document.getElementById('w_ps').innerText = Math.round(pPS) + " W";

        // 3. Posizionamento Sole
        if (typeof updateSunUI === 'function') updateSunUI(hDec, sunH, setH);

        // 4. CHIAMATA AL REPORT (Passiamo i Watt totali e i dati del sole)
        updateReportUI(totalPower, sunH, setH);

    } catch (e) { 
        console.error("Errore updateAll:", e); 
    }
}
function updateReportUI(currentPower, sunH, setH) {
    const chart = document.getElementById('hourly-chart');
    const detailBox = document.getElementById('detail-display');
    const totalDisplay = document.getElementById('total-wh-day');
    
    if (!chart || !state.weatherData) return;

    // --- A. CALCOLO TEMPI DI RICARICA SEPARATI ---
    const capServizio = state.battAh || 0;
    const capPS = state.psAh || 0;

    // Report Power Station (Slider Sinistro)
    if (capPS > 0) {
        document.getElementById('ps_charge_80_txt').innerText = SolarEngine.estimateChargeTime(state.currentPsSOC, 80, currentPower, capPS);
        document.getElementById('ps_charge_90_txt').innerText = SolarEngine.estimateChargeTime(state.currentPsSOC, 90, currentPower, capPS);
        document.getElementById('ps_charge_100_txt').innerText = SolarEngine.estimateChargeTime(state.currentPsSOC, 100, currentPower, capPS);
    }

    // Report Batteria Servizio (Slider Destro)
    if (capServizio > 0) {
        document.getElementById('batt_charge_80_txt').innerText = SolarEngine.estimateChargeTime(state.currentSOC, 80, currentPower, capServizio);
        document.getElementById('batt_charge_90_txt').innerText = SolarEngine.estimateChargeTime(state.currentSOC, 90, currentPower, capServizio);
        document.getElementById('batt_charge_100_txt').innerText = SolarEngine.estimateChargeTime(state.currentSOC, 100, currentPower, capServizio);
    }

    // --- B. DISEGNO GRAFICO ---
    chart.innerHTML = "";
    let dailyTotal = 0;
    const startHour = Math.floor(sunH);
    const endHour = Math.ceil(setH);

    for (let h = startHour; h <= endHour; h++) {
        const cloud = state.weatherData.hourly.cloud_cover[h] || 0;
        // Calcoliamo la produzione oraria basandoci sui pannelli fissi (camper)
        const hP = SolarEngine.calculatePower(h, sunH, setH, state.panelWp, cloud);
        dailyTotal += hP;

        const bar = document.createElement('div');
        bar.className = 'bar';
        bar.style.height = Math.max(5, (hP / (state.panelWp || 1) * 100)) + "%";

        const showDetail = () => {
            clearTimeout(chartSelectionTimer);
            document.querySelectorAll('.bar').forEach(b => b.classList.remove('active'));
            bar.classList.add('active');
            
            if (detailBox) {
                detailBox.innerHTML = `
                    <span style="color:#fbbf24;">ORE </span>
                    <b style="color:#fbbf24; margin-left:4px;">${h}:00</b> 
                    <span style="color:#fbbf24; margin:0 10px; opacity:0.5;">→</span> 
                    <b style="color:#fbbf24;">${Math.round(hP)} W</b>
                `;
            }

            chartSelectionTimer = setTimeout(() => {
                bar.classList.remove('active');
                resetDetailDisplay();
            }, 2000);
        };

        bar.addEventListener('click', showDetail);
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

function editSpec(type) {
    // 1. Definiamo il messaggio e i riferimenti in base al tipo
    let messaggio = "Inserisci valore:";
    let currentVal = "";

    if (type === 'batt') {
        messaggio = "Ah Batteria Servizi:";
        currentVal = state.battAh;
    } else if (type === 'pan') {
        messaggio = "Watt Pannelli Fissi (Wp):";
        currentVal = state.panelWp;
    } else if (type === 'ps') { // <--- AGGIUNTO CASO CAPACITÀ PS
        messaggio = "Ah Power Station:";
        currentVal = state.psAh;
    } else if (type === 'panPs') {
        messaggio = "Watt Pannelli Power Station (Wp):";
        currentVal = state.panelPsWp;
    }

    // Passiamo currentVal come secondo parametro al prompt così l'utente vede il valore attuale
    let v = prompt(messaggio, currentVal);

    // 2. Controllo validità
    if (v !== null && v !== "" && !isNaN(v)) {
        const valoreNumerico = parseFloat(v);

        if (type === 'batt') {
            state.battAh = valoreNumerico;
            localStorage.setItem('vibe_batt_ah', v);
            document.getElementById('batt_val').innerText = v;
        } 
        else if (type === 'pan') {
            state.panelWp = valoreNumerico;
            localStorage.setItem('vibe_panel_wp', v);
            document.getElementById('panel_val').innerText = v;
        }
        else if (type === 'ps') { // <--- SALVATAGGIO CAPACITÀ PS
            state.psAh = valoreNumerico;
            localStorage.setItem('vibe_ps_ah', v);
            document.getElementById('ps_val').innerText = v;
        }
        else if (type === 'panPs') {
            state.panelPsWp = valoreNumerico;
            localStorage.setItem('vibe_panel_ps_wp', v);
            document.getElementById('panel_ps_val').innerText = v;
        }
        
        // 3. Ricalcola tutto e salva lo stato generale
        updateAll();
        saveGarageSettings(); // Chiamiamo questa per sicurezza per sincronizzare tutto
    }
}

function saveGarageSettings() {
    // 1. Leggiamo i valori attuali dalle scritte nel Garage
    const name = document.getElementById('camper_name_input').value;
    const batt = document.getElementById('batt_val').innerText;
    const panels = document.getElementById('panel_val').innerText;
    const psAh = document.getElementById('ps_val').innerText;
    const psPanels = document.getElementById('panel_ps_val').innerText;

    // 2. Sovrascriviamo lo 'state' globale per i calcoli immediati
    state.camperName = name;
    state.battAh = parseFloat(batt) || 0;
    state.panelWp = parseFloat(panels) || 0;
    state.psAh = parseFloat(psAh) || 0;
    state.panelPsWp = parseFloat(psPanels) || 0;

    // 3. Salviamo nel database del browser (sovrascrive sempre il precedente)
    localStorage.setItem('vibe_camper_name', name);
    localStorage.setItem('vibe_batt_ah', state.battAh);
    localStorage.setItem('vibe_panel_wp', state.panelWp);
    localStorage.setItem('vibe_ps_ah', state.psAh);
    localStorage.setItem('vibe_ps_panel_wp', state.panelPsWp);

    // 4. Aggiorniamo la UI
    document.getElementById('camper-name-display').innerText = (name || "IL MIO VAN").toUpperCase();
    
    // 5. Lanciamo un aggiornamento immediato dei calcoli
    updateAll();
    console.log("Dati Garage salvati correttamente!");
}

function loadSavedData() {
    // Carichiamo il nome o usiamo il default
    const savedName = localStorage.getItem('vibe_camper_name');
    if (savedName !== null) {
        state.camperName = savedName;
        document.getElementById('camper_name_input').value = savedName;
        document.getElementById('camper-name-display').innerText = savedName.toUpperCase();
    }

    // Carichiamo i valori tecnici. Se la memoria è vuota (null), usiamo i valori di fabbrica
    state.battAh = parseFloat(localStorage.getItem('vibe_batt_ah')) || state.battAh;
    state.panelWp = parseFloat(localStorage.getItem('vibe_panel_wp')) || state.panelWp;
    state.psAh = parseFloat(localStorage.getItem('vibe_ps_ah')) || 0;
    state.panelPsWp = parseFloat(localStorage.getItem('vibe_ps_panel_wp')) || 0;

    // Scriviamo i valori nei testi del Garage per farli vedere all'utente
    document.getElementById('batt_val').innerText = state.battAh;
    document.getElementById('panel_val').innerText = state.panelWp;
    document.getElementById('ps_val').innerText = state.psAh;
    document.getElementById('panel_ps_val').innerText = state.panelPsWp;
    
    // Carichiamo il colore dello sfondo
    const savedColor = localStorage.getItem('vibe_bg_color');
    if (savedColor) changeBg(savedColor);

    // IMPORTANTE: Eseguiamo il primo calcolo automatico all'apertura
    updateAll(); 
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
/**
 * Funzione: updateSunUI
 * Cosa fa: Posiziona il sole nel cielo in base all'ora, con un arco schiacciato 
 * per evitare sovrapposizioni, adattandosi a schermi PC e Mobile.
 */
function updateSunUI(hDec, sunH, setH) {
    const sun = document.getElementById('sun-body');
    const sky = document.getElementById('sky-box');
    const stars = document.getElementById('stars-container');
    
    if (!sun || !sky) return;

    // 1. Gestione Notte: se l'ora attuale è fuori dal range alba-tramonto
    if (hDec < sunH || hDec > setH) {
        sun.style.display = "none"; 
        sky.style.background = "linear-gradient(to bottom, #0f172a, #1e293b)";
        if (stars) stars.style.opacity = "1";
    } else {
        // 2. Gestione Giorno
        sun.style.display = "block";
        if (stars) stars.style.opacity = "0";
        
        // Calcoliamo il progresso del sole (da 0 a 1)
        const progress = (hDec - sunH) / (setH - sunH);
        
        /**
         * POSIZIONE ORIZZONTALE (X):
         * Usiamo un range dal 15% all'85% per evitare che il sole tocchi i bordi 
         * laterali del riquadro, specialmente su schermi stretti (mobile).
         */
        const posX = 15 + (progress * 70); 

        /**
         * POSIZIONE VERTICALE (Y) - OTTIMIZZAZIONE MOBILE:
         * Per evitare che il sole "scavalchi" il riquadro o copra l'orario centrale:
         * - Math.sin(progress * Math.PI) crea la parabola.
         * - Moltiplicando per 35 (invece di 80), abbassiamo drasticamente il picco dell'arco.
         * - Aggiungiamo '+ 10' come base per non far partire il sole troppo dal fondo.
         */
        const altezzaMassima = 35; 
        const offsetBase = 10;
        const posY = (Math.sin(progress * Math.PI) * altezzaMassima) + offsetBase;

        // Applichiamo le coordinate in percentuale
        sun.style.left = `${posX}%`;
        sun.style.bottom = `${posY}%`; 

        // 3. Sfumatura del Cielo
        if (progress < 0.2 || progress > 0.8) {
            // Colori dell'alba e del tramonto
            sky.style.background = "linear-gradient(to bottom, #f59e0b, #7c2d12)";
        } else {
            // Colore del pieno giorno (azzurro come nel tuo screenshot)
            sky.style.background = "linear-gradient(to bottom, #38bdf8, #1d4ed8)";
        }
    }
}

/* --- GESTIONE GRAFICO: DEFINITIVA --- */

// Mouseover (PC)
document.getElementById('hourly-chart').addEventListener('mouseover', (e) => {
    if (!e.target.closest('.bar')) return;
    clearTimeout(chartSelectionTimer);
});

// Mouseout (PC)
document.getElementById('hourly-chart').addEventListener('mouseout', (e) => {
    const bar = e.target.closest('.bar');
    if (!bar) return;
    clearTimeout(chartSelectionTimer);
    chartSelectionTimer = setTimeout(() => {
        bar.classList.remove('active');
        resetDetailDisplay(); 
    }, 2000); 
});

// Avvio iniziale
function resetDetailDisplay() {
    const display = document.getElementById('detail-display');
    if (!display) return;
    
    display.style.display = "flex";
    display.style.justifyContent = "center";
    display.style.alignItems = "baseline"; 
    
    // Testo iniziale tutto in GIALLO
    display.innerHTML = `
        <span style="color:#fbbf24;">TOCCA UNA </span>
        <b style="color:#fbbf24; margin:0 6px;">BARRA</b>
        <span style="color:#fbbf24;"> PER I DETTAGLI</span>
    `;
    
    display.style.color = "#fbbf24"; 
    display.style.fontSize = "14px"; 
    display.style.letterSpacing = "1.5px";
    display.style.textTransform = "uppercase";
    display.style.fontWeight = "900";
    display.style.textShadow = "none"; // Elimina eventuali ombre blu residue
}
/**
 * Funzione: updateCityName
 * Cosa fa: Prende Lat e Lng e aggiorna il campo di testo della città.
 * Correzione: Ora punta a 'city-input' e usa .value per i campi di testo.
 */
/**
 * Funzione: updateCityName
 * Spiegazione: Converte Latitudine e Longitudine nel nome della Città e del Paese.
 * Abbiamo aggiunto il supporto per il Paese e una gestione degli errori più robusta.
 */
async function updateCityName(lat, lng) {
    const cityElement = document.getElementById('city-input'); 
    if (!cityElement) return;

    try {
        // Interpelliamo il servizio OpenStreetMap (Nominatim)
        // Aggiungiamo 'accept-language=it' per avere i nomi in italiano se disponibili
        const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&accept-language=it`, {
            headers: { 'User-Agent': 'VibeSolarApp' }
        });
        
        const data = await response.json();
        
        if (data && data.address) {
            // Cerchiamo la città tra i vari nomi che può avere nell'API
            const city = data.address.city || data.address.town || data.address.village || data.address.municipality || data.address.suburb;
            // Prendiamo il nome del Paese (es: Italia)
            const country = data.address.country;

            if (city && country) {
                // Se abbiamo entrambi: "ROMA, ITALIA"
                cityElement.value = `${city}, ${country}`.toUpperCase();
            } else if (city) {
                // Se abbiamo solo la città: "ROMA"
                cityElement.value = city.toUpperCase();
            } else {
                cityElement.value = "POSIZIONE GPS";
            }
        } else {
            cityElement.value = "POSIZIONE RILEVATA";
        }
    } catch (error) {
        console.error("Errore recupero città:", error);
        cityElement.value = "ERRORE GEOLOCALIZZAZIONE";
    }
}
/**
 * Funzione: searchCityCoords
 * Cerca le coordinate di una città e aggiorna l'app.
 */
async function searchCityCoords(cityName) {
    if (!cityName) return;
    try {
        const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(cityName)}&limit=1`);
        const data = await response.json();

        if (data && data.length > 0) {
            // Inserisce le coordinate trovate nei quadratini
            document.getElementById('input-lat').value = parseFloat(data[0].lat).toFixed(4);
            document.getElementById('input-lng').value = parseFloat(data[0].lon).toFixed(4);
            
            // Forza l'aggiornamento di tutti i dati meteo
            updateAll();
        } else {
            alert("Città non trovata!");
        }
    } catch (error) {
        console.error("Errore ricerca città:", error);
    }
}
/**
 * Funzione: changeBg
 * Spiegazione: Gestisce il cambio totale del tema applicando una classe al body.
 */
function changeBg(tema) {
    // 1. Rimuove le classi dei temi precedenti
    document.body.classList.remove('tema-verde', 'tema-rosso', 'tema-grigio');
    
    // 2. Aggiunge la classe corretta
    if (tema === '#062c1f') {
        document.body.classList.add('tema-verde');
    } else if (tema === '#2d0a1a') {
        document.body.classList.add('tema-rosso');
    } else if (tema === '#1a1a1a') {
        document.body.classList.add('tema-grigio');
    }
    // Se è blu originale, non aggiunge classi speciali

    // 3. Applica lo sfondo e salva
    document.body.style.backgroundColor = tema;
    localStorage.setItem('vibe_bg_color', tema);
    
    // Spiegazione: Grazie alle classi 'tema-xxx', la variabile CSS --accento 
    // cambia valore automaticamente e i pulsanti si aggiornano da soli!
}

// VARIABILE PER MONITORARE IL GIORNO CORRENTE
let giornoAttualeMonitor = new Date().getDate();

// FUNZIONE DI CONTROLLO CAMBIO DATA AUTOMATICO
function checkCambioGiorno() {
    const oggi = new Date();
    
    // Se il giorno del mese è diverso da quello salvato...
    if (oggi.getDate() !== giornoAttualeMonitor) {
        console.log("Mezzanotte passata! Aggiorno il calendario...");
        
        // 1. Aggiorna il monitor al nuovo giorno
        giornoAttualeMonitor = oggi.getDate();
        
        // 2. Resetta la data selezionata a 'oggi'
        dataSelezionata = new Date();
        
        // 3. Rigenera i bottoni (così apparirà VEN 6 come primo)
        generaBottoniGiorni();
        
        // 4. Aggiorna tutta l'interfaccia (titolo, grafici, etc.)
        aggiornaTuttaInterfaccia();
    }
}

// Controlla ogni 30 secondi se è cambiata la data
setInterval(checkCambioGiorno, 30000);

// 1. Questa funzione serve a calcolare il colore della scia azzurra
function updateSliderFill(slider) {
    const val = slider.value;
    // Parla con il CSS e gli dice quanta barra colorare
    slider.style.setProperty('--value', val + '%');
}

// 2. Questa funzione "prepara" i due slider per funzionare insieme
function initSliders() {
    const sliders = [
        { id: 'ps-soc-slider', valId: 'ps-soc-val', stateKey: 'currentPsSOC' },
        { id: 'soc-slider', valId: 'soc-val', stateKey: 'currentSOC' }
    ];

    sliders.forEach(s => {
        const el = document.getElementById(s.id);
        const valTxt = document.getElementById(s.valId);
        
        if (el) {
            // Colora la barra al caricamento
            updateSliderFill(el);

            // Ascolta quando muovi il dito sul pallino
            el.addEventListener('input', (e) => {
                const val = e.target.value;
                state[s.stateKey] = val; // Salva il dato nel tuo "state"
                if (valTxt) valTxt.innerText = val + "%"; // Cambia il numero 50% -> 60% ecc.
                
                updateSliderFill(e.target); // Muove la scia azzurra
                updateAll(); // Ricalcola i tempi di ricarica totali
            });
        }
    });
}
