// App Configuration
const CONFIG = {
    PASSCODE: '1234',
    CSV_PATH: 'data/stocks.csv',
    DEFAULT_SYMBOL_SHOW: ['2330', '2317', '50', '2881'],
};

// State Management
let state = {
    isAuthenticated: false,
    stocks: [],
    selectedSymbols: JSON.parse(localStorage.getItem('selectedSymbols')) || CONFIG.DEFAULT_SYMBOL_SHOW,
    apiKey: localStorage.getItem('geminiApiKey') || '',
    mongo: {
        cluster: localStorage.getItem('mongoCluster') || '',
        db: localStorage.getItem('mongoDB') || '',
        col: localStorage.getItem('mongoCol') || '',
        key: localStorage.getItem('mongoKey') || '',
        endpoint: localStorage.getItem('mongoEndpoint') || '',
    },
    cat1Filter: 'all',
    cat2Filter: 'all',
    sortCol: null,      // 'value' | 'volume' | 'pnl'
    sortDir: 'desc',    // 'asc' | 'desc'
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
    cat1Filter: document.getElementById('cat1-filter'),
    cat2Filter: document.getElementById('cat2-filter'),
    openSettings: document.getElementById('open-settings'),
    closeSettings: document.getElementById('close-settings'),
    saveSettings: document.getElementById('save-settings'),
    settingsModal: document.getElementById('settings-modal'),
    settingsList: document.getElementById('settings-list'),
    apiKeyInput: document.getElementById('api-key-input'),
    mongoCluster: document.getElementById('mongo-cluster'),
    mongoDB: document.getElementById('mongo-db'),
    mongoCol: document.getElementById('mongo-col'),
    mongoKey: document.getElementById('mongo-key'),
    mongoEndpoint: document.getElementById('mongo-endpoint'),
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
    
    if (state.apiKey) elements.apiKeyInput.value = state.apiKey;
    if (state.mongo.cluster) elements.mongoCluster.value = state.mongo.cluster;
    if (state.mongo.db) elements.mongoDB.value = state.mongo.db;
    if (state.mongo.col) elements.mongoCol.value = state.mongo.col;
    if (state.mongo.key) elements.mongoKey.value = state.mongo.key;
    if (state.mongo.endpoint) elements.mongoEndpoint.value = state.mongo.endpoint;
    
    // Category level 1 filter
    elements.cat1Filter.addEventListener('change', (e) => {
        state.cat1Filter = e.target.value;
        state.cat2Filter = 'all';
        populateCat2Filter(); // refresh sub-filter
        renderStocks();
    });

    // Category level 2 filter
    elements.cat2Filter.addEventListener('change', (e) => {
        state.cat2Filter = e.target.value;
        renderStocks();
    });

    // Sortable column headers
    document.querySelectorAll('th.sortable').forEach(th => {
        th.addEventListener('click', () => {
            const col = th.dataset.col;
            if (state.sortCol === col) {
                state.sortDir = state.sortDir === 'asc' ? 'desc' : 'asc';
            } else {
                state.sortCol = col;
                state.sortDir = 'desc';
            }
            // Update header icons
            document.querySelectorAll('th.sortable').forEach(h => {
                h.classList.remove('sort-asc', 'sort-desc');
                h.querySelector('.sort-icon').textContent = '⇅';
            });
            th.classList.add(state.sortDir === 'asc' ? 'sort-asc' : 'sort-desc');
            th.querySelector('.sort-icon').textContent = state.sortDir === 'asc' ? '↑' : '↓';
            renderStocks();
        });
    });

    const authed = sessionStorage.getItem('isAuthed');
    if (authed === 'true') showDashboard();
});

// Login
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
}

// CSV Parsing
async function loadCSVData() {
    try {
        const response = await fetch(CONFIG.CSV_PATH);
        const csvText = await response.text();
        const rows = csvText.split('\n').filter(row => row.trim() !== '');
        if (rows.length === 0) return;

        const headers = rows[0].split(',');
        const data = rows.slice(1).map(row => {
            const values = row.split(',');
            const obj = {};
            headers.forEach((header, index) => {
                obj[header.trim()] = values[index] ? values[index].trim() : '';
            });
            return obj;
        });

        const latestMap = new Map();
        data.forEach(item => latestMap.set(item.code, item));
        state.stocks = Array.from(latestMap.values());

        populateCat1Filter();
        renderSettings();
    } catch (err) {
        console.error('Error loading CSV:', err);
    }
}

