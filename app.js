// App Configuration
const CONFIG = {
    PASSCODE: '1234', // Simple passcode as requested
    CSV_PATH: 'data/stocks.csv',
    DEFAULT_SYMBOL_SHOW: ['2330', '2317', '50', '2881'], // Default selected stocks
};

// State Management
let state = {
    isAuthenticated: false,
    stocks: [],
    selectedSymbols: JSON.parse(localStorage.getItem('selectedSymbols')) || CONFIG.DEFAULT_SYMBOL_SHOW,
    apiKey: localStorage.getItem('geminiApiKey') || '',
    marketData: {}
};

// DOM Elements
const elements = {
    loginOverlay: document.getElementById('login-overlay'),
    loginForm: document.getElementById('login-form'),
    passwordInput: document.getElementById('password'),
    loginError: document.getElementById('login-error'),
    dashboard: document.getElementById('dashboard'),
    stockTbody: document.getElementById('stock-tbody'),
    aiLeaders: {
        nvda: document.getElementById('val-nvda'),
        tsm: document.getElementById('val-tsm')
    },
    indices: {
        ndx: { val: document.getElementById('val-ndx'), chg: document.getElementById('chg-ndx') },
        sp500: { val: document.getElementById('val-sp500'), chg: document.getElementById('chg-sp500') },
        vix: { val: document.getElementById('val-vix'), chg: document.getElementById('chg-vix') },
        taiex: { val: document.getElementById('val-taiex'), chg: document.getElementById('chg-taiex') },
        usdtwd: { val: document.getElementById('val-usdtwd'), chg: document.getElementById('chg-usdtwd') }
    },
    openSettings: document.getElementById('open-settings'),
    closeSettings: document.getElementById('close-settings'),
    saveSettings: document.getElementById('save-settings'),
    settingsModal: document.getElementById('settings-modal'),
    settingsList: document.getElementById('settings-list'),
    apiKeyInput: document.getElementById('api-key-input'),
    nextBtn: document.getElementById('next-btn'),
    aiResponse: document.getElementById('ai-response'),
    aiText: document.getElementById('ai-text'),
    currentDate: document.getElementById('current-date')
};

// Initialization
document.addEventListener('DOMContentLoaded', () => {
    elements.currentDate.textContent = new Date().toLocaleDateString('en-US', { 
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' 
    });
    
    // Load API key to input
    if (state.apiKey) elements.apiKeyInput.value = state.apiKey;
    
    // Check local storage for auth (session based)
    const authed = sessionStorage.getItem('isAuthed');
    if (authed === 'true') {
        showDashboard();
    }
});

// Login Logic
elements.loginForm.addEventListener('submit', (e) => {
    e.preventDefault();
    if (elements.passwordInput.value === CONFIG.PASSCODE) {
        sessionStorage.setItem('isAuthed', 'true');
        showDashboard();
    } else {
        elements.loginError.style.display = 'block';
    }
});

function showDashboard() {
    elements.loginOverlay.classList.add('hidden');
    elements.dashboard.style.display = 'block';
    initApp();
}

async function initApp() {
    await loadCSVData();
    await fetchMarketData();
    renderStocks();
    updateAILeaders();
}

// CSV Parsing
async function loadCSVData() {
    try {
        const response = await fetch(CONFIG.CSV_PATH);
        const csvText = await response.text();
        const rows = csvText.split('\n').filter(row => row.trim() !== '');
        const headers = rows[0].split(',');
        
        const data = rows.slice(1).map(row => {
            const values = row.split(',');
            const obj = {};
            headers.forEach((header, index) => {
                obj[header.trim()] = values[index] ? values[index].trim() : '';
            });
            return obj;
        });

        // Get latest record for each code
        const latestMap = new Map();
        data.forEach(item => {
            // Assuimg created_at or just order matters. 
            // In the provided CSV, they seem to be all from same date.
            // We'll keep the last one found for each code.
            latestMap.set(item.code, item);
        });
        
        state.stocks = Array.from(latestMap.values());
        
        // Populate settings list with unique stocks from CSV
        renderSettings();
    } catch (err) {
        console.error('Error loading CSV:', err);
    }
}

