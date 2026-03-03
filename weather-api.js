/**
 * WEATHER-API.JS
 * Gestisce la localizzazione GPS e le chiamate API meteo.
 */

async fetchForecast(lat, lng, dateStr) {
    try {
        // Nota: Questo URL chiede esplicitamente tutti i dati per i badge
        const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&hourly=temperature_2m,relative_humidity_2m,wind_speed_10m,cloud_cover&daily=sunrise,sunset&timezone=auto&start_date=${dateStr}&end_date=${dateStr}`;
        const response = await fetch(url);
        
        if (!response.ok) throw new Error("Errore API");
        
        const data = await response.json();
        return data;
    } catch (error) {
        console.error("WeatherAPI Error:", error);
        return null;
    }
}

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
