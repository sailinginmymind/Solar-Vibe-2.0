let wattMode = 'W';
let state = { isWh: false, currentSOC: 50, battAh: 100, panelWp: 100, weatherData: null };

window.onload = () => {
    initEventListeners();
    loadSavedData();
    document.getElementById('btn-gps').click();
};

function initEventListeners() {
    document.querySelector('.main-wattage').addEventListener('click', () => {
        state.isWh = !state.isWh;
        updateAll();
    });
    document.getElementById('btn-gps').addEventListener('click', handleGpsSync);
}

async function handleGpsSync() {
    const btn = document.getElementById('btn-gps');
    btn.innerText = "SINCRO...";
    try {
        const coords = await WeatherAPI.getUserLocation();
        document.getElementById('input-lat').value = coords.latitude.toFixed(4);
        document.getElementById('input-lng').value = coords.longitude.toFixed(4);
        await updateAll();
        btn.innerText = "✅ OK";
    } catch (e) { btn.innerText = "❌ ERRORE"; }
}

async function updateAll() {
    const lat = document.getElementById('input-lat').value;
    const lng = document.getElementById('input-lng').value;
    const time = document.getElementById('input-time').value;
    const date = document.getElementById('input-date').value;
    const displayVal = document.querySelector('.main-wattage');

    if (!lat || !lng) return;

    // Colore
    displayVal.style.color = state.isWh ? "#fbbf24" : "#38bdf8";

    try {
        state.weatherData = await WeatherAPI.fetchForecast(lat, lng, date);
        if (!state.weatherData) return;

        const hIdx = parseInt(time.split(':')[0]);
        const hourly = state.weatherData.hourly;
        
        // Scrittura dati nei badge (ID fondamentali!)
        document.getElementById('r-cloud-percent').innerText = hourly.cloud_cover[hIdx] + "%";
        document.getElementById('r-temp').innerText = Math.round(hourly.temperature_2m[hIdx]) + "°";
        document.getElementById('r-hum').innerText = hourly.relative_humidity_2m[hIdx] + "%";
        document.getElementById('r-wind').innerText = Math.round(hourly.wind_speed_10m[hIdx]) + " km/h";

        // Alba e Tramonto
        const sunrise = state.weatherData.daily.sunrise[0].split('T')[1].substring(0,5);
        const sunset = state.weatherData.daily.sunset[0].split('T')[1].substring(0,5);
        document.getElementById('sunrise-txt').innerText = sunrise;
        document.getElementById('sunset-txt').innerText = sunset;

        // Calcolo Potenza
        const cloud = hourly.cloud_cover[hIdx];
        const power = SolarEngine.calculatePower(hIdx, 6, 20, state.panelWp, cloud);
        displayVal.innerText = Math.round(state.isWh ? power * 0.9 : power) + (state.isWh ? " Wh" : " W");

    } catch (e) { console.error(e); }
}
