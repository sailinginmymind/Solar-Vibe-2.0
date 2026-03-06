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
            // Usiamo &timezone=auto per far calcolare a Open-Meteo il fuso orario dalla posizione
            const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&hourly=temperature_2m,relative_humidity_2m,cloud_cover,wind_speed_10m&daily=sunrise,sunset&timezone=auto&start_date=${date}&end_date=${date}`;
            
            const response = await fetch(url);
            if (!response.ok) throw new Error("Errore risposta API");
            
            const data = await response.json();

            // 2. SALVIAMO IL FUSO ORARIO DELLA CITTÀ
            if (data.utc_offset_seconds !== undefined) {
                timezoneOffsetSeconds = data.utc_offset_seconds;
                // Aggiorniamo subito l'ora visualizzata
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
 * Calcola l'ora in base alla città scelta (usando display-hour-center)
 */
function updateDashboardClock() {
    // Usiamo l'ID presente nel tuo HTML: display-hour-center
    const clockElement = document.getElementById('display-hour-center'); 
    if (!clockElement) return;

    const oraLocale = new Date();

    if (timezoneOffsetSeconds !== null) {
        // 1. Calcoliamo l'ora universale (UTC)
        const utcTimeMs = oraLocale.getTime() + (oraLocale.getTimezoneOffset() * 60000);
        
        // 2. Aggiungiamo lo scostamento della città cercata
        const cityTime = new Date(utcTimeMs + (timezoneOffsetSeconds * 1000));
        
        const h = cityTime.getHours().toString().padStart(2, '0');
        const m = cityTime.getMinutes().toString().padStart(2, '0');
        clockElement.innerText = `${h}:${m}`;
    } else {
        // Se non hai ancora cercato una città, mostra l'ora del tuo telefono/PC
        const h = oraLocale.getHours().toString().padStart(2, '0');
        const m = oraLocale.getMinutes().toString().padStart(2, '0');
        clockElement.innerText = `${h}:${m}`;
    }
}

// Avviamo l'aggiornamento automatico ogni secondo
setInterval(updateDashboardClock, 1000);
