/**
 * APP.JS - Versione Definitiva e Pulita
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

    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', () => switchView(item.dataset.view, item));
    });

    // 1. TASTO GPS (Già presente)
    document.getElementById('btn-gps').addEventListener('click', handleGpsSync);

const cityInput = document.getElementById('city-input');

if (cityInput) {
    // 1. SCATTO AL "BLUR" (Quando esce dalla tastiera o clicca altrove)
    // L'evento 'change' si attiva proprio quando l'input perde il focus
    cityInput.addEventListener('change', function () {
        const query = this.value.trim();
        if (query.length >= 3) {
            console.log("Ricerca attivata all'uscita:", query);
            searchCityCoords(query);
        }
    });

    // 2. SCATTO AL TASTO "ENTER" (Ottimo per chi usa il PC)
    cityInput.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') {
            // Togliamo il focus manualmente per attivare anche l'evento change se necessario
            this.blur(); 
            const query = this.value.trim();
            if (query.length >= 3) {
                searchCityCoords(query);
            }
        }
    });
}

    // 3. CAMPI INPUT (Già presente)
    ['input-time', 'input-date', 'input-lat', 'input-lng'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('change', updateAll);
    });

    // 4. SLIDER BATTERIA (Già presente)
    const socSlider = document.getElementById('soc-slider');
    if (socSlider) {
        socSlider.addEventListener('input', (e) => {
            state.currentSOC = e.target.value;
            document.getElementById('soc-val').innerText = state.currentSOC + "%";
            updateAll();
        });
    }

    // 5. TASTI GARAGE E MODIFICHE (Già presente)
    document.getElementById('btn-save-name').addEventListener('click', saveGarageName);
    document.getElementById('edit-batt-btn').addEventListener('click', () => editSpec('batt'));
    document.getElementById('edit-pan-btn').addEventListener('click', () => editSpec('pan'));
}
// 1. IL "POST-IT": Questa variabile tiene a mente che giorno stiamo guardando.
// All'inizio è impostata su "adesso" (new Date()).
// 1. IL "POST-IT" GLOBALE
let dataSelezionata = new Date();

function generaBottoniGiorni() {
    const container = document.getElementById('days-selector');
    if (!container) return;

    const iniziali = ['D', 'L', 'M', 'M', 'G', 'V', 'S'];
    const oggi = new Date();

    container.innerHTML = ''; 

    for (let i = 0; i < 7; i++) {
        const dataTasto = new Date();
        dataTasto.setDate(oggi.getDate() + i);

        const btn = document.createElement('div');
        // Il primo tasto (oggi) è attivo all'avvio
        btn.className = i === 0 ? 'day-btn active' : 'day-btn';
        
        btn.innerHTML = `
            <span class="day-name">${iniziali[dataTasto.getDay()]}</span>
            <span class="day-num">${dataTasto.getDate()}</span>
        `;

        btn.onclick = function() {
            // Estetica: cambia classe active
            document.querySelectorAll('.day-btn').forEach(b => b.classList.remove('active'));
            this.classList.add('active');

            // Aggiorna la data globale
            dataSelezionata = new Date(dataTasto);
            
            // Chiama la funzione di aggiornamento
            aggiornaTuttaInterfaccia();
        };

        container.appendChild(btn);
    }
}

// IL REGISTA: Sincronizza tutta l'app
// IL REGISTA: Sincronizza tutta l'app
function aggiornaTuttaInterfaccia() {
    const inputDate = document.getElementById('input-date');
    if (inputDate) {
        inputDate.value = dataSelezionata.toISOString().split('T')[0];
    }

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
            
            // Manteniamo la base azzurra (#38bdf8)
            elementoTitolo.style.color = "#38bdf8"; 
            
            // Inseriamo lo span con il colore giallo (#fbbf24) solo per la data
            elementoTitolo.innerHTML = `PREVISIONE PER IL GIORNO <span style="color: #fbbf24;">${dataEstesa}</span>`;
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
async function updateAll() {
    const lat = document.getElementById('input-lat').value;
    const lng = document.getElementById('input-lng').value;
   const date = dataSelezionata.toISOString().split('T')[0];
    const time = document.getElementById('input-time').value;
    const displayVal = document.getElementById('w_out');
    const displayLabel = document.getElementById('unit-label');

    if (!lat || !lng || !displayVal) return;

    // Impostazioni estetiche per i Watt (Azzurro)
    displayVal.style.color = "#38bdf8"; 
    if (displayLabel) {
        displayLabel.innerText = "POTENZA ISTANTANEA";
        displayLabel.style.cursor = "default";
    }

    try {
        // --- AGGIUNTA QUI: Aggiorna il nome della città sotto il cerchio ---
        updateCityName(lat, lng); 

        // Recupero dati meteo tramite WeatherAPI
        state.weatherData = await WeatherAPI.fetchForecast(lat, lng, date);
        if (!state.weatherData) return;

        const hourIdx = parseInt(time.split(':')[0]);
        const hDec = SolarEngine.timeToDecimal(time);
        const hourly = state.weatherData.hourly;
        const daily = state.weatherData.daily;

        // Aggiornamento testi Alba, Tramonto e Ora centrale
        const sunrise = daily.sunrise[0].split('T')[1].substring(0, 5);
        const sunset = daily.sunset[0].split('T')[1].substring(0, 5);
        
        document.getElementById('sunrise-txt').innerText = sunrise;
        document.getElementById('sunset-txt').innerText = sunset;
        document.getElementById('display-hour-center').innerText = time;

        // Aggiornamento icone/testi meteo laterali
        document.getElementById('r-cloud-percent').innerText = hourly.cloud_cover[hourIdx] + "%";
        document.getElementById('r-temp').innerText = Math.round(hourly.temperature_2m[hourIdx]) + "°";
        document.getElementById('r-hum').innerText = hourly.relative_humidity_2m[hourIdx] + "%";
        document.getElementById('r-wind').innerText = Math.round(hourly.wind_speed_10m[hourIdx]) + " km/h";

        // Calcolo Potenza Watt tramite SolarEngine
        const sunH = SolarEngine.timeToDecimal(sunrise);
        const setH = SolarEngine.timeToDecimal(sunset);
        const power = SolarEngine.calculatePower(hDec, sunH, setH, state.panelWp, hourly.cloud_cover[hourIdx]);
        
        // Mostra i Watt finali
        displayVal.innerText = Math.round(power) + " W";

        // Aggiornamento grafico Sole e Report Barre
        if (typeof updateSunUI === 'function') updateSunUI(hDec, sunH, setH);
        updateReportUI(power, sunH, setH);

    } catch (e) { 
        console.error("Errore updateAll:", e); 
    }
}

function updateReportUI(currentPower, sunH, setH) {
    const chart = document.getElementById('hourly-chart');
    const detailBox = document.getElementById('detail-display');
    const totalDisplay = document.getElementById('total-wh-day');
    
    if (!chart || !state.weatherData) return;

    document.getElementById('charge_80_txt').innerText = SolarEngine.estimateChargeTime(state.currentSOC, 80, currentPower, state.battAh);
    document.getElementById('charge_90_txt').innerText = SolarEngine.estimateChargeTime(state.currentSOC, 90, currentPower, state.battAh);
    document.getElementById('charge_100_txt').innerText = SolarEngine.estimateChargeTime(state.currentSOC, 100, currentPower, state.battAh);

    chart.innerHTML = "";
    let dailyTotal = 0;
    const startHour = Math.floor(sunH);
    const endHour = Math.ceil(setH);

    for (let h = startHour; h <= endHour; h++) {
        const cloud = state.weatherData.hourly.cloud_cover[h] || 0;
        const hP = SolarEngine.calculatePower(h, sunH, setH, state.panelWp, cloud);
        dailyTotal += hP;

        const bar = document.createElement('div');
        bar.className = 'bar';
        bar.style.height = Math.max(5, (hP / state.panelWp * 100)) + "%";

        const showDetail = () => {
            document.querySelectorAll('.bar').forEach(b => b.classList.remove('active'));
            bar.classList.add('active');
            if (detailBox) {
                detailBox.innerHTML = `ORE ${h}:00 <span style="margin:0 10px; opacity:0.5;">→</span> <span style="color:#fff">${Math.round(hP)} W</span>`;
            }
        };

        bar.addEventListener('mouseenter', showDetail);
        bar.addEventListener('click', showDetail);
        chart.appendChild(bar);
    }
    if (totalDisplay) {
        totalDisplay.innerText = Math.round(dailyTotal) + " Wh";
    }
}

function switchView(vId, el) {
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
    const target = document.getElementById('view-' + vId);
    if (target) target.classList.add('active');
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
    
    const savedColor = localStorage.getItem('vibe_bg_color');
    if (savedColor) {
        changeBg(savedColor); // Se c'è un colore salvato, lo applica subito
    }
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

/* --- GESTIONE GRAFICO: HOVER (PC) E TOUCH (MOBILE) AGGIORNATA --- */

