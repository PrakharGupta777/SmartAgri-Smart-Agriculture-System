// ==========================================
// 1. SAFE UI INITIALIZATION (Run First)
// ==========================================
const inputIds = ['n', 'p', 'k', 'ph', 'temp', 'hum', 'rain'];
const inputs = {};
const labels = {};

inputIds.forEach(id => {
    const inputEl = document.getElementById(`input-${id}`);
    const labelEl = document.getElementById(`val-${id}`);
    if (inputEl && labelEl) {
        inputs[id] = inputEl;
        labels[id] = labelEl;
        inputEl.addEventListener('input', (e) => {
            labelEl.innerText = e.target.value;
        });
    }
});

const predictBtn = document.getElementById('predict-btn');
const autofillBtn = document.getElementById('autofill-btn');
const toast = document.getElementById('toast');
const toastMsg = document.getElementById('toast-message');

const showToast = (message, icon = 'fa-info-circle') => {
    toastMsg.innerText = message;
    document.getElementById('toast-icon').className = `fas ${icon} text-[#1F7D53]`;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 4000);
};

// ==========================================
// 2. APPLICATION LOGIC
// ==========================================

// Autofill External API Sync
if (autofillBtn) {
    autofillBtn.addEventListener('click', async () => {
        if (!navigator.geolocation) {
            showToast("Location not supported", "fa-triangle-exclamation");
            return;
        }

        autofillBtn.innerHTML = `<i class="fas fa-spinner animate-spin"></i> Syncing...`;
        autofillBtn.disabled = true;

        navigator.geolocation.getCurrentPosition(async (pos) => {
            const { latitude, longitude } = pos.coords;
            const formatDate = (d) => d.toISOString().split('T')[0];
            const end = new Date();
            const start = new Date(); 
            start.setDate(end.getDate() - 7);
            
            const weatherUrl = `https://archive-api.open-meteo.com/v1/archive?latitude=${latitude}&longitude=${longitude}&start_date=${formatDate(start)}&end_date=${formatDate(end)}&daily=temperature_2m_mean,precipitation_sum,relative_humidity_2m_mean&timezone=auto`;
            // Optimized to only fetch the pH property as soil classification is removed
            const soilUrl = `https://rest.isric.org/soilgrids/v2.0/properties/query?lon=${longitude}&lat=${latitude}&property=phh2o&depth=0-5cm&value=mean`;
            const geoUrl = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&addressdetails=1`;

            try {
                const results = await Promise.allSettled([
                    fetch(weatherUrl).then(r => r.json()),
                    fetch(soilUrl).then(r => r.json()),
                    fetch(geoUrl, { headers: { 'User-Agent': 'SmartAgro-Web-Client' } }).then(r => r.json())
                ]);

                const [weather, soil, geo] = results;

                // UI Variables
                let finalTemp = "25", finalHum = "70", finalRain = "1200";
                let finalPh = "6.5";

                // Weather Parsing
                if (weather.status === 'fulfilled' && weather.value.daily) {
                    const d = weather.value.daily;
                    const tempArr = d.temperature_2m_mean.filter(v => v != null);
                    if (tempArr.length > 0) finalTemp = (tempArr.reduce((a,b)=>a+b,0) / tempArr.length).toFixed(1);
                    
                    const humArr = d.relative_humidity_2m_mean.filter(v => v != null);
                    if (humArr.length > 0) finalHum = (humArr.reduce((a,b)=>a+b,0) / humArr.length).toFixed(0);
                    
                    const rainArr = d.precipitation_sum.filter(v => v != null);

                    if (rainArr.length > 0) {
                        const totalThirtyDays = rainArr.reduce((a, b) => a + b, 0);
                        
                        // Use 12.17 (Months in a year)
                        finalRain = ((totalThirtyDays * 12.17).toFixed(0))*36;
                        
                        // Kept within UI slider's max limit (Updated to 3500 based on dataset)
                        if (finalRain > 3500) finalRain = 3500; 
                    }
                }

                // Soil Parsing
                if (soil.status === 'fulfilled' && soil.value.properties?.layers) {
                    const layers = soil.value.properties.layers;
                    const getPropMean = (name) => {
                        const l = layers.find(x => x.name === name);
                        return (l?.depths?.[0]?.values) ? l.depths[0].values.mean : null;
                    };
                    
                    const phRaw = getPropMean('phh2o');
                    if (phRaw !== null) {
                        finalPh = (phRaw / 10).toFixed(1);
                    }
                }

                // Update UI Elements safely
                if (inputs.temp) { inputs.temp.value = finalTemp; labels.temp.innerText = finalTemp; }
                if (inputs.hum) { inputs.hum.value = finalHum; labels.hum.innerText = finalHum; }
                if (inputs.rain) { inputs.rain.value = finalRain; labels.rain.innerText = finalRain; }
                if (inputs.ph) { inputs.ph.value = finalPh; labels.ph.innerText = finalPh; }

                // Geo & Location Display
                if (geo.status === 'fulfilled' && geo.value.address) {
                    const city = geo.value.address.city || geo.value.address.county || geo.value.address.state || "Unknown Region";
                    const currentLocText = document.getElementById('current-location-text');
                    const locDisplay = document.getElementById('location-display');
                    
                    if (currentLocText && locDisplay) {
                        currentLocText.innerText = city;
                        locDisplay.classList.remove('hidden');
                    }
                }

                showToast("Live data successfully fetched!", "fa-check-circle");
            } catch (err) {
                console.error(err);
                showToast("API sync failed. Try manual input.", "fa-xmark-circle");
            } finally {
                autofillBtn.innerHTML = `<i class="fas fa-location-crosshairs mr-2"></i>Sync Live Data`;
                autofillBtn.disabled = false;
            }
        }, () => {
            showToast("Location access denied.", "fa-ban");
            autofillBtn.innerHTML = `<i class="fas fa-location-crosshairs mr-2"></i>Sync Live Data`;
            autofillBtn.disabled = false;
        });
    });
}