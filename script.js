// Navigation
window.switchTab = (name) => {
    const id = `section-${name.toLowerCase().trim()}`;
    const el = document.getElementById(id);
    if (el) {
        document.querySelectorAll('.view-section').forEach(s => s.classList.remove('active'));
        el.classList.add('active');
        document.querySelectorAll('.nav-links li').forEach(li => {
            li.classList.toggle('active', li.innerText.toLowerCase().includes(name.toLowerCase()));
        });
        window.dispatchEvent(new Event('resize'));
        if (window.triggerUIUpdate) window.triggerUIUpdate();
    }
};

document.addEventListener('DOMContentLoaded', () => {
    // --- 1. State & Privacy ---
    const FAKE_STATE = {
        expenses: [
            { date: '20260401', category: 'Food', amount: 450, type: 'EXP', account: 'Cash', memo: 'Example Lunch', uuidCode: 'f1' },
            { date: '20260402', category: 'Housing', amount: 2500, type: 'EXP', account: 'Bank', memo: 'Monthly Rent', uuidCode: 'f2' },
            { date: '20260405', category: 'Salary', amount: 5000, type: 'INC', account: 'Bank', memo: 'Payroll', uuidCode: 'f3' }
        ],
        stocks: [
            { symbol: 'AAPL', name: 'Apple Inc.', purchasePrice: 150, shares: 10, logo: 'A', price: 175, change: 1.2 },
            { symbol: 'TSLA', name: 'Tesla, Inc.', purchasePrice: 200, shares: 5, logo: 'T', price: 185, change: -0.5 }
        ]
    };

    let realData = { stocks: [], expenses: [] };
    let isUnlocked = sessionStorage.getItem('wp_unlocked') === 'true';

    let state = {
        stocks: isUnlocked ? [] : [...FAKE_STATE.stocks],
        expenses: isUnlocked ? [] : [...FAKE_STATE.expenses],
        property: { value: 1250000, growth: 12.5 }
    };

    const save = () => {
        if (!isUnlocked) return;
        localStorage.setItem('wp_stocks', JSON.stringify(realData.stocks));
        localStorage.setItem('wp_expenses', JSON.stringify(realData.expenses));
    };

    // --- New: Load from repo-backed CSV & JSON ---
    const loadRepoData = async () => {
        try {
            // 1. Load Stocks
            const stockRes = await fetch('./data/stocks.json');
            if (stockRes.ok) realData.stocks = await stockRes.json();

            // 2. Load CSV Data
            const csvUrl = './data/Pennyworth_Income&Expense_20260328211903.csv';
            const csvRes = await fetch(csvUrl);
            if (csvRes.ok) {
                const csvText = await csvRes.text();
                const lines = csvText.split('\n');
                const added = [];
                for (let i = 1; i < lines.length; i++) {
                    if (!lines[i].trim()) continue;
                    const v = lines[i].split(',').map(c => c.trim());
                    const typeVal = v[v.length - 3] || 'EXP';
                    added.push({ 
                        date: v[0] || '', category: v[1] || 'Others', amount: parseFloat(v[3]) || 0, 
                        currency: v[4] || 'TWD', account: v[6] || 'Default', 
                        type: typeVal.toUpperCase().includes('INC') ? 'INC' : 'EXP', 
                        memo: v[8] || '', uuidCode: v[v.length - 1] || self.crypto.randomUUID()
                    });
                }
                realData.expenses = added;
            }

            // Apply data based on lock status
            if (isUnlocked) {
                state.expenses = realData.expenses;
                state.stocks = realData.stocks;
            } else {
                state.expenses = [...FAKE_STATE.expenses];
                state.stocks = [...FAKE_STATE.stocks];
            }
            
            window.triggerUIUpdate();
        } catch (e) {
            console.log("Data fetch failed:", e.message);
        }
    };

    // --- 2. Utils & Parsing ---
    const parseDateObj = (dateStr) => {
        if (!dateStr) return { y: '0000', m: '00' };
        let str = String(dateStr).trim();
        // Handle YYYYMMDD
        if (str.length === 8 && !str.includes('-') && !str.includes('/')) {
            return { y: str.substring(0, 4), m: str.substring(4, 6) };
        }
        // Handle YYYY-MM-DD or YYYY/MM/DD
        const parts = str.split(/[-/]/);
        if (parts.length >= 2) {
            // Assume YYYY at start if length is 4
            if (parts[0].length === 4) return { y: parts[0], m: parts[1].padStart(2, '0') };
            // Assume YYYY at end if length is 4
            if (parts[2]?.length === 4) return { y: parts[2], m: parts[0].padStart(2, '0') };
        }
        return { y: '0000', m: '00' };
    };

    const updateYearDropdown = () => {
        const yearSelect = document.getElementById('filter-year');
        if (!yearSelect) return;
        
        const years = new Set();
        state.expenses.forEach(ex => {
            const { y } = parseDateObj(ex.date);
            if (y && y !== '0000') years.add(y);
        });

        const sortedYears = Array.from(years).sort((a, b) => b - a);
        const currentValue = yearSelect.value;
        
        let options = '<option value="all">All</option>';
        sortedYears.forEach(y => {
            options += `<option value="${y}">${y}</option>`;
        });
        yearSelect.innerHTML = options;
        
        // Restore value if it exists, else default to newest year
        if (currentValue && [...years].includes(currentValue)) {
            yearSelect.value = currentValue;
        } else if (sortedYears.length > 0) {
            yearSelect.value = sortedYears[0];
        } else {
            yearSelect.value = 'all';
        }
    };

    // --- 3. Charts ---
    let spendingChart, detailedChart;
    const colors = ['#3b82f6', '#10b981', '#8b5cf6', '#f59e0b', '#06b6d4', '#ec4899', '#f43f5e', '#6366f1'];

    const initCharts = () => {
        const ctxP = document.getElementById('portfolioHistoryChart')?.getContext('2d');
        if (ctxP) new Chart(ctxP, { type: 'line', data: { labels: ['Q1','Q2','Q3','Q4'], datasets: [{ data: [80,95,110,148], borderColor: '#10b981', tension: 0.4 }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } } });

        const ctxS = document.getElementById('spendingDonutChart')?.getContext('2d');
        if (ctxS) spendingChart = new Chart(ctxS, { type: 'doughnut', data: { labels: [], datasets: [{ data: [], backgroundColor: colors, borderWidth: 0 }] }, options: { responsive: true, maintainAspectRatio: false, cutout: '75%', plugins: { legend: { display: false } } } });

        const ctxD = document.getElementById('detailedSpendingChart')?.getContext('2d');
        if (ctxD) detailedChart = new Chart(ctxD, { type: 'pie', data: { labels: [], datasets: [{ data: [], backgroundColor: colors, borderWidth: 0 }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { color: '#94a3b8', font: { size: 10 } } } } } });
    };

    // --- 4. Logic ---
    // --- 4. Logic ---
    window.triggerUIUpdate = () => {
        const yF = document.getElementById('filter-year')?.value || 'all';
        const mF = document.getElementById('filter-month')?.value || 'all';
        const cF = document.getElementById('filter-category')?.value || 'all';
        
        const now = new Date();
        const curM = (now.getMonth() + 1).toString().padStart(2, '0');
        const curY = now.getFullYear().toString();

        let totalBalance = 0; // Cumulative across all time
        let detExp = 0, detInc = 0, detExpData = {}, filtered = [];
        let ovExp = 0, ovInc = 0, ovExpData = {};

        state.expenses.forEach(ex => {
            const { y, m } = parseDateObj(ex.date);
            const amount = parseFloat(ex.amount) || 0;
            const isInc = (ex.type === 'INC');

            // 1. Cumulative Balance Logic (Net Worth)
            if (isInc) totalBalance += amount;
            else totalBalance -= amount;

            // 2. Overview (Current Month) Logic
            if (y === curY && m === curM) {
                if (isInc) ovInc += amount;
                else {
                    ovExp += amount;
                    ovExpData[ex.category] = (ovExpData[ex.category] || 0) + amount;
                }
            }

            // 3. Detailed Report (Filtered) Logic
            const yearMatch = (yF === 'all') || (y === yF);
            const monthMatch = (mF === 'all') || (mF === 'current' && m === curM && y === curY) || (m === mF);
            const catMatch = (cF === 'all') || (ex.category === cF);

            if (yearMatch && monthMatch && catMatch) {
                filtered.push(ex);
                if (isInc) detInc += amount;
                else {
                    detExp += amount;
                    detExpData[ex.category] = (detExpData[ex.category] || 0) + amount;
                }
            }
        });

        // Add stocks to total net worth
        const stocksValue = state.stocks.reduce((acc, s) => acc + ((s.price || s.purchasePrice) * s.shares), 0);
        const finalNetWorth = totalBalance + stocksValue;

        // --- Update UI elements ---
        
        // Net Worth Hero Card
        const nwEl = document.getElementById('total-net-worth');
        if (nwEl) nwEl.textContent = `$${finalNetWorth.toLocaleString(undefined, {minimumFractionDigits: 2})}`;

        // Net Income (Month) Card
        const netOv = document.getElementById('net-income-value');
        if (netOv) {
            const net = ovInc - ovExp;
            netOv.textContent = (net >= 0 ? '+' : '-') + '$' + Math.abs(net).toLocaleString();
            netOv.style.color = net >= 0 ? 'var(--accent-emerald)' : 'var(--accent-ruby)';
        }

        // Spending Chart (Overview)
        if (spendingChart) {
            spendingChart.data.labels = Object.keys(ovExpData);
            spendingChart.data.datasets[0].data = Object.values(ovExpData);
            spendingChart.update();
            const label = document.getElementById('total-spending-value');
            if (label) label.textContent = '$' + ovExp.toLocaleString();
        }

        // Stats Panel (Detailed)
        const setVal = (id, val) => { if (document.getElementById(id)) document.getElementById(id).textContent = '$' + val.toLocaleString(); };
        setVal('stats-total-exp', detExp);
        setVal('stats-total-inc', detInc);
        const netDet = document.getElementById('stats-net-income');
        if (netDet) {
            const net = detInc - detExp;
            netDet.textContent = (net >= 0 ? '+' : '-') + '$' + Math.abs(net).toLocaleString();
            netDet.style.color = net >= 0 ? 'var(--accent-emerald)' : 'var(--accent-ruby)';
        }

        if (detailedChart) {
            detailedChart.data.labels = Object.keys(detExpData);
            detailedChart.data.datasets[0].data = Object.values(detExpData);
            detailedChart.update();
        }

        // Transaction Tables
        const fullBody = document.getElementById('full-transaction-list');
        if (fullBody) {
            fullBody.innerHTML = filtered.length === 0 ? `<tr><td colspan="6" style="text-align:center; padding: 2rem; color: var(--text-secondary);">No records found.</td></tr>` : '';
            filtered.sort((a,b) => String(b.date).localeCompare(String(a.date))).forEach(ex => {
                const row = document.createElement('tr');
                const isInc = ex.type === 'INC';
                row.innerHTML = `<td>${ex.date}</td><td>${ex.category}</td><td class="${isInc ? 'positive' : 'negative'}">${isInc ? '+' : '-'}$${parseFloat(ex.amount).toLocaleString()}</td>
                    <td>${ex.account}</td><td>${ex.memo}</td>
                    <td class="admin-only"><button class="remove-btn" onclick="window.delTask(${state.expenses.indexOf(ex)})"><i data-lucide="x"></i></button></td>`;
                fullBody.appendChild(row);
            });
        }

        const miniBody = document.getElementById('transaction-list');
        if (miniBody) {
            miniBody.innerHTML = '';
            state.expenses.filter(e => e.type === 'EXP').sort((a,b) => String(b.date).localeCompare(String(a.date))).slice(0, 5).forEach(ex => {
                const row = document.createElement('tr');
                row.innerHTML = `<td>${ex.date}</td><td>${ex.category}</td><td>$${parseFloat(ex.amount).toLocaleString()}</td><td class="admin-only"><button class="remove-btn" onclick="window.delTask(${state.expenses.indexOf(ex)})"><i data-lucide="x"></i></button></td>`;
                miniBody.appendChild(row);
            });
        }

        renderStocks();
        updateAdminUI();
        lucide.createIcons();
    };

    const renderStocks = () => {
        const list = document.getElementById('stock-list');
        if (!list) return;
        list.innerHTML = '';
        state.stocks.forEach((s, i) => {
            const row = document.createElement('tr');
            const currentPrice = s.price || s.purchasePrice; // Fallback to purchase price if fetch failed
            const currentVal = currentPrice * s.shares;
            const costBasis = s.purchasePrice * s.shares;
            const gain = currentVal - costBasis;
            const gainPct = (gain / costBasis) * 100;
            const trendClass = gain >= 0 ? 'positive' : 'negative';

            row.innerHTML = `
                <td>
                    <div class="symbol-cell">
                        <div class="symbol-icon">${s.logo || s.symbol[0]}</div>
                        <div class="symbol-info">
                            <strong>${s.symbol}</strong><br>
                            <small style="color: #64748b">${s.name} • ${s.shares} shares</small>
                        </div>
                    </div>
                </td>
                <td>
                    <div style="font-size: 0.9rem">$${currentPrice.toFixed(2)}</div>
                    <div style="font-size: 0.7rem; color: var(--text-secondary)">Cost: $${s.purchasePrice.toFixed(2)}</div>
                </td>
                <td>
                    <div class="trend ${trendClass}">${gain >= 0 ? '+' : ''}$${gain.toLocaleString(undefined, {minimumFractionDigits: 2})}</div>
                    <div style="font-size: 0.7rem; color: var(--text-secondary)">${gain >= 0 ? '+' : ''}${gainPct.toFixed(2)}%</div>
                </td>
                <td style="font-weight: 600">$${currentVal.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                <td class="admin-only"><button class="remove-btn" onclick="window.delStock(${i})"><i data-lucide="trash-2"></i></button></td>
            `;
            list.appendChild(row);
        });
    };

    // --- New: Fetch Live Prices from Internet ---
    const fetchMarketPrices = async () => {
        const btn = document.getElementById('refresh-stocks');
        if (btn) btn.classList.add('loading');
        
        try {
            // Using a free, keyless proxy for Yahoo Finance data (standard practice for static sites)
            // Note: In a production app, you'd use a dedicated service like Finnhub or Polygon.io
            const symbols = state.stocks.map(s => s.symbol).join(',');
            // Yahoo Finance Query V7
            const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${symbols}`;
            // We use a CORS proxy to bypass browser restrictions
            const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`;
            
            const response = await fetch(proxyUrl);
            const rawData = await response.json();
            const data = JSON.parse(rawData.contents);
            
            if (data.quoteResponse && data.quoteResponse.result) {
                const results = data.quoteResponse.result;
                state.stocks = state.stocks.map(s => {
                    const match = results.find(r => r.symbol === s.symbol);
                    if (match) {
                        return {
                            ...s,
                            price: match.regularMarketPrice,
                            change: match.regularMarketChangePercent
                        };
                    }
                    return s;
                });
                renderStocks();
                document.getElementById('last-updated').innerText = `Last update: ${new Date().toLocaleTimeString()}`;
            }
        } catch (e) {
            console.error("Live fetch failed:", e);
            // Fallback to simulated updates if proxy/API fails
            simulateMarketLive();
        } finally {
            if (btn) btn.classList.remove('loading');
        }
    };

    const simulateMarketLive = () => {
        console.log("Simulating market updates...");
        state.stocks = state.stocks.map(s => ({
            ...s,
            price: s.price ? s.price * (1 + (Math.random() * 0.01 - 0.005)) : s.purchasePrice * (1 + (Math.random() * 0.1))
        }));
        renderStocks();
    };

    const updateAdminUI = () => {
        document.querySelectorAll('.admin-only').forEach(el => {
            el.style.display = isUnlocked ? (el.tagName === 'TD' ? 'table-cell' : 'flex') : 'none';
        });
        const lock = document.getElementById('admin-lock-btn');
        if (lock) {
            lock.innerHTML = isUnlocked ? '<i data-lucide="unlock"></i>' : '<i data-lucide="lock"></i>';
            lock.style.background = isUnlocked ? 'var(--accent-emerald)' : 'rgba(255,255,255,0.05)';
            lucide.createIcons();
        }
    };

    window.delTask = (id) => { if (isUnlocked && confirm("Delete?")) { state.expenses.splice(id,1); save(); window.triggerUIUpdate(); } };
    window.delStock = (id) => { if (isUnlocked && confirm("Delete?")) { state.stocks.splice(id,1); save(); window.triggerUIUpdate(); } };

    // --- 5. Events ---
    document.getElementById('admin-lock-btn').onclick = () => {
        if (isUnlocked) {
            if (confirm("Lock and hide personal data?")) {
                isUnlocked = false;
                sessionStorage.removeItem('wp_unlocked');
                state.expenses = [...FAKE_STATE.expenses];
                state.stocks = [...FAKE_STATE.stocks];
                window.triggerUIUpdate();
            }
        } else {
            const pass = prompt("Enter Password to view real data:");
            if (pass === "djijS536ws!") {
                isUnlocked = true;
                sessionStorage.setItem('wp_unlocked', 'true');
                state.expenses = realData.expenses;
                state.stocks = realData.stocks;
                window.triggerUIUpdate();
                fetchMarketPrices();
            } else {
                alert("Incorrect Password.");
            }
        }
    };

    ['filter-year', 'filter-month', 'filter-category'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.onchange = window.triggerUIUpdate;
    });

    // --- 6. Start ---
    loadRepoData().then(() => {
        if (isUnlocked) {
            fetchMarketPrices();
            setInterval(fetchMarketPrices, 300000);
        }
    });
    
    initCharts();
    updateYearDropdown();
    window.triggerUIUpdate();
    
    document.querySelectorAll('.nav-links li').forEach(li => {
        li.onclick = () => window.switchTab(li.querySelector('span').innerText);
    });
    
    document.getElementById('refresh-stocks').onclick = () => {
        if (isUnlocked) fetchMarketPrices();
        else alert("Please unlock to fetch live market data.");
    };
});
