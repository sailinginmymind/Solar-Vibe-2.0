const SolarEngine = {
    // Calcola la produzione istantanea (Watt) per pannelli FISSI ORIZZONTALI
    calculatePower(hDec, sunH, setH, panelWp, cloudCover) {
        if (hDec < sunH || hDec > setH) return 0;
      
        // 1. Progressione arco solare (0.0 a 1.0)
        const progress = (hDec - sunH) / (setH - sunH);
        
        // 2. PARABOLA SCHIACCIATA (Effetto pannello orizzontale)
        // Usiamo il quadrato del seno per simulare la perdita di efficienza 
        // quando il sole è basso rispetto al piano del tetto.
        const rawArc = Math.sin(progress * Math.PI);
        const arcHeight = Math.pow(rawArc, 2); 
        
        // 3. Fattore meteo (0.90: nubi più pesanti per pannelli piatti)
        const weatherFactor = (100 - (cloudCover * 0.90)) / 100;
        
        // 4. Calcolo finale
        let power = arcHeight * panelWp * weatherFactor;

        return power < 0.5 ? 0 : power;
    },

    estimateChargeTime(currentSoc, targetSoc, currentPower, battAh) {
        if (currentPower <= 5 || battAh <= 0) return "--";
        if (parseFloat(currentSoc) >= targetSoc) return "OK";

        const voltage = 12.8;
        const lossFactor = 0.85; 
        
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
        if (!timeStr) return 0;
        const [hours, minutes] = timeStr.split(':').map(Number);
        return hours + (minutes / 60);
    }
};
