/**
 * SOLAR-ENGINE.JS
 * Gestisce tutta la logica matematica e i calcoli energetici.
 */

const SolarEngine = {
    // Calcola la produzione istantanea (Watt)
    calculatePower(hDec, sunH, setH, panelWp, cloudCover) {
        if (hDec < sunH || hDec > setH) return 0;
      
        // Progressione arco solare (0.0 a 1.0)
        const progress = (hDec - sunH) / (setH - sunH);
        const arcHeight = Math.sin(progress * Math.PI);
        
        // Fattore meteo (conservativo: le nubi riducono ma non azzerano sempre tutto)
        const weatherFactor = (100 - (cloudCover * 0.86)) / 100;
        
        return arcHeight * panelWp * weatherFactor;
    },

   // Calcola il tempo necessario per ricaricare la batteria (Ah) fino a un certo SOC (%)
    estimateChargeTime(currentSoc, targetSoc, currentPower, battAh) {
        // 1. Controlli di sicurezza: se non c'è sole o i dati sono 0
        if (currentPower <= 5 || battAh <= 0) return "--";
        
        // Se la batteria è già al target o sopra
        if (parseFloat(currentSoc) >= targetSoc) return "OK";

        const voltage = 12.8;
        const lossFactor = 0.85; // Efficienza MPPT e cadute di tensione cavi
        
        // 2. Calcoliamo l'energia totale della batteria in Wh
        const totalWh = battAh * voltage;
        
        // 3. Calcoliamo quanta energia (Wh) manca per arrivare al target
        const energyNeeded = totalWh * ((targetSoc - currentSoc) / 100);
        
        // 4. Calcoliamo le ore necessarie (Energia / Potenza netta)
        // Sottraiamo un piccolo consumo base (es. 10W per centralina/sensori)
        const netPower = (currentPower * lossFactor) - 10; 
        
        if (netPower <= 0) return "∞";

        const hoursDecimal = energyNeeded / netPower;

        // Se il tempo stimato supera i 2 giorni, mostriamo un limite
        if (hoursDecimal > 48) return ">48h";

        // 5. Formattazione in ore e minuti (es: 1h 45m invece di 1.8h)
        const h = Math.floor(hoursDecimal);
        const m = Math.round((hoursDecimal - h) * 60);

        return h > 0 ? `${h}h ${m}m` : `${m}m`;
    },

    // Converte orario stringa (HH:MM) in ore decimali
    timeToDecimal(timeStr) {
        const [hours, minutes] = timeStr.split(':').map(Number);
        return hours + (minutes / 60);
    }
    getCurrentCityTime() {
        const oraLocale = new Date();
        if (window.timezoneOffsetSeconds !== null) {
            const utcTimeMs = oraLocale.getTime() + (oraLocale.getTimezoneOffset() * 60000);
            return new Date(utcTimeMs + (window.timezoneOffsetSeconds * 1000));
        }
        return oraLocale;
    },
};
