/**
 * WEATHER-API.JS
 * Gestisce le chiamate al servizio meteo Open-Meteo
 */

// 1. Variabile globale per salvare lo spostamento dell'ora (Offset)
let timezoneOffsetSeconds = null;

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
    // Scarica i dati meteo (Temperatura, Nubi, Vento, Umidità, Alba/Tramonto)
    fetchForecast: async (lat, lng, date) => {
        try {
            // Aggiungiamo '&timezone=auto' per far sì che Open-Meteo calcoli il fuso orario corretto
            const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&hourly=temperature_2m,relative_humidity_2m,cloud_cover,wind_speed_10m&daily=sunrise,sunset&timezone=auto&start_date=${date}&end_date=${date}`;
            
            const response = await fetch(url);
            if (!response.ok) throw new Error("Errore risposta API");
            
            const data = await response.json();

            // 2. SALVIAMO IL FUSO ORARIO
            // Open-Meteo restituisce 'utc_offset_seconds' (es. 7200 per la Romania)
            if (data.utc_offset_seconds !== undefined) {
                timezoneOffsetSeconds = data.utc_offset_seconds;
                // Aggiorniamo subito l'orologio se la funzione esiste
                if (typeof updateDashboardClock === 'function') {
                    updateDashboardClock();
                }
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
 * Questa funzione calcola l'ora in base alla città scelta
 */
function updateDashboardClock() {
    // Cerca l'elemento dell'orologio (assicurati che l'ID sia 'clock' nel tuo HTML)
    const clockElement = document.getElementById('clock');
    if (!clockElement) return;

    const oraLocale = new Date();

    if (timezoneOffsetSeconds !== null) {
        // 1. Calcoliamo l'ora UTC attuale
        const utcTimeMs = oraLocale.getTime() + (oraLocale.getTimezoneOffset() * 60000);
        
        // 2. Aggiungiamo i secondi del fuso orario della città (trasformati in millisecondi)
        const cityTime = new Date(utcTimeMs + (timezoneOffsetSeconds * 1000));
        
        const h = cityTime.getHours().toString().padStart(2, '0');
        const m = cityTime.getMinutes().toString().padStart(2, '0');
        clockElement.innerText = `${h}:${m}`;
    } else {
        // Se non hai ancora cercato una città, usa l'ora del tuo dispositivo
        const h = oraLocale.getHours().toString().padStart(2, '0');
        const m = oraLocale.getMinutes().toString().padStart(2, '0');
        clockElement.innerText = `${h}:${m}`;
    }
}

// Aggiorna l'orologio ogni secondo
setInterval(updateDashboardClock, 1000);
