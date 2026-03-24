// data_share.js

const predictBtn = document.getElementById('predict-btn');

const showToast = (message, icon = 'fa-info-circle') => {
    const toast = document.getElementById('toast');
    const toastMsg = document.getElementById('toast-message');
    const toastIcon = document.getElementById('toast-icon');
    
    if (toastMsg) toastMsg.innerText = message;
    if (toastIcon) toastIcon.className = `fas ${icon} text-[#1F7D53]`;
    
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 4000);
};

predictBtn.addEventListener('click', async () => {
    // 1. Gather Payload from Inputs
    const payload = {
        nitrogen: parseInt(document.getElementById('input-n').value),
        phosphorus: parseInt(document.getElementById('input-p').value),
        potassium: parseInt(document.getElementById('input-k').value),
        temperature: parseFloat(document.getElementById('input-temp').value),
        humidity: parseInt(document.getElementById('input-hum').value),
        rainfall: parseInt(document.getElementById('input-rain').value),
        ph: parseFloat(document.getElementById('input-ph').value),
        soilType: document.getElementById('soil-select').value,
        season: document.getElementById('season-select').value
    };

    // 2. Button Loading State
    const originalBtnText = predictBtn.innerHTML;
    predictBtn.innerHTML = '<i class="fas fa-spinner animate-spin"></i> Analyzing...';
    predictBtn.disabled = true;

    // 3. UI Reveal Logic
    // FIX: Shrink the input panel from 12 columns to 7 to make room for the 5-column sidebar
    const inputPanel = document.getElementById('input-panel');
    inputPanel.classList.remove('lg:col-span-12');
    inputPanel.classList.add('lg:col-span-7');

    // Show the results column (the sidebar wrapper)
    document.getElementById('results-column').classList.remove('hidden');
    
    // Hide previous content and show the loader
    document.getElementById('result-content').classList.add('hidden');
    document.getElementById('result-loading').classList.remove('hidden');
    
    // Trigger the slide-in animation class
    setTimeout(() => {
        document.getElementById('results-animated-container').classList.add('active');
    }, 50);

    try {
        const response = await fetch('/predict', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

        const result = await response.json();
        const top5 = result.recommendations;

        // 4. Update the MAIN TOP Card (#1 Result)
        const topName = document.getElementById('top-crop-name');
        const topConf = document.getElementById('top-crop-conf');
        
        if (topName) topName.innerText = top5[0].crop;
        if (topConf) topConf.innerText = `Confidence Score: ${Number(top5[0].confidence).toFixed(2)}%`;

        // 5. Update the ALTERNATIVE List (Crops #2 - #5)
        const altList = document.getElementById('alternative-list');
        if (altList) {
            altList.innerHTML = ''; // Clear existing items
            
            // Start from index 1 (second crop) to avoid duplicating the top one
            top5.slice(1).forEach((item, index) => {
                const itemDiv = document.createElement('div');
                itemDiv.className = "flex justify-between items-center p-4 bg-slate-50 rounded-2xl border border-slate-100 hover:border-emerald-200 transition-all duration-300";
                itemDiv.innerHTML = `
                    <div class="flex items-center gap-3">
                        <span class="flex items-center justify-center w-6 h-6 rounded-full bg-slate-200 text-slate-500 text-[10px] font-bold">${index + 2}</span>
                        <span class="font-bold text-slate-700">${item.crop}</span>
                    </div>
                    <span class="text-xs font-black text-[#1F7D53]">${Number(item.confidence).toFixed(2)}%</span>
                `;
                altList.appendChild(itemDiv);
            });
        }

        // 6. Switch from Loader to Content
        document.getElementById('result-loading').classList.add('hidden');
        document.getElementById('result-content').classList.remove('hidden');
        
        showToast("Analysis Successful", "fa-check-circle");

    } catch (error) {
        console.error("Error:", error);
        showToast("Model connection failed.", "fa-xmark-circle");
        document.getElementById('result-loading').classList.add('hidden');
        
        // Optional UI reset on failure: If the API fails, return the UI back to normal
        // inputPanel.classList.remove('lg:col-span-7');
        // inputPanel.classList.add('lg:col-span-12');
        // document.getElementById('results-column').classList.add('hidden');
        // document.getElementById('results-animated-container').classList.remove('active');
    } finally {
        predictBtn.innerHTML = originalBtnText;
        predictBtn.disabled = false;
    }
});