// Market Data Fetching
async function fetchMarketData() {
    const symbols = {
        'NDX': '^NDX', 'S&P500': '^GSPC', 'VIX': '^VIX',
        'TAIEX': '^TWII', 'USDTWD': 'TWD=X', 'NVDA': 'NVDA', 'TSM': 'TSM'
    };

    state.selectedSymbols.forEach(code => {
        if (!symbols[code]) {
            let cleanCode = code.toString().trim();
            if (!isNaN(cleanCode) && cleanCode.length <= 4) {
                cleanCode = cleanCode.padStart(4, '0');
            }
            symbols[code] = cleanCode.length <= 6 ? `${cleanCode}.TW` : cleanCode;
        }
    });

    const results = {};
    const fetchPromises = Object.entries(symbols).map(async ([key, symbol]) => {
        try {
            const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=2d`;
            const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(url)}`;
            const response = await fetch(proxyUrl);
            if (!response.ok) throw new Error('Proxy down');
            const json = await response.json();
            if (!json.chart || !json.chart.result) throw new Error('Invalid data');

            const meta = json.chart.result[0].meta;
            const quote = json.chart.result[0].indicators.quote[0];
            const price = meta.regularMarketPrice || (quote.close ? quote.close[quote.close.length - 1] : 0);
            
            let prevClose = meta.previousClose || meta.chartPreviousClose;
            if (!prevClose && quote.close && quote.close.length > 1) prevClose = quote.close[0];
            if (!prevClose) prevClose = price;

            const open = quote.open ? quote.open[quote.open.length - 1] : price;
            const high = quote.high ? quote.high[quote.high.length - 1] : price;
            const low = quote.low ? quote.low[quote.low.length - 1] : price;
            const volume = quote.volume ? quote.volume[quote.volume.length - 1] : 0;
            const value = volume * price;
            const change = price - prevClose;
            const changePercent = prevClose !== 0 ? (change / prevClose) * 100 : 0;

            results[key] = {
                val: price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
                chg: `${change >= 0 ? '+' : ''}${change.toFixed(2)} (${changePercent.toFixed(2)}%)`,
                up: change >= 0,
                open: open, high: high, low: low, prevClose: prevClose,
                volume: volume, volumeDisplay: volume > 1000 ? (volume / 1000).toFixed(0) + 'K' : volume,
                value: value, valueDisplay: (value / 1000000).toFixed(1) + 'M',
                pnlRaw: null  // filled when rendering
            };
        } catch (err) {
            console.warn(`Fetch failed for ${symbol}:`, err);
            results[key] = { val: 'Offline', chg: '0.00 (0.00%)', up: true, volume: 0, value: 0, pnlRaw: null };
        }
    });

    await Promise.all(fetchPromises);
    state.marketData = results;
    updateMarketUI();
    renderStocks();
}

function updateMarketUI() {
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
        if (valEl && chgEl && data) {
            valEl.textContent = data.val;
            chgEl.textContent = data.chg;
            chgEl.className = 'index-change ' + (data.up ? 'up' : 'down');
        }
    }
    if (state.marketData['NVDA']) {
        elements.aiLeaders.nvda.textContent = `$${state.marketData['NVDA'].val}`;
        elements.aiLeaders.nvda.className = state.marketData['NVDA'].up ? 'up' : 'down';
    }
    if (state.marketData['TSM']) {
        elements.aiLeaders.tsm.textContent = `$${state.marketData['TSM'].val}`;
        elements.aiLeaders.tsm.className = state.marketData['TSM'].up ? 'up' : 'down';
    }
}

// ── Category Filters ──────────────────────────────────────────────
function populateCat1Filter() {
    const cats = [...new Set(state.stocks.map(s => s.category_lvl1))].filter(Boolean).sort();
    elements.cat1Filter.innerHTML = '<option value="all">All Types</option>';
    cats.forEach(cat => {
        const opt = document.createElement('option');
        opt.value = cat;
        opt.textContent = cat;
        elements.cat1Filter.appendChild(opt);
    });
    populateCat2Filter();
}

