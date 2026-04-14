// Define switchTab globally
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
    }
};

document.addEventListener('DOMContentLoaded', () => {
    // --- 1. State Management ---
    const defaultStocks = [
        { symbol: '2330.TW', name: 'TSMC', price: 820.00, change: 1.25 },
        { symbol: '2317.TW', name: 'Hon Hai', price: 155.50, change: -0.50 },
        { symbol: '2454.TW', name: 'MediaTek', price: 1050.00, change: 2.15 }
    ];

    const defaultExpenses = [
        { date: '2026-03-28', category: 'Housing', amount: 2800, type: 'EXP', currency: 'TWD', account: 'Fuban', memo: 'Rent', lastUpdated: Date.now(), uuidCode: self.crypto.randomUUID() },
        { date: '2026-04-14', category: 'Food & Dining', amount: 1650, type: 'EXP', currency: 'TWD', account: 'Fuban', memo: 'Groceries', lastUpdated: Date.now(), uuidCode: self.crypto.randomUUID() },
        { date: '2026-04-15', category: 'Others', amount: 5000, type: 'INC', currency: 'TWD', account: 'Fuban', memo: 'Salary Bonus', lastUpdated: Date.now(), uuidCode: self.crypto.randomUUID() }
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

    // --- 2. Chart Initialization ---
    let spendingChart, allocationChart;
    
    const initCharts = () => {
        const ctxPortfolio = document.getElementById('portfolioHistoryChart')?.getContext('2d');
        if (ctxPortfolio) {
            new Chart(ctxPortfolio, {
                type: 'line',
                data: {
                    labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct'],
                    datasets: [{
                        label: 'Value',
                        data: [780000, 950000, 1050000, 1120000, 1080000, 1250000, 1380000, 1420000, 1350000, 1485720],
                        borderColor: '#10b981', tension: 0.4, fill: true, backgroundColor: 'rgba(16, 185, 129, 0.1)'
                    }]
                },
                options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }
            });
        }

        const ctxSpending = document.getElementById('spendingDonutChart')?.getContext('2d');
        if (ctxSpending) {
            const currentMonthData = getFilteredAggregate('current');
            spendingChart = new Chart(ctxSpending, {
                type: 'doughnut',
                data: {
                    labels: Object.keys(currentMonthData),
                    datasets: [{
                        data: Object.values(currentMonthData),
                        backgroundColor: ['#3b82f6', '#10b981', '#8b5cf6', '#f59e0b', '#06b6d4'],
                        borderWidth: 0
                    }]
                },
                options: { responsive: true, maintainAspectRatio: false, cutout: '75%', plugins: { legend: { display: false } } }
            });
        }

        const ctxAlloc = document.getElementById('allocationChart')?.getContext('2d');
        if (ctxAlloc) {
            allocationChart = new Chart(ctxAlloc, {
                type: 'bar',
                data: {
                    labels: ['Stocks', 'ETFs', 'Cash', 'Bonds'],
                    datasets: [{ label: 'Allocation %', data: [65, 20, 10, 5], backgroundColor: '#3b82f6', borderRadius: 8 }]
                },
                options: { 
                    responsive: true, maintainAspectRatio: false, indexAxis: 'y',
                    plugins: { legend: { display: false } },
                    scales: { x: { grid: { display: false } }, y: { grid: { display: false } } }
                }
            });
        }
    };

    // --- 3. Data Filtering & Aggregation ---
    const getFilteredAggregate = (monthFilter = 'all', categoryFilter = 'all') => {
        const totals = {};
        const now = new Date();
        const currentMonthStr = (now.getMonth() + 1).toString().padStart(2, '0');
        const currentYearStr = now.getFullYear().toString();

        state.expenses.forEach(ex => {
            if (ex.type !== 'EXP') return;
            
            // Month Filter
            if (monthFilter === 'current') {
                const [y, m] = ex.date.split('-');
                if (m !== currentMonthStr || y !== currentYearStr) return;
            } else if (monthFilter !== 'all') {
                const m = ex.date.split('-')[1];
                if (m !== monthFilter) return;
            }

            // Category Filter
            if (categoryFilter !== 'all' && ex.category !== categoryFilter) return;

            totals[ex.category] = (totals[ex.category] || 0) + parseFloat(ex.amount);
        });
        return totals;
    };

    const calculateNetIncome = () => {
        const now = new Date();
        const curM = (now.getMonth() + 1).toString().padStart(2, '0');
        const curY = now.getFullYear().toString();
        
        let inc = 0, exp = 0;
        state.expenses.forEach(ex => {
            const [y, m] = ex.date.split('-');
            if (m === curM && y === curY) {
                if (ex.type === 'INC') inc += parseFloat(ex.amount);
                else exp += parseFloat(ex.amount);
            }
        });
        return inc - exp;
    };

    // --- 4. UI Updates ---
    const updateUI = () => {
        // Update Home Page Mini Chart (always current month)
        if (spendingChart && document.getElementById('section-overview').classList.contains('active')) {
            const data = getFilteredAggregate('current');
            spendingChart.data.labels = Object.keys(data);
            spendingChart.data.datasets[0].data = Object.values(data);
            spendingChart.update();
            
            const totalM = Object.values(data).reduce((a, b) => a + b, 0);
            document.getElementById('total-spending-value').textContent = '$' + totalM.toLocaleString();
        }

        // Update Net Income
        const net = calculateNetIncome();
        const netEl = document.getElementById('net-income-value');
        if (netEl) {
            netEl.textContent = (net >= 0 ? '+' : '') + '$' + net.toLocaleString();
            netEl.style.color = net >= 0 ? 'var(--accent-emerald)' : 'var(--accent-ruby)';
        }

        renderTransactionLists();
        renderStocks();
        updateAdminVisibility();
    };

    const renderTransactionLists = () => {
        const miniList = document.getElementById('transaction-list');
        const fullList = document.getElementById('full-transaction-list');
        
        // Mini list for home page (just recent expenses)
        if (miniList) {
            miniList.innerHTML = '';
            state.expenses.filter(ex => ex.type === 'EXP').slice(-5).reverse().forEach((ex, i) => {
                const row = document.createElement('tr');
                row.innerHTML = `<td>${ex.date}</td><td>${ex.category}</td><td>$${parseFloat(ex.amount).toLocaleString()}</td>
                    <td class="admin-only" style="display: ${state.isAdmin ? 'table-cell' : 'none'}">
                        <button class="remove-btn" onclick="window.removeTransaction(${state.expenses.indexOf(ex)})"><i data-lucide="x"></i></button>
                    </td>`;
                miniList.appendChild(row);
            });
        }

        // Apply filters to Full list
        if (fullList) {
            const mFilter = document.getElementById('filter-month').value;
            const cFilter = document.getElementById('filter-category').value;
            const filtered = state.expenses.filter(ex => {
                const now = new Date();
                const [y, m] = ex.date.split('-');
                const monthMatch = (mFilter === 'all') || (mFilter === 'current' && m === (now.getMonth()+1).toString().padStart(2,'0')) || (m === mFilter);
                const catMatch = (cFilter === 'all') || (ex.category === cFilter);
                return monthMatch && catMatch;
            });

            fullList.innerHTML = '';
            filtered.reverse().forEach(ex => {
                const row = document.createElement('tr');
                row.innerHTML = `<td>${ex.date}</td><td>${ex.category}</td><td class="${ex.type === 'EXP' ? 'negative' : 'positive'}">${ex.type === 'EXP' ? '-' : '+'}$${parseFloat(ex.amount).toLocaleString()}</td>
                    <td>${ex.account}</td><td>${ex.memo}</td><td>${ex.type}</td>
                    <td class="admin-only" style="display: ${state.isAdmin ? 'table-cell' : 'none'}"><button class="remove-btn" onclick="window.removeTransaction(${state.expenses.indexOf(ex)})"><i data-lucide="x"></i></button></td>`;
                fullList.appendChild(row);
            });
        }
        lucide.createIcons();
    };

    const renderStocks = () => {
        const list = document.getElementById('stock-list');
        if (!list) return;
        list.innerHTML = '';
        state.stocks.forEach((stock, index) => {
            const row = document.createElement('tr');
            const changeClass = stock.change >= 0 ? 'positive' : 'negative';
            const changeSign = stock.change >= 0 ? '+' : '';
            row.innerHTML = `
                <td><div class="symbol-cell"><div class="symbol-icon">${stock.symbol.split('.')[0]}</div><div class="symbol-info"><strong>${stock.symbol}</strong><br><small>${stock.name}</small></div></div></td>
                <td>$${parseFloat(stock.price).toFixed(2)}</td><td class="trend ${changeClass}">${changeSign}${stock.change}%</td>
                <td class="admin-only" style="display: ${state.isAdmin ? 'table-cell' : 'none'}"><button class="remove-btn" onclick="window.removeStock(${index})"><i data-lucide="trash-2"></i></button></td>
            `;
            list.appendChild(row);
        });
        lucide.createIcons();
    };

    // --- 5. Global Helpers & Admin ---
    window.removeTransaction = (index) => {
        if (!state.isAdmin) return;
        if (confirm("Remove transaction?")) { state.expenses.splice(index, 1); saveState(); updateUI(); }
    };
    window.removeStock = (index) => {
        if (!state.isAdmin) return;
        if (confirm("Remove stock?")) { state.stocks.splice(index, 1); saveState(); renderStocks(); }
    };

    const updateAdminVisibility = () => {
        const adminElements = document.querySelectorAll('.admin-only');
        adminElements.forEach(el => el.style.display = state.isAdmin ? (el.tagName === 'TD' || el.tagName === 'TH' ? 'table-cell' : 'flex') : 'none');
        const lockBtn = document.getElementById('admin-lock-btn');
        if (lockBtn) {
            lockBtn.classList.toggle('unlocked', state.isAdmin);
            const icon = lockBtn.querySelector('i');
            if (icon) { icon.setAttribute('data-lucide', state.isAdmin ? 'unlock' : 'lock'); lucide.createIcons(); }
        }
    };

    document.getElementById('admin-lock-btn').onclick = () => {
        if (state.isAdmin) state.isAdmin = false;
        else if (prompt("Passcode: (1234)") === "1234") state.isAdmin = true;
        updateAdminVisibility(); renderTransactionLists(); renderStocks();
    };

    // --- 6. Event Handling ---
    document.getElementById('filter-month').onchange = updateUI;
    document.getElementById('filter-category').onchange = updateUI;

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
            saveState(); updateUI(); alert(`Imported ${newEx.length} records!`);
        };
        reader.readAsText(file);
    });

    document.getElementById('expense-form').onsubmit = (e) => {
        e.preventDefault();
        state.expenses.push({ date: document.getElementById('expense-date').value, category: document.getElementById('expense-category').value, amount: parseFloat(document.getElementById('expense-amount').value), type: document.getElementById('expense-type').value, account: document.getElementById('expense-account').value, memo: document.getElementById('expense-memo').value, lastUpdated: Date.now(), uuidCode: self.crypto.randomUUID() });
        saveState(); updateUI(); document.getElementById('expense-modal').classList.remove('active'); e.target.reset();
    };

    document.getElementById('stock-form').onsubmit = (e) => {
        e.preventDefault();
        state.stocks.push({ symbol: document.getElementById('stock-symbol').value.toUpperCase() + '.TW', name: document.getElementById('stock-name').value, price: 100 + Math.random() * 500, change: 0 });
        saveState(); renderStocks(); document.getElementById('stock-modal').classList.remove('active'); e.target.reset();
    };

    // --- Init ---
    initCharts(); updateUI();
    document.querySelectorAll('.nav-links li').forEach(li => li.onclick = () => window.switchTab(li.querySelector('span').innerText));
    document.getElementById('refresh-stocks').onclick = async () => {
        const btn = document.getElementById('refresh-stocks'); btn.classList.add('loading');
        await new Promise(r => setTimeout(r, 1000));
        state.stocks = state.stocks.map(s => ({ ...s, price: s.price * (1 + (Math.random() * 0.02 - 0.01)), change: (Math.random() * 2 - 1).toFixed(2) }));
        saveState(); renderStocks(); btn.classList.remove('loading');
        document.getElementById('last-updated').textContent = `Updated: ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    };
});
