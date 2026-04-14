// Global navigation helper
window.switchTab = (tabName) => {
    const targetId = `section-${tabName.toLowerCase().trim()}`;
    const targetSection = document.getElementById(targetId);
    if (targetSection) {
        document.querySelectorAll('.view-section').forEach(s => s.classList.remove('active'));
        targetSection.classList.add('active');
        document.querySelectorAll('.nav-links li').forEach(li => {
            li.classList.remove('active');
            if (li.querySelector('span').innerText.toLowerCase().trim() === tabName.toLowerCase().trim()) li.classList.add('active');
        });
        window.dispatchEvent(new Event('resize'));
        if (window.triggerUIUpdate) window.triggerUIUpdate();
    }
};

document.addEventListener('DOMContentLoaded', () => {
    // --- 1. Data State ---
    const defaultStocks = [
        { symbol: '2330.TW', name: 'TSMC', price: 820.00, change: 1.25 },
        { symbol: '2317.TW', name: 'Hon Hai', price: 155.50, change: -0.50 }
    ];

    const defaultExpenses = [
        { date: '2026-03-28', category: 'Housing', amount: 2800, type: 'EXP', currency: 'TWD', account: 'Fuban', memo: 'Rent', lastUpdated: Date.now(), uuidCode: self.crypto.randomUUID() },
        { date: '2026-04-14', category: 'Food & Dining', amount: 1650, type: 'EXP', currency: 'TWD', account: 'Fuban', memo: 'Groceries', lastUpdated: Date.now(), uuidCode: self.crypto.randomUUID() },
        { date: '2026-04-15', category: 'Others', amount: 15000, type: 'INC', currency: 'TWD', account: 'Fuban', memo: 'Salary', lastUpdated: Date.now(), uuidCode: self.crypto.randomUUID() }
    ];

    let state = {
        stocks: JSON.parse(localStorage.getItem('wp_stocks')) || defaultStocks,
        expenses: JSON.parse(localStorage.getItem('wp_expenses')) || defaultExpenses,
        lastFetch: localStorage.getItem('wp_last_fetch') || null,
        isAdmin: false
    };

    const saveState = () => {
        localStorage.setItem('wp_stocks', JSON.stringify(state.stocks));
        localStorage.setItem('wp_expenses', JSON.stringify(state.expenses));
    };

    // --- 2. Charting ---
    let spendingChart, allocationChart, detailedSpendingChart;
    const colors = ['#3b82f6', '#10b981', '#8b5cf6', '#f59e0b', '#06b6d4', '#ec4899', '#f43f5e', '#6366f1'];
    
    const initCharts = () => {
        // Portfolio Line Chart
        const ctxP = document.getElementById('portfolioHistoryChart')?.getContext('2d');
        if (ctxP) {
            new Chart(ctxP, {
                type: 'line',
                data: { labels: ['Q1', 'Q2', 'Q3', 'Q4'], datasets: [{ label: 'TWD', data: [750000, 950000, 1120000, 1485720], borderColor: '#10b981', tension: 0.4 }] },
                options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }
            });
        }

        // Home Overview Donut
        const ctxS = document.getElementById('spendingDonutChart')?.getContext('2d');
        if (ctxS) {
            spendingChart = new Chart(ctxS, {
                type: 'doughnut',
                data: { labels: [], datasets: [{ data: [], backgroundColor: colors, borderWidth: 0 }] },
                options: { responsive: true, maintainAspectRatio: false, cutout: '75%', plugins: { legend: { display: false } } }
            });
        }

        // Detailed Report Pie Chart
        const ctxD = document.getElementById('detailedSpendingChart')?.getContext('2d');
        if (ctxD) {
            detailedSpendingChart = new Chart(ctxD, {
                type: 'pie',
                data: { labels: [], datasets: [{ data: [], backgroundColor: colors, borderWidth: 0 }] },
                options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { color: '#94a3b8', font: { size: 11 } } } } }
            });
        }
    };

    // --- 3. Logic & Filtering ---
    const getAggregatedData = (yF, mF, cF) => {
        const now = new Date();
        const curM = (now.getMonth() + 1).toString().padStart(2, '0');
        const curY = now.getFullYear().toString();
        const totals = {};
        
        state.expenses.forEach(ex => {
            if (ex.type !== 'EXP') return;
            const [y, m] = ex.date.split('-');
            if (yF !== 'all' && y !== yF) return;
            if (mF === 'current') { if (m !== curM || y !== curY) return; }
            else if (mF !== 'all' && m !== mF) return;
            if (cF !== 'all' && ex.category !== cF) return;
            totals[ex.category] = (totals[ex.category] || 0) + parseFloat(ex.amount);
        });
        return totals;
    };

    const getStats = (yF, mF, cF) => {
        const now = new Date();
        const curM = (now.getMonth() + 1).toString().padStart(2, '0');
        const curY = now.getFullYear().toString();
        let inc = 0, exp = 0;

        state.expenses.forEach(ex => {
            const [y, m] = ex.date.split('-');
            const yM = (yF === 'all') || (y === yF);
            const mM = (mF === 'all') || (mF === 'current' && m === curM && y === curY) || (m === mF);
            const cM = (cF === 'all') || (ex.category === cF);
            
            if (yM && mM && cM) {
                if (ex.type === 'INC') inc += parseFloat(ex.amount);
                else exp += parseFloat(ex.amount);
            }
        });
        return { inc, exp, net: inc - exp };
    };

    // --- 4. Main UI Update ---
    window.triggerUIUpdate = () => {
        const yF = document.getElementById('filter-year')?.value || 'all';
        const mF = document.getElementById('filter-month')?.value || 'all';
        const cF = document.getElementById('filter-category')?.value || 'all';

        // Update Stats Sidebar
        const stats = getStats(yF, mF, cF);
        const setVal = (id, val, color) => {
            const el = document.getElementById(id);
            if (el) {
                el.textContent = '$' + val.toLocaleString();
                if (color) el.style.color = color;
            }
        };
        setVal('stats-total-exp', stats.exp, 'var(--accent-ruby)');
        setVal('stats-total-inc', stats.inc, 'var(--accent-emerald)');
        setVal('stats-net-income', stats.net, stats.net >= 0 ? 'var(--accent-emerald)' : 'var(--accent-ruby)');

        // Update Overview Net worth / Income
        const curMonthStats = getStats('all', 'current', 'all');
        const netOv = document.getElementById('net-income-value');
        if (netOv) {
            netOv.textContent = (curMonthStats.net >= 0 ? '+' : '') + '$' + curMonthStats.net.toLocaleString();
            netOv.style.color = curMonthStats.net >= 0 ? 'var(--accent-emerald)' : 'var(--accent-ruby)';
        }

        // Update Charts
        if (spendingChart) {
            const data = getAggregatedData('all', 'current', 'all');
            spendingChart.data.labels = Object.keys(data);
            spendingChart.data.datasets[0].data = Object.values(data);
            spendingChart.update();
            const homeSpent = document.getElementById('total-spending-value');
            if (homeSpent) homeSpent.textContent = '$' + Object.values(data).reduce((a,b)=>a+b,0).toLocaleString();
        }

        if (detailedSpendingChart) {
            const data = getAggregatedData(yF, mF, cF);
            detailedSpendingChart.data.labels = Object.keys(data);
            detailedSpendingChart.data.datasets[0].data = Object.values(data);
            detailedSpendingChart.update();
        }

        // Update Table
        const fullList = document.getElementById('full-transaction-list');
        if (fullList) {
            const now = new Date();
            const curM = (now.getMonth() + 1).toString().padStart(2, '0');
            const curY = now.getFullYear().toString();
            
            const filtered = state.expenses.filter(ex => {
                const [y, m] = ex.date.split('-');
                if (yF !== 'all' && y !== yF) return false;
                if (mF === 'current') { if (m !== curM || y !== curY) return false; }
                else if (mF !== 'all' && m !== mF) return false;
                if (cF !== 'all' && ex.category !== cF) return false;
                return true;
            });

            fullList.innerHTML = '';
            filtered.reverse().forEach(ex => {
                const row = document.createElement('tr');
                row.innerHTML = `<td>${ex.date}</td><td>${ex.category}</td><td class="${ex.type === 'EXP' ? 'negative' : 'positive'}">${ex.type === 'EXP' ? '-' : '+'}$${parseFloat(ex.amount).toLocaleString()}</td>
                    <td>${ex.account}</td><td>${ex.memo}</td>
                    <td class="admin-only"><button class="remove-btn" onclick="window.removeTransaction(${state.expenses.indexOf(ex)})"><i data-lucide="x"></i></button></td>`;
                fullList.appendChild(row);
            });
        }

        const miniList = document.getElementById('transaction-list');
        if (miniList) {
            miniList.innerHTML = '';
            state.expenses.filter(e => e.type === 'EXP').slice(-5).reverse().forEach(ex => {
                const row = document.createElement('tr');
                row.innerHTML = `<td>${ex.date}</td><td>${ex.category}</td><td>$${parseFloat(ex.amount).toLocaleString()}</td><td class="admin-only"><button class="remove-btn" onclick="window.removeTransaction(${state.expenses.indexOf(ex)})"><i data-lucide="x"></i></button></td>`;
                miniList.appendChild(row);
            });
        }

        renderStocks();
        updateAdminVisibility();
        lucide.createIcons();
    };

    const renderStocks = () => {
        const list = document.getElementById('stock-list');
        if (!list) return;
        list.innerHTML = '';
        state.stocks.forEach((s, i) => {
            const row = document.createElement('tr');
            row.innerHTML = `<td><div class="symbol-cell"><div class="symbol-info"><strong>${s.symbol}</strong><br><small>${s.name}</small></div></div></td>
                <td>$${s.price.toFixed(2)}</td><td class="trend ${s.change >= 0 ? 'positive' : 'negative'}">${s.change >= 0 ? '+' : ''}${s.change}%</td>
                <td class="admin-only"><button class="remove-btn" onclick="window.removeStock(${i})"><i data-lucide="trash-2"></i></button></td>`;
            list.appendChild(row);
        });
    };

    const updateAdminVisibility = () => {
        const els = document.querySelectorAll('.admin-only');
        els.forEach(el => el.style.display = state.isAdmin ? (el.tagName === 'TD' ? 'table-cell' : 'flex') : 'none');
        const lock = document.getElementById('admin-lock-btn');
        if (lock) {
            lock.classList.toggle('unlocked', state.isAdmin);
            lock.querySelector('i')?.setAttribute('data-lucide', state.isAdmin ? 'unlock' : 'lock');
            lucide.createIcons();
        }
    };

    window.removeTransaction = (idx) => { if (state.isAdmin && confirm("Delete?")) { state.expenses.splice(idx,1); saveState(); window.triggerUIUpdate(); } };
    window.removeStock = (idx) => { if (state.isAdmin && confirm("Delete?")) { state.stocks.splice(idx,1); saveState(); window.triggerUIUpdate(); } };

    // --- 5. Event Binding ---
    document.getElementById('admin-lock-btn').onclick = () => {
        if (state.isAdmin) state.isAdmin = false;
        else if (prompt("Pass: 1234") === "1234") state.isAdmin = true;
        window.triggerUIUpdate();
    };

    ['filter-year', 'filter-month', 'filter-category'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.onchange = window.triggerUIUpdate;
    });

    document.getElementById('csv-upload')?.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (event) => {
            const lines = event.target.result.split('\n');
            const headers = lines[0].split(',').map(h => h.trim());
            const newEx = [];
            for (let i = 1; i < lines.length; i++) {
                if (!lines[i].trim()) continue;
                const v = lines[i].split(',').map(cell => cell.trim());
                const entry = {}; headers.forEach((h, idx) => entry[h] = v[idx]);
                newEx.push({ date: entry['Date'] || '', category: entry['Category'] || 'Others', amount: parseFloat(entry['Amount']) || 0, currency: entry['Currency'] || 'TWD', account: entry['Account'] || 'Default', type: entry['Income&Exp'] || 'EXP', memo: entry['Memo'] || '', lastUpdated: Date.now(), uuidCode: entry['UUID'] || self.crypto.randomUUID() });
            }
            state.expenses = [...state.expenses, ...newEx];
            saveState(); window.triggerUIUpdate(); alert("Done!");
        };
        reader.readAsText(file);
    });

    // --- 6. Final Init ---
    initCharts();
    window.triggerUIUpdate();
    document.querySelectorAll('.nav-links li').forEach(li => li.onclick = () => window.switchTab(li.querySelector('span').innerText));
    document.getElementById('refresh-stocks').onclick = async () => {
        const b = document.getElementById('refresh-stocks'); b.classList.add('loading');
        await new Promise(r => setTimeout(r, 1000));
        state.stocks = state.stocks.map(s => ({ ...s, price: s.price * (1 + (Math.random()*0.02-0.01)), change: (Math.random()*2-1).toFixed(2) }));
        saveState(); window.triggerUIUpdate(); b.classList.remove('loading');
    };
});