function populateCat2Filter() {
    // Only show sub-categories that belong to the selected lvl1
    const source = state.cat1Filter === 'all'
        ? state.stocks
        : state.stocks.filter(s => s.category_lvl1 === state.cat1Filter);
    const cats = [...new Set(source.map(s => s.category_lvl2))].filter(Boolean).sort();
    elements.cat2Filter.innerHTML = '<option value="all">All Sectors</option>';
    cats.forEach(cat => {
        const opt = document.createElement('option');
        opt.value = cat;
        opt.textContent = cat;
        elements.cat2Filter.appendChild(opt);
    });
}

// ── Render Table ───────────────────────────────────────────────────
function renderStocks() {
    elements.stockTbody.innerHTML = '';

    // 1. Filter
    let filtered = state.stocks.filter(s => {
        const selected = state.selectedSymbols.includes(s.code);
        const lvl1 = state.cat1Filter === 'all' || s.category_lvl1 === state.cat1Filter;
        const lvl2 = state.cat2Filter === 'all' || s.category_lvl2 === state.cat2Filter;
        return selected && lvl1 && lvl2;
    });

    // 2. Attach numeric PNL / value / volume for sorting
    filtered = filtered.map(stock => {
        const live = state.marketData[stock.code] || {};
        const priceNum = live.val && live.val !== 'Offline' ? parseFloat(live.val.replace(/,/g, '')) : null;
        const pnl = priceNum ? ((priceNum - parseFloat(stock.price)) / parseFloat(stock.price)) * 100 : null;
        return { ...stock, _live: live, _pnl: pnl };
    });

    // 3. Sort
    if (state.sortCol) {
        const dir = state.sortDir === 'asc' ? 1 : -1;
        filtered.sort((a, b) => {
            let va, vb;
            if (state.sortCol === 'pnl') { va = a._pnl ?? -Infinity; vb = b._pnl ?? -Infinity; }
            else if (state.sortCol === 'value') { va = a._live.value ?? 0; vb = b._live.value ?? 0; }
            else if (state.sortCol === 'volume') { va = a._live.volume ?? 0; vb = b._live.volume ?? 0; }
            return (va - vb) * dir;
        });
    }

    // 4. Render rows
    filtered.forEach(stock => {
        const live = stock._live;
        const pnl = stock._pnl;
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>
                <div style="font-weight: 600;">${stock.stock_name}</div>
                <div style="font-size: 0.75rem; color: var(--text-dim);">${stock.code}</div>
            </td>
            <td>
                <div style="font-size: 0.82rem; color: var(--text-dim);">${live.open && !isNaN(live.open) ? 'O: ' + live.open.toFixed(2) : '--'}</div>
                <div style="font-weight: 700; color: ${live.up ? 'var(--success)' : 'var(--danger)'}">${live.val || '--'}</div>
            </td>
            <td style="font-size: 0.85rem; line-height: 1.4;">
                <div>H: ${live.high && !isNaN(live.high) ? live.high.toFixed(2) : '--'}</div>
                <div style="color: var(--text-dim);">L: ${live.low && !isNaN(live.low) ? live.low.toFixed(2) : '--'}</div>
            </td>
            <td>${live.valueDisplay || '--'}</td>
            <td>${live.volumeDisplay || '--'}</td>
            <td class="${pnl !== null ? (pnl >= 0 ? 'up' : 'down') : ''}">
                ${pnl !== null ? (pnl >= 0 ? '+' : '') + pnl.toFixed(2) + '%' : '--'}
            </td>
            <td>
                <div style="font-size: 0.75rem; background: rgba(255,255,255,0.05); padding: 3px 8px; border-radius: 4px; display:inline-block;">${stock.category_lvl1}</div>
                <div style="font-size: 0.7rem; color: var(--text-dim); margin-top: 2px;">${stock.category_lvl2}</div>
            </td>
        `;
        elements.stockTbody.appendChild(row);
    });

    document.getElementById('table-stats').textContent = `Showing ${filtered.length} of ${state.stocks.length} assets`;
}

// ── Settings ───────────────────────────────────────────────────────
elements.openSettings.onclick = () => elements.settingsModal.style.display = 'flex';
elements.closeSettings.onclick = () => elements.settingsModal.style.display = 'none';

function renderSettings() {
    elements.settingsList.innerHTML = '';
    const sorted = [...state.stocks].sort((a, b) => a.stock_name.localeCompare(b.stock_name));
    sorted.forEach(stock => {
        const div = document.createElement('div');
        div.style.cssText = 'padding:.75rem;margin-bottom:.5rem;background:rgba(255,255,255,0.03);border-radius:10px;display:flex;align-items:center;gap:1rem;cursor:pointer;';
        const checked = state.selectedSymbols.includes(stock.code) ? 'checked' : '';
        div.innerHTML = `
            <input type="checkbox" id="check-${stock.code}" ${checked} style="width:18px;height:18px;">
            <label for="check-${stock.code}" style="flex-grow:1;cursor:pointer;">
                ${stock.stock_name} (${stock.code})
                <span style="display:block;font-size:0.7rem;color:var(--text-dim);">${stock.category_lvl1} › ${stock.category_lvl2}</span>
            </label>
        `;
        div.onclick = (e) => {
            if (e.target.tagName !== 'INPUT') div.querySelector('input').checked = !div.querySelector('input').checked;
        };
        elements.settingsList.appendChild(div);
    });
}

elements.saveSettings.onclick = () => {
    const selected = Array.from(elements.settingsList.querySelectorAll('input[type="checkbox"]'))
        .filter(cb => cb.checked).map(cb => cb.id.replace('check-', ''));
    state.selectedSymbols = selected;
    state.apiKey = elements.apiKeyInput.value;
    state.mongo = {
        cluster: elements.mongoCluster.value, db: elements.mongoDB.value,
        col: elements.mongoCol.value, key: elements.mongoKey.value, endpoint: elements.mongoEndpoint.value,
    };
    localStorage.setItem('selectedSymbols', JSON.stringify(selected));
    localStorage.setItem('geminiApiKey', state.apiKey);
    localStorage.setItem('mongoCluster', state.mongo.cluster);
    localStorage.setItem('mongoDB', state.mongo.db);
    localStorage.setItem('mongoCol', state.mongo.col);
    localStorage.setItem('mongoKey', state.mongo.key);
    localStorage.setItem('mongoEndpoint', state.mongo.endpoint);
    fetchMarketData();
    elements.settingsModal.style.display = 'none';
};

// ── AI Analysis ────────────────────────────────────────────────────
elements.nextBtn.onclick = async () => {
    elements.aiResponse.style.display = 'block';
    elements.aiText.textContent = 'Contacting AI Agent...';

    const portfolioData = state.stocks
        .filter(s => state.selectedSymbols.includes(s.code))
        .map(s => {
            const l = state.marketData[s.code] || {};
            return `名稱: ${s.stock_name}, 代碼: ${s.code}, 現價: ${l.val}, 量: ${l.volumeDisplay}, 漲跌: ${l.chg}`;
        }).join('\n');

    const marketContext = Object.entries(state.marketData)
        .filter(([k]) => ['NDX', 'S&P500', 'TAIEX', 'VIX'].includes(k))
        .map(([k, v]) => `${k}: ${v.val} (${v.chg})`).join(', ');

    const macroValues = `NVDA: ${state.marketData['NVDA']?.val}, TSMC: ${state.marketData['TSM']?.val}`;

    saveSnapshotToMongo(marketContext, portfolioData);

    if (state.apiKey) {
        try {
            const finalPrompt = AI_PROMPTS.formatPrompt(marketContext, portfolioData, macroValues);
            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${state.apiKey}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ contents: [{ parts: [{ text: finalPrompt }] }] })
            });
            const result = await response.json();
            const aiText = result.candidates[0].content.parts[0].text;
            elements.aiText.innerHTML = aiText.replace(/\n/g, '<br>').replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        } catch (err) {
            elements.aiText.innerHTML = `<span style="color:var(--danger)">分析失敗: ${err.message}</span>`;
        }
    } else {
        setTimeout(() => {
            elements.aiText.innerHTML = "<strong>[Demo Mode]</strong> Please enter Gemini API Key in Settings for live analysis.";
        }, 1500);
    }
};

async function saveSnapshotToMongo(marketContext, portfolioData) {
    if (!state.mongo.key || !state.mongo.endpoint) return;
    const payload = {
        dataSource: state.mongo.cluster, database: state.mongo.db, collection: state.mongo.col,
        document: { timestamp: new Date().toISOString(), market: marketContext, portfolio: portfolioData }
    };
    try {
        await fetch(`${state.mongo.endpoint}/action/insertOne`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'api-key': state.mongo.key },
            body: JSON.stringify(payload)
        });
        console.log('✅ Saved to MongoDB');
    } catch (err) {
        console.error('❌ MongoDB Error:', err);
    }
}
