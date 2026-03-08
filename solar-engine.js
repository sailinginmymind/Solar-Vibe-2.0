const SolarEngine = {
    // Calcola la produzione istantanea (Watt)
    calculatePower(hDec, sunH, setH, panelWp, cloudCover) {
        if (hDec < sunH || hDec > setH) return 0;
      
        // 1. Progressione arco solare (0.0 a 1.0)
        const progress = (hDec - sunH) / (setH - sunH);
        
        // 2. CURVA PER PANNELLO PIATTO (Orizzontale 0°)
        // Usiamo un esponente (es: Math.pow(..., 1.5)) per simulare che 
        // con il sole basso il pannello piatto riceve molta meno energia.
        const sineWave = Math.sin(progress * Math.PI);
        const flatPanelFactor = Math.pow(sineWave, 1.5); 
        
        // 3. Fattore meteo (conservativo: le nubi riducono ma non azzerano sempre tutto)
        const weatherFactor = (100 - (cloudCover * 0.86)) / 100;
        
        // 4. Efficienza reale pannelli sul tetto (calore, sporco, cavi)
        // Solitamente un pannello sul tetto raramente supera l'80-85% del valore nominale
        const efficiencyFactor = 0.82;
        
        return panelWp * flatPanelFactor * weatherFactor * efficiencyFactor;
    },

    estimateChargeTime(currentSoc, targetSoc, currentPower, battAh) {
        if (currentPower <= 5 || battAh <= 0) return "--";
        if (parseFloat(currentSoc) >= targetSoc) return "OK";

        const voltage = 12.8;
        const lossFactor = 0.86; 
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

    timeToDecimal(timeStr) {
        const [hours, minutes] = timeStr.split(':').map(Number);
        return hours + (minutes / 60);
    }
};
