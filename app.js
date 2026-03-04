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

    document.getElementById('btn-gps').addEventListener('click', handleGpsSync);

    ['input-time', 'input-date', 'input-lat', 'input-lng'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('change', updateAll);
    });
// Cerca la città quando premi INVIO nella casella
const cityInput = document.getElementById('city-input');
if (cityInput) {
    cityInput.addEventListener('keypress', function (e) {
        if (e.key === 'Enter') {
            searchCityCoords(this.value);
        }
    });
}
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

async function handleGpsSync() {
    const btn = document.getElementById('btn-gps');
    const originalText = "📡 AGGIORNA GPS E ORA ATTUALE ⏱️";
    const originalBg = btn.style.background;

    btn.innerText = "SINCRONIZZAZIONE IN CORSO...";
    btn.disabled = true;

    try {
        const coords = await WeatherAPI.getUserLocation();
        const now = new Date();
        
        document.getElementById('input-lat').value = coords.latitude.toFixed(4);
        document.getElementById('input-lng').value = coords.longitude.toFixed(4);
        document.getElementById('input-date').value = now.toISOString().split('T')[0];
        document.getElementById('input-time').value = now.getHours().toString().padStart(2,'0') + ":" + now.getMinutes().toString().padStart(2,'0');
        
        await updateAll();

        btn.innerText = "✅ SINCRONIZZAZIONE RIUSCITA";
        btn.style.background = "#22c55e";
        btn.style.boxShadow = "0 0 15px #22c55e";

    } catch (err) {
        btn.innerText = "❌ ERRORE GPS";
        btn.style.background = "#ef4444";
    } finally {
        btn.disabled = false;
        setTimeout(() => { 
            btn.innerText = originalText; 
            btn.style.background = originalBg;
            btn.style.boxShadow = "";
        }, 3000);
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
    updateCityName(lat, lng); 
    // --------------------------------

    displayVal.style.color = "#38bdf8";

    /**
     * MODIFICA ESTETICA:
     * Fissiamo il colore azzurro (#38bdf8) tipico dei Watt e aggiorniamo l'etichetta.
     * Rimuoviamo il cursore a "manina" per far capire che non è più cliccabile.
     */
    displayVal.style.color = "#38bdf8"; 
    if (displayLabel) {
        displayLabel.innerText = "POTENZA ISTANTANEA";
        displayLabel.style.cursor = "default";
    }

    try {
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

        document.getElementById('r-cloud-percent').innerText = hourly.cloud_cover[hourIdx] + "%";
        document.getElementById('r-temp').innerText = Math.round(hourly.temperature_2m[hourIdx]) + "°";
        document.getElementById('r-hum').innerText = hourly.relative_humidity_2m[hourIdx] + "%";
        document.getElementById('r-wind').innerText = Math.round(hourly.wind_speed_10m[hourIdx]) + " km/h";

        const sunH = SolarEngine.timeToDecimal(sunrise);
        const setH = SolarEngine.timeToDecimal(sunset);
        
        /**
         * CALCOLO POTENZA:
         * Calcoliamo i Watt attuali usando la formula nel SolarEngine.
         */
        const power = SolarEngine.calculatePower(hDec, sunH, setH, state.panelWp, hourly.cloud_cover[hourIdx]);
        
        /**
         * MODIFICA DISPLAY:
         * Mostriamo solo il valore arrotondato dei Watt seguita dalla "W".
         * Abbiamo rimosso il controllo 'state.isWh'.
         */
        displayVal.innerText = Math.round(power) + " W";

        if (typeof updateSunUI === 'function') updateSunUI(hDec, sunH, setH);
        
        // Passiamo comunque i dati al Report per il calcolo del grafico a barre
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
 * Cosa fa: Prende Lat e Lng e chiede a un servizio esterno il nome della città.
 * @param {number} lat - Latitudine
 * @param {number} lng - Longitudine
 */
async function updateCityName(lat, lng) {
    const cityElement = document.getElementById('city-name');
    if (!cityElement) return;

    try {
        // Interroghiamo Nominatim (OpenStreetMap)
        const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}`);
        const data = await response.json();
        
        // Estraiamo la città, il comune o la frazione
        const city = data.address.city || data.address.town || data.address.village || data.address.municipality || "Posizione ignota";
        const country = data.address.country;

        cityElement.innerText = `${city}, ${country}`;
    } catch (error) {
        console.error("Errore recupero città:", error);
        cityElement.innerText = "Località non trovata";
    }
}
/**
 * Funzione: searchCityCoords
 * Cosa fa: Prende il nome di una città, trova Lat/Lng e aggiorna l'app.
 * @param {string} cityName - Il nome della città digitato.
 */
async function searchCityCoords(cityName) {
    if (!cityName) return;
    const cityInput = document.getElementById('city-input');

    try {
        cityInput.style.color = "#fbbf24"; // Diventa giallo mentre cerca
        const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(cityName)}&limit=1`);
        const data = await response.json();

        if (data && data.length > 0) {
            // 1. Prende le coordinate trovate
            const newLat = parseFloat(data[0].lat).toFixed(4);
            const newLng = parseFloat(data[0].lon).toFixed(4);

            // 2. Aggiorna i quadratini Lat e Lng nella Dashboard
            document.getElementById('input-lat').value = newLat;
            document.getElementById('input-lng').value = newLng;

            // 3. Formatta il nome della città trovato (es. "Pisa, Toscana")
            cityInput.value = data[0].display_name.split(',')[0].toUpperCase();
            cityInput.style.color = "#38bdf8"; // Torna azzurro

            // 4. SCATENA L'AGGIORNAMENTO DI TUTTO (Meteo, Sole, Watt)
            updateAll(); 
        } else {
            alert("Città non trovata!");
            cityInput.style.color = "#ef4444"; // Rosso errore
        }
    } catch (error) {
        console.error("Errore ricerca:", error);
        cityInput.style.color = "#ef4444";
    }
}