// Market Data Fetching (Real Data via CORS Proxy)
async function fetchMarketData() {
    const symbols = {
        'NDX': '^NDX',
        'S&P500': '^GSPC',
        'VIX': '^VIX',
        'TAIEX': '^TWII',
        'USDTWD': 'TWD=X',
        'NVDA': 'NVDA',
        'TSM': 'TSM'
    };

    // Add selected personal stocks to symbols list
    state.selectedSymbols.forEach(code => {
        if (!symbols[code]) {
            // Heuristic for Taiwan stocks
            symbols[code] = code.length <= 5 && !isNaN(code) ? `${code}.TW` : code;
        }
    });

    const results = {};
    const fetchPromises = Object.entries(symbols).map(async ([key, symbol]) => {
        try {
            // Using allorigins proxy to bypass CORS
            const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(`https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=2d`)}`;
            const response = await fetch(proxyUrl);
            const data = await response.json();
            const json = JSON.parse(data.contents);
            
            const meta = json.chart.result[0].meta;
            const quote = json.chart.result[0].indicators.quote[0];
            const price = meta.regularMarketPrice;
            const prevClose = meta.previousClose;
            const change = price - prevClose;
            const changePercent = (change / prevClose) * 100;
            const volume = quote.volume[quote.volume.length - 1];
            const high = quote.high[quote.high.length - 1];
            const low = quote.low[quote.low.length - 1];

            results[key] = {
                val: price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
                chg: `${change >= 0 ? '+' : ''}${change.toFixed(2)} (${changePercent.toFixed(2)}%)`,
                up: change >= 0,
                volume: volume ? (volume / 1000000).toFixed(2) + 'M' : '--',
                range: `${low?.toFixed(2)} - ${high?.toFixed(2)}`
            };
        } catch (err) {
            console.error(`Error fetching ${symbol}:`, err);
            results[key] = { val: 'Error', chg: '--', up: true };
        }
    });

    await Promise.all(fetchPromises);
    state.marketData = results;
    updateMarketUI();
}

function updateMarketUI() {
    // Indices
    const map = {
        'val-ndx': state.marketData['NDX'],
        'val-sp500': state.marketData['S&P500'],
        'val-vix': state.marketData['VIX'],
        'val-taiex': state.marketData['TAIEX'],
        'val-usdtwd': state.marketData['USDTWD']
    };

    for (const [id, data] of Object.entries(map)) {
        const valEl = document.getElementById(id);
        const chgEl = document.getElementById('chg-' + id.split('-')[1]);
        if (valEl && chgEl) {
            valEl.textContent = data.val;
            chgEl.textContent = data.chg;
            chgEl.className = 'index-change ' + (data.up ? 'up' : 'down');
        }
    }

    // AI Leaders
    elements.aiLeaders.nvda.textContent = `$${state.marketData['NVDA'].val}`;
    elements.aiLeaders.nvda.className = state.marketData['NVDA'].up ? 'up' : 'down';
    elements.aiLeaders.tsm.textContent = `$${state.marketData['TSM'].val}`;
    elements.aiLeaders.tsm.className = state.marketData['TSM'].up ? 'up' : 'down';
}

function renderStocks() {
    elements.stockTbody.innerHTML = '';
    
    // Filter stocks based on selection
    const filtered = state.stocks.filter(s => state.selectedSymbols.includes(s.code));
    
    filtered.forEach(stock => {
        const row = document.createElement('tr');
        
        // Attempt to find real price from market data
        // For TW stocks, CSV says '2330', Yahoo wants '2330.TW' or we already fetched it as 'TSM' etc.
        // We'll update fetchMarketData to include selected symbols.
        
        let liveVal = state.marketData[stock.code];
        let latestPrice = liveVal ? parseFloat(liveVal.val.replace(/,/g, '')) : parseFloat(stock.price);
        
        const pnl = ((latestPrice - parseFloat(stock.price)) / parseFloat(stock.price)) * 100;
        
        row.innerHTML = `
            <td>
                <div style="font-weight: 600;">${stock.stock_name}</div>
                <div style="font-size: 0.75rem; color: var(--text-dim);">${stock.code}</div>
            </td>
            <td>${stock.unit}</td>
            <td>
                <div style="font-size: 0.85rem; color: var(--text-dim);">$${parseFloat(stock.price).toLocaleString()}</div>
                <div style="font-weight: 700;">${liveVal ? '$' + latestPrice.toLocaleString() : '...'}</div>
            </td>
            <td style="font-size: 0.9rem;">${liveVal ? liveVal.volume : '--'}</td>
            <td style="font-size: 0.8rem; color: var(--text-dim);">${liveVal ? liveVal.range : '--'}</td>
            <td class="${pnl >= 0 ? 'up' : 'down'}">${pnl >= 0 ? '+' : ''}${pnl.toFixed(2)}%</td>
        `;
        elements.stockTbody.appendChild(row);
    });

    document.getElementById('table-stats').textContent = `Showing ${filtered.length} of ${state.stocks.length} assets`;
}

// Settings Logic
elements.openSettings.onclick = () => {
    elements.settingsModal.style.display = 'flex';
};

elements.closeSettings.onclick = () => {
    elements.settingsModal.style.display = 'none';
};

function renderSettings() {
    elements.settingsList.innerHTML = '';
    
    // Sort stocks by name
    const sorted = [...state.stocks].sort((a, b) => a.stock_name.localeCompare(b.stock_name));
    
    sorted.forEach(stock => {
        const div = document.createElement('div');
        div.style.padding = '0.75rem';
        div.style.marginBottom = '0.5rem';
        div.style.background = 'rgba(255,255,255,0.03)';
        div.style.borderRadius = '10px';
        div.style.display = 'flex';
        div.style.alignItems = 'center';
        div.style.gap = '1rem';
        div.style.cursor = 'pointer';
        
        const checked = state.selectedSymbols.includes(stock.code) ? 'checked' : '';
        
        div.innerHTML = `
            <input type="checkbox" id="check-${stock.code}" ${checked} style="width: 18px; height: 18px;">
            <label for="check-${stock.code}" style="flex-grow: 1; cursor: pointer;">
                ${stock.stock_name} (${stock.code})
                <span style="display: block; font-size: 0.7rem; color: var(--text-dim);">${stock.category_lvl1} - ${stock.category_lvl2}</span>
            </label>
        `;
        
        div.onclick = (e) => {
            if (e.target.tagName !== 'INPUT') {
                const cb = div.querySelector('input');
                cb.checked = !cb.checked;
            }
        };
        
        elements.settingsList.appendChild(div);
    });
}

elements.saveSettings.onclick = () => {
    const checkboxes = elements.settingsList.querySelectorAll('input[type="checkbox"]');
    const selected = [];
    checkboxes.forEach(cb => {
        if (cb.checked) {
            selected.push(cb.id.replace('check-', ''));
        }
    });
    
    state.selectedSymbols = selected;
    state.apiKey = elements.apiKeyInput.value;
    localStorage.setItem('selectedSymbols', JSON.stringify(selected));
    localStorage.setItem('geminiApiKey', state.apiKey);
    fetchMarketData(); // Re-fetch for potential new symbols
    renderStocks();
    elements.settingsModal.style.display = 'none';
};

// LLM Interaction
elements.nextBtn.onclick = async () => {
    elements.aiResponse.style.display = 'block';
    elements.aiText.textContent = 'Contacting intelligence core...';
    
    const portfolioData = state.stocks
        .filter(s => state.selectedSymbols.includes(s.code))
        .map(s => {
            const live = state.marketData[s.code] || {};
            return `${s.stock_name}: Cost $${s.price}, Current $${live.val || 'N/A'}, Vol ${live.volume || 'N/A'}`;
        })
        .join('\n');
        
    const marketContext = Object.entries(state.marketData)
        .filter(([k]) => ['NDX', 'S&P500', 'TAIEX', 'VIX'].includes(k))
        .map(([k, v]) => `${k}: ${v.val} (${v.chg})`)
        .join(', ');

    if (state.apiKey) {
        try {
            const finalPrompt = AI_PROMPTS.formatPrompt(marketContext, portfolioData);
            
            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${state.apiKey}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: finalPrompt }] }]
                })
            });
            
            const result = await response.json();
            const aiText = result.candidates[0].content.parts[0].text;
            elements.aiText.innerHTML = aiText.replace(/\n/g, '<br>').replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        } catch (err) {
            elements.aiText.innerHTML = `<span style="color: var(--danger)">Error calling Gemini Agent: ${err.message}. Check your API key.</span>`;
        }
    } else {
        // Fallback to mock for demo (but with agent branding)
        setTimeout(() => {
            elements.aiText.innerHTML = `
                <div style="color: var(--primary); font-weight: 700; margin-bottom: 0.5rem;">[QUANTUM STRATEGIST AGENT]</div>
                <strong>Market Sentiment:</strong> Demo insights based on ${marketContext}. Indices show strong support.<br><br>
                <strong>Agent Recommendation:</strong> Your portfolio setup is optimized for tech growth. Enable your <strong>Gemini API Key</strong> in Settings to activate full agentic reasoning on your live volumes.
            `;
        }, 1500);
    }
};
