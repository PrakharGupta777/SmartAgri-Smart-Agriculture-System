
        import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
        import { getAuth, signInAnonymously, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
        import { getFirestore, collection, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

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

        const soilSelect = document.getElementById('soil-select');
        const seasonSelect = document.getElementById('season-select');
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
        // 2. SAFE FIREBASE SETUP (Try/Catch Wrapped)
        // ==========================================
        let db = null;
        let currentUser = null;
        const appId = typeof __app_id !== 'undefined' ? __app_id : 'smartagro-default';

        try {
            if (typeof __firebase_config !== 'undefined') {
                const firebaseConfig = JSON.parse(__firebase_config);
                const app = initializeApp(firebaseConfig);
                const auth = getAuth(app);
                db = getFirestore(app);

                signInAnonymously(auth).catch(err => console.warn("Auth failed:", err));
                onAuthStateChanged(auth, (user) => {
                    currentUser = user;
                    const display = document.getElementById('user-display');
                    if (user && display) {
                        display.innerText = `UID: ${user.uid.substring(0,6)}...`;
                        display.classList.remove('hidden');
                    }
                });
            } else {
                console.warn("Firebase config not found. Running UI in offline mode.");
            }
        } catch (err) {
            console.warn("Firebase initialization skipped.", err);
        }

        // ==========================================
        // 3. APPLICATION LOGIC
        // ==========================================
        
        // Soil Classification Helper
        const classifySoil = (props, lat, lon) => {
            const { clayRaw, sandRaw, siltRaw, ph } = props;
            const clay = (clayRaw || 0) / 10;
            const sand = (sandRaw || 0) / 10;
            const silt = (siltRaw || 0) / 10;

            if (ph > 8.2) return "Saline";
            if (ph < 5.0) return "Laterite";
            if (lat > 15 && lat < 25 && lon > 73 && lon < 80) return "Black (Regur)";
            if (clay > 40) return "Clayey";
            if (sand > 85) return "Sandy";
            if (sand > 50 && clay > 20) return "Sandy Loam";
            if (silt > 50) return "Alluvial"; 
            if (ph < 6.0 && (lat > 30 || lat < -30)) return "Forest";

            return "Loamy";
        };

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
                    const soilUrl = `https://rest.isric.org/soilgrids/v2.0/properties/query?lon=${longitude}&lat=${latitude}&property=clay&property=sand&property=silt&property=phh2o&depth=0-5cm&value=mean`;
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
                        let finalPh = "6.5", finalDetectedSoil = "Loamy";
                        
                        // NEW: Calculate the season based on the current month
                        const m = new Date().getMonth() + 1; 
                        let finalSeason = "Kharif";
                        if (m >= 3 && m <= 6) {
                            finalSeason = "Zaid";
                        } else if (m >= 11 || m <= 2) {
                            finalSeason = "Rabi";
                        }

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
                                
                                // Use 12.17 (Months in a year) instead of 52/30
                                finalRain = (totalThirtyDays * 12.17).toFixed(0);
                                
                                // Optional: Keep it within your UI slider's max limit
                                if (finalRain > 1500) finalRain = 1500; 
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
                                finalDetectedSoil = classifySoil({
                                    clayRaw: getPropMean('clay'),
                                    sandRaw: getPropMean('sand'),
                                    siltRaw: getPropMean('silt'),
                                    ph: parseFloat(finalPh)
                                }, latitude, longitude);
                            }
                        }

                        // Update UI Elements
                        inputs.temp.value = finalTemp; labels.temp.innerText = finalTemp;
                        inputs.hum.value = finalHum; labels.hum.innerText = finalHum;
                        inputs.rain.value = finalRain; labels.rain.innerText = finalRain;
                        inputs.ph.value = finalPh; labels.ph.innerText = finalPh;
                        soilSelect.value = finalDetectedSoil;

                        // NEW: Apply the calculated season and trigger the UI update
                        if (seasonSelect) {
                            seasonSelect.value = finalSeason;
                            seasonSelect.dispatchEvent(new Event('change', { bubbles: true }));
                        }

                        // KEEPING YOUR ORIGINAL GEO & TOAST CODE INTACT:
                        if (geo.status === 'fulfilled' && geo.value.address) {
                            const city = geo.value.address.city || geo.value.address.county || geo.value.address.state || "Unknown Region";
                            document.getElementById('current-location-text').innerText = city;
                            document.getElementById('location-display').classList.remove('hidden');
                        }

                        showToast("Live data successfully fetched!", "fa-check-circle");
                    } catch (err) {
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