let chartSelectionTimer;

// Evento Mouseover (Passaggio)
document.getElementById('hourly-chart').addEventListener('mouseover', (e) => {
    const bar = e.target.closest('.bar');
    if (!bar) return;

    clearTimeout(chartSelectionTimer);
    document.querySelectorAll('.bar').forEach(b => b.classList.remove('active'));
    bar.classList.add('active');
    
    // Ingrandiamo il testo per i dati dei tuoi 100 Ah
    const display = document.getElementById('detail-display');
    display.style.color = "#fbbf24";
    display.style.fontSize = "1.2rem"; 
    display.style.letterSpacing = "normal";
});

// Evento Mouseout (Uscita)
document.getElementById('hourly-chart').addEventListener('mouseout', (e) => {
    const bar = e.target.closest('.bar');
    if (!bar) return;

    if (!chartSelectionTimer || chartSelectionTimer._called) {
        bar.classList.remove('active');
        resetDetailDisplay(); // Torna piccolo e grigio con 'barra' gialla
    }
});

// Evento Click (Fissaggio 3 secondi)
document.getElementById('hourly-chart').addEventListener('click', (e) => {
    const bar = e.target.closest('.bar');
    if (!bar) return;

    clearTimeout(chartSelectionTimer);
    bar.classList.add('active');
    
    const display = document.getElementById('detail-display');
    display.style.color = "#fbbf24";
    display.style.fontSize = "1.2rem";

    chartSelectionTimer = setTimeout(() => {
        bar.classList.remove('active');
        resetDetailDisplay(); // Torna piccolo e grigio dopo 3 secondi
    }, 3000); 
});

