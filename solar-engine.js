/**
 * SOLAR-ENGINE.JS
 * Gestisce tutta la logica matematica e i calcoli energetici.
 */

const SolarEngine = {
    // Calcola la produzione istantanea (Watt) per pannelli FISSI ORIZZONTALI
    calculatePower(hDec, sunH, setH, panelWp, cloudCover) {
        if (hDec < sunH || hDec > setH) return 0;
      
        // 1. Progressione arco solare (0.0 all'alba, 1.0 al tramonto)
        const progress = (hDec - sunH) / (setH - sunH);
        
        // 2. LA PARABOLA SCHIACCIATA
        // Usiamo Math.sin per l'arco, ma eleviamo il risultato al QUADRATO (Math.pow(..., 2)).
        // Questo simula la fisica del pannello piatto: 
        // - Al mattino e sera (sole basso) la resa scende drasticamente.
        // - Solo a mezzogiorno (sole a picco) la parabola raggiunge il picco.
        const rawArc = Math.sin(progress * Math.PI);
        const arcHeight = Math.pow(rawArc, 2); 
        
        // 3. Fattore meteo (calibrato: le nubi su pannelli piatti pesano di più)
        const weatherFactor = (100 - (cloudCover * 0.90)) / 100;
        
        // 4. Calcolo finale
        let power = arcHeight * panelWp * weatherFactor;

        // Se il risultato è piccolissimo, restituiamo 0
        return power < 0.5 ? 0 : power;
    },

   // Calcola il tempo necessario per ricaricare la batteria (Ah) fino a un certo SOC (%)
   estimateChargeTime(currentSoc, targetSoc, currentPower, battAh) {
        if (currentPower <= 5 || battAh <= 0) return "--";
        if (parseFloat(currentSoc) >= targetSoc) return "OK";

        const voltage = 12.8;
        const lossFactor = 0.85; // Efficienza MPPT e cavi
        
        const totalWh = battAh * voltage;
        const energyNeeded = totalWh * ((targetSoc - currentSoc) / 100);
        
        const netPower = (currentPower * lossFactor) - 10; 
        
        if (netPower <= 0) return "∞";

        const hoursDecimal = energyNeeded / netPower;
        if (hoursDecimal > 48) return ">48h";

        const h = Math.floor(hoursDecimal);
        const m = Math.round((hoursDecimal - h) * 60);

        return h > 0 ? `${h}h ${m}m` : `${m}m`;
    },

    getCurrentCityTime() {
        const oraLocale = new Date();
        if (window.timezoneOffsetSeconds !== null) {
            const utcTimeMs = oraLocale.getTime() + (oraLocale.getTimezoneOffset() * 60000);
            return new Date(utcTimeMs + (window.timezoneOffsetSeconds * 1000));
        }
        return oraLocale;
    },

    timeToDecimal(timeStr) {
        const [hours, minutes] = timeStr.split(':').map(Number);
        return hours + (minutes / 60);
    }
};
