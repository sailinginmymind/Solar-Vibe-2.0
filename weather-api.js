/**
 * WEATHER-API.JS
 * Gestisce le chiamate al servizio meteo Open-Meteo
 */
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
            // URL configurato con tutti i parametri necessari per i tuoi badge
            const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&hourly=temperature_2m,relative_humidity_2m,cloud_cover,wind_speed_10m&daily=sunrise,sunset&timezone=auto&start_date=${date}&end_date=${date}`;
            
            const response = await fetch(url);
            if (!response.ok) throw new Error("Errore risposta API");
            
            const data = await response.json();
            return data;
        } catch (err) {
            console.error("Errore fetch meteo:", err);
            return null;
        }
    }
};