// Avvio iniziale del display
resetDetailDisplay();
/* Funzione per resettare il display con lo stile etichetta */
function resetDetailDisplay() {
    const display = document.getElementById('detail-display');
    if (!display) return;
    // Inseriamo lo span per colorare solo la parola 'barra'
    display.innerHTML = 'Tocca una <span style="color:#fbbf24; margin:0 4px;">BARRA</span> per i dettagli';
    display.style.color = "#94a3b8"; 
    display.style.fontSize = "11px"; // Font piccolo come "Batteria Attuale"
    display.style.letterSpacing = "1.5px";
    display.style.textTransform = "uppercase";
}

/**
 * Funzione: updateCityName
 * Cosa fa: Prende Lat e Lng e aggiorna il campo di testo della città.
 * Correzione: Ora punta a 'city-input' e usa .value per i campi di testo.
 */
async function updateCityName(lat, lng) {
    const cityElement = document.getElementById('city-input'); 
    if (!cityElement) return;

    try {
        // Usiamo un servizio di fallback se il primo fallisce
        const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}`, {
            headers: { 'User-Agent': 'VibeSolarApp' }
        });
        const data = await response.json();
        
        const city = data.address.city || data.address.town || data.address.village || data.address.municipality;
        
        if (city) {
            cityElement.value = city.toUpperCase();
        } else {
            cityElement.value = "POSIZIONE GPS";
        }
    } catch (error) {
        console.error("Errore recupero città:", error);
        // Se non trova il nome, almeno scriviamo le coordinate o un testo generico
        cityElement.value = "POSIZIONE RILEVATA";
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
    
    // 2. Aggiunge la classe corretta in base al colore scelto
    if (tema === '#062c1f') {
        document.body.classList.add('tema-verde');
    } else if (tema === '#2d0a1a') {
        document.body.classList.add('tema-rosso');
    } else if (tema === '#1a1a1a') {
        document.body.classList.add('tema-grigio');
    }
    // Nota: Se il tema è quello originale (#0f172a), non aggiungiamo classi e resta Blu.

    // 3. Applica il colore di sfondo e salva la preferenza
    document.body.style.backgroundColor = tema;
    localStorage.setItem('vibe_bg_color', tema);
}
