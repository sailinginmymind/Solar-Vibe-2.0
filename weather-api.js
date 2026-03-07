window.timezoneOffsetSeconds = null;

const WeatherAPI = {
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

    fetchForecast: async (lat, lng, date) => {
        try {
            const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&hourly=temperature_2m,relative_humidity_2m,cloud_cover,wind_speed_10m&daily=sunrise,sunset&timezone=auto&start_date=${date}&end_date=${date}`;
            const response = await fetch(url);
            const data = await response.json();

            if (data.utc_offset_seconds !== undefined) {
                window.timezoneOffsetSeconds = data.utc_offset_seconds;
                // Forza l'aggiornamento dell'ora perché è cambiata la posizione
                updateDashboardClock(true); 
            }
            return data;
        } catch (err) {
            console.error(err);
            return null;
        }
    }
};

function updateDashboardClock(forza = false) {
    const clockElement = document.getElementById('display-hour-center'); 
    const inputTime = document.getElementById('input-time'); 
    const inputDate = document.getElementById('input-date'); 

    if (!clockElement) return;

    const oraLocale = new Date();
    let timeToUse = oraLocale;

    if (window.timezoneOffsetSeconds !== null) {
        const utcTimeMs = oraLocale.getTime() + (oraLocale.getTimezoneOffset() * 60000);
        timeToUse = new Date(utcTimeMs + (window.timezoneOffsetSeconds * 1000));
    }

    const h = timeToUse.getHours().toString().padStart(2, '0');
    const m = timeToUse.getMinutes().toString().padStart(2, '0');
    
    // 1. Aggiorna SEMPRE il cerchio centrale
    clockElement.innerText = `${h}:${m}`;

    // 2. Aggiorna i quadratini SOLO se forzato (cambio città) o se sono vuoti
    if (forza || (inputTime && !inputTime.value)) {
        if (inputTime) inputTime.value = `${h}:${m}`;
    }

    if (forza || (inputDate && !inputDate.value)) {
        if (inputDate) {
            const yyyy = timeToUse.getFullYear();
            const mm = (timeToUse.getMonth() + 1).toString().padStart(2, '0');
            const dd = timeToUse.getDate().toString().padStart(2, '0');
            inputDate.value = `${yyyy}-${mm}-${dd}`;
            if (typeof dataSelezionata !== 'undefined') dataSelezionata = new Date(timeToUse);
        }
    }

    // 3. Aggiorna il sole in base a quello che c'è scritto ORA nell'input
    if (inputTime && inputTime.value) {
        const [hIn, mIn] = inputTime.value.split(':').map(Number);
        const hDec = hIn + (mIn / 60);
        if (typeof updateSunUI === 'function' && window.lastSunH !== undefined) {
            updateSunUI(hDec, window.lastSunH, window.lastSetH); 
        }
    }
}
// NESSUN setInterval qui.
