// Usiamo window. per renderla visibile anche agli altri file JS (solar-engine.js, app.js)
window.timezoneOffsetSeconds = null;

const WeatherAPI = {
    // Recupera la posizione GPS dell'utente
    getUserLocation: () => {
        return new Promise((resolve, reject) => {
            if (!navigator.geolocation) reject({ code: 0, message: "GPS non supportato" });
            navigator.geolocation.getCurrentPosition(
                pos => resolve(pos.coords),
                err => reject(err),
                { timeout: 10000 }
            );
        });
    },

    // Scarica i dati meteo
    fetchForecast: async (lat, lng, date) => {
        try {
            const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&hourly=temperature_2m,relative_humidity_2m,cloud_cover,wind_speed_10m&daily=sunrise,sunset&timezone=auto&start_date=${date}&end_date=${date}`;
            
            const response = await fetch(url);
            if (!response.ok) throw new Error("Errore risposta API");
            
            const data = await response.json();

            // SALVIAMO IL FUSO ORARIO DELLA CITTÀ
            if (data.utc_offset_seconds !== undefined) {
                window.timezoneOffsetSeconds = data.utc_offset_seconds;
                // Aggiorniamo subito l'ora e il sistema solare
                updateDashboardClock();
            }

            return data;
        } catch (err) {
            console.error("Errore fetch meteo:", err);
            return null;
        }
    }
};

/**
 * FUNZIONE OROLOGIO SINCRONIZZATO
 * Aggiorna ora centrale, data, input e posizione del sole
 */
function updateDashboardClock() {
    const clockElement = document.getElementById('display-hour-center'); 
    const inputTime = document.getElementById('input-time'); // Riquadro ora in basso
    const inputDate = document.getElementById('input-date'); // Riquadro data in basso

    if (!clockElement) return;

    const oraLocale = new Date();
    let timeToUse = oraLocale;

    if (window.timezoneOffsetSeconds !== null) {
        // Calcoliamo l'ora della città (es. Taipei)
        const utcTimeMs = oraLocale.getTime() + (oraLocale.getTimezoneOffset() * 60000);
        timeToUse = new Date(utcTimeMs + (window.timezoneOffsetSeconds * 1000));
    }

    // 1. Aggiorna l'ora nel cerchio centrale
    const h = timeToUse.getHours().toString().padStart(2, '0');
    const m = timeToUse.getMinutes().toString().padStart(2, '0');
    clockElement.innerText = `${h}:${m}`;

    // 2. Aggiorna il riquadro dell'ora in basso (input-time)
    if (inputTime) inputTime.value = `${h}:${m}`;

    // 3. Aggiorna il riquadro della data in basso (input-date)
    if (inputDate) {
        const yyyy = timeToUse.getFullYear();
        const mm = (timeToUse.getMonth() + 1).toString().padStart(2, '0');
        const dd = timeToUse.getDate().toString().padStart(2, '0');
        inputDate.value = `${yyyy}-${mm}-${dd}`;
    }

    // 4. SINCRONIZZA IL SOLE
    // Questa funzione aggiorna la posizione del sole in base alla nuova ora
 if (typeof updateAll === 'function') {
    updateAll(); 
}
}

// Avviamo l'aggiornamento automatico ogni secondo
setInterval(updateDashboardClock, 1000);
