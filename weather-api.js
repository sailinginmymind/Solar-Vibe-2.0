/**
 * WEATHER-API.JS
 * Gestisce la localizzazione GPS e le chiamate API meteo.
 */

const WeatherAPI = {
    // Recupera i dati meteo basandosi su coordinate e data
    async fetchForecast(lat, lng, dateStr) {
        try {
            const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&hourly=temperature_2m,relative_humidity_2m,wind_speed_10m,cloud_cover&daily=sunrise,sunset&timezone=auto&start_date=${dateStr}&end_date=${dateStr}`;
            const response = await fetch(url);
            
            if (!response.ok) throw new Error("Errore nel recupero dati meteo");
            
            return await response.json();
        } catch (error) {
            console.error("WeatherAPI Error:", error);
            return null;
        }
    },

    // Ottiene la posizione GPS dell'utente
    getUserLocation() {
        return new Promise((resolve, reject) => {
            if (!navigator.geolocation) {
                reject("Geolocalizzazione non supportata");
            }
            navigator.geolocation.getCurrentPosition(
                (position) => resolve(position.coords),
                (error) => reject(error),
                { enableHighAccuracy: true }
            );
        });
    }
};
