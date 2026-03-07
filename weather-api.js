// Usiamo window. per renderla visibile anche agli altri file JS
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
            if (!response.ok) throw new Error("Errore risposta API");
            
            const data = await response.json();

            if (data.utc_offset_seconds !== undefined) {
                window.timezoneOffsetSeconds = data.utc_offset_seconds;
                // Aggiorniamo l'interfaccia
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
 * FUNZIONE OROLOGIO
 * Modificata per NON sovrascrivere i tuoi inserimenti manuali
 */
function updateDashboardClock() {
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
    
    // 1. Aggiorna sempre il testo centrale (quello grande)
    clockElement.innerText = `${h}:${m}`;

    // 2. AGGIORNA GLI INPUT SOLO SE SONO VUOTI
    // Se tu hai già scritto un'ora, l'app NON la tocca più.
    if (inputTime && (inputTime.value === "" || !inputTime.value)) {
        inputTime.value = `${h}:${m}`;
    }

    if (inputDate && (inputDate.value === "" || !inputDate.value)) {
        const yyyy = timeToUse.getFullYear();
        const mm = (timeToUse.getMonth() + 1).toString().padStart(2, '0');
        const dd = timeToUse.getDate().toString().padStart(2, '0');
        inputDate.value = `${yyyy}-${mm}-${dd}`;
    }

    // 3. MUOVI IL SOLE
    // Prendiamo l'ora dall'input (quella decisa da te) per muovere il sole correttamente
    if (inputTime && inputTime.value) {
        const [hIn, mIn] = inputTime.value.split(':').map(Number);
        const hDecManual = hIn + (mIn / 60);
        if (typeof updateSunUI === 'function' && window.lastSunH !== undefined) {
            updateSunUI(hDecManual, window.lastSunH, window.lastSetH); 
        }
    }
}

// IMPORTANTE: Rimuovi o commenta questa riga se vuoi che l'ora non scatti da sola ogni secondo
// setInterval(updateDashboardClock, 1000);
