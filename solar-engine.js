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
        const weatherFactor = (100 - (cloudCover * 0.5)) / 100;
        
        return arcHeight * panelWp * weatherFactor;
    },

    // Calcola il tempo necessario per raggiungere un target di Ah
    estimateChargeTime(currentSoc, targetSoc, currentPower, battAh) {
        const voltage = 12.8;
        const lossFactor = 0.85; // Efficienza MPPT/Cavi
        const producedA = (currentPower * lossFactor) / voltage;
        const netA = producedA - 0.5; // Consumo base camper

        if (netA <= 0.05) return "∞";

        const neededAh = (battAh * (targetSoc / 100)) - (battAh * (currentSoc / 100));
        if (neededAh <= 0) return "0h";

        return (neededAh / netA).toFixed(1) + "h";
    },

    // Converte orario stringa (HH:MM) in ore decimali
    timeToDecimal(timeStr) {
        const [hours, minutes] = timeStr.split(':').map(Number);
        return hours + (minutes / 60);
    }
};
