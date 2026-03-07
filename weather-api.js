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
            if (!response.ok) throw new Error("Errore API");
            
            const data = await response.json();

            // Quando arrivano i dati, salviamo il fuso orario e FORZIAMO l'aggiornamento dell'ora
            if (data.utc_offset_seconds !== undefined) {
                window.timezoneOffsetSeconds = data.utc_offset_seconds;
                updateDashboardClock(true); // 'true' forza il cambio dell'ora perché abbiamo cambiato posizione
            }

            return data;
        } catch (err) {
            console.error(err);
            return null;
        }
    }
};

/**
 * Gestisce l'orario e la data locale
 * @param {boolean} forza - Se true, sovrascrive gli input anche se sono già pieni
 */
function updateDashboardClock(forza = false) {
    const clockElement = document.getElementById('display-hour-center'); 
    const inputTime = document.getElementById('input-time'); 
    const inputDate = document.getElementById('input-date'); 

    if (!clockElement) return;

    const oraLocale = new Date();
    let timeToUse = oraLocale;

    // Calcolo ora basato sul fuso orario della posizione scelta
    if (window.timezoneOffsetSeconds !== null) {
        const utcTimeMs = oraLocale.getTime() + (oraLocale.getTimezoneOffset() * 60000);
        timeToUse = new Date(utcTimeMs + (window.timezoneOffsetSeconds * 1000));
    }

    const h = timeToUse.getHours().toString().padStart(2, '0');
    const m = timeToUse.getMinutes().toString().padStart(2, '0');
    
    // 1. Aggiorna sempre il testo centrale grande
    clockElement.innerText = `${h}:${m}`;

    // 2. Aggiorna i quadratini SOLO se sono vuoti OPPURE se abbiamo forzato (es. cambio posizione/città)
    if (inputTime && (inputTime.value === "" || forza)) {
        inputTime.value = `${h}:${m}`;
    }

    if (inputDate && (inputDate.value === "" || forza)) {
        const yyyy = timeToUse.getFullYear();
        const mm = (timeToUse.getMonth() + 1).toString().padStart(2, '0');
        const dd = timeToUse.getDate().toString().padStart(2, '0');
        inputDate.value = `${yyyy}-${mm}-${dd}`;
        
        // Sincronizza la variabile globale usata per il calcolo dei giorni
        if (typeof dataSelezionata !== 'undefined') {
            dataSelezionata = new Date(timeToUse);
        }
    }

    // 3. Muovi il sole (usa l'ora che c'è nell'input, che sia manuale o automatica)
    if (inputTime && inputTime.value) {
        const [hIn, mIn] = inputTime.value.split(':').map(Number);
        const hDec = hIn + (mIn / 60);
        if (typeof updateSunUI === 'function' && window.lastSunH !== undefined) {
            updateSunUI(hDec, window.lastSunH, window.lastSetH); 
        }
    }
}

// IL SETINTERVAL È STATO RIMOSSO VOLONTARIAMENTE PER EVITARE GLITCH
