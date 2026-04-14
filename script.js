document.addEventListener('DOMContentLoaded', () => {
    // --- 1. State Management ---
    const defaultStocks = [
        { symbol: '2330.TW', name: 'TSMC', price: 820.00, change: 1.25 },
        { symbol: '2317.TW', name: 'Hon Hai', price: 155.50, change: -0.50 },
        { symbol: '2454.TW', name: 'MediaTek', price: 1050.00, change: 2.15 },
        { symbol: '0050.TW', name: 'Yuanta Taiwan 50', price: 158.30, change: 0.85 }
    ];

    const defaultExpenses = [
        { date: '2026-03-28', category: 'Housing', amount: 2800, type: 'EXP', currency: 'TWD', account: 'Fuban', memo: 'Rent', lastUpdated: Date.now(), uuidCode: self.crypto.randomUUID() },
        { date: '2026-03-29', category: 'Food & Dining', amount: 1650, type: 'EXP', currency: 'TWD', account: 'Fuban', memo: 'Groceries', lastUpdated: Date.now(), uuidCode: self.crypto.randomUUID() },
        { date: '2026-03-30', category: 'Entertainment', amount: 1100, type: 'EXP', currency: 'TWD', account: 'Fuban', memo: 'Movies', lastUpdated: Date.now(), uuidCode: self.crypto.randomUUID() }
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

    // --- 2. Chart Utilities ---
    let spendingChart;
    const getAggregateSpending = () => {
        const totals = {};
        state.expenses.forEach(ex => {
            if (ex.type === 'EXP') {
                totals[ex.category] = (totals[ex.category] || 0) + parseFloat(ex.amount);
            }
        });
        return totals;
    };

    const initCharts = () => {
        const ctxPortfolio = document.getElementById('portfolioHistoryChart').getContext('2d');
        const portfolioGradient = ctxPortfolio.createLinearGradient(0, 0, 0, 400);
        portfolioGradient.addColorStop(0, 'rgba(16, 185, 129, 0.2)');
        portfolioGradient.addColorStop(1, 'rgba(16, 185, 129, 0)');

        new Chart(ctxPortfolio, {
            type: 'line',
            data: {
                labels: ['Nov', 'Dec', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct'],
                datasets: [{
                    label: 'Portfolio Value (TWD)',
                    data: [750000, 820000, 780000, 950000, 1050000, 1120000, 1080000, 1250000, 1380000, 1420000, 1350000, 1485720],
                    borderColor: '#10b981',
                    borderWidth: 3,
                    fill: true,
                    backgroundColor: portfolioGradient,
                    tension: 0.4,
                    pointRadius: 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    x: { grid: { display: false }, ticks: { color: '#64748b' } },
                    y: { grid: { color: 'rgba(255, 255, 255, 0.05)' }, ticks: { color: '#64748b', callback: (val) => (val / 1000) + 'k' } }
                }
            }
        });

        const initialData = getAggregateSpending();
        const ctxSpending = document.getElementById('spendingDonutChart').getContext('2d');
        spendingChart = new Chart(ctxSpending, {
            type: 'doughnut',
            data: {
                labels: Object.keys(initialData),
                datasets: [{
                    data: Object.values(initialData),
                    backgroundColor: ['#3b82f6', '#10b981', '#8b5cf6', '#f59e0b', '#06b6d4', '#ec4899', '#f43f5e'],
                    borderWidth: 0,
                    hoverOffset: 10
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '75%',
                plugins: { legend: { display: false } }
            }
        });
        updateTotalSpending();
    };

    // --- 3. UI Rendering ---
    const updateUI = () => {
        const data = getAggregateSpending();
        if (spendingChart) {
            spendingChart.data.labels = Object.keys(data);
            spendingChart.data.datasets[0].data = Object.values(data);
            spendingChart.update();
        }
        updateTotalSpending();
        renderTransactionLists();
        renderStocks();
        updateAdminVisibility();
    };

    const updateTotalSpending = () => {
        const data = getAggregateSpending();
        const total = Object.values(data).reduce((a, b) => a + b, 0);
        const el = document.getElementById('total-spending-value');
        if (el) el.textContent = '$' + total.toLocaleString();
    };

    const renderTransactionLists = () => {
        const miniList = document.getElementById('transaction-list');
        const fullList = document.getElementById('full-transaction-list');
        
        const renderRow = (ex, idx, isFull = false) => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${ex.date}</td>
                <td>${ex.category}</td>
                <td class="${ex.type === 'EXP' ? 'negative' : 'positive'}">
                    ${ex.type === 'EXP' ? '-' : '+'}$${parseFloat(ex.amount).toLocaleString()}
                </td>
                ${isFull ? `<td>${ex.account}</td><td>${ex.memo}</td><td>${ex.type}</td>` : ''}
                <td class="admin-only" style="display: ${state.isAdmin ? 'table-cell' : 'none'}">
                    <button class="remove-btn" onclick="removeTransaction(${idx})">
                        <i data-lucide="x" style="width: 14px;"></i>
                    </button>
                </td>
            `;
            return row;
        };

        if (miniList) {
            miniList.innerHTML = '';
            state.expenses.slice(-5).reverse().forEach((ex, idx) => miniList.appendChild(renderRow(ex, state.expenses.length - 1 - idx)));
        }
        if (fullList) {
            fullList.innerHTML = '';
            state.expenses.slice().reverse().forEach((ex, idx) => fullList.appendChild(renderRow(ex, state.expenses.length - 1 - idx, true)));
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
                <td>
                    <div class="symbol-cell">
                        <div class="symbol-icon">${stock.symbol.split('.')[0]}</div>
                        <div class="symbol-info"><strong>${stock.symbol}</strong><br><small>${stock.name}</small></div>
                    </div>
                </td>
                <td>${parseFloat(stock.price).toFixed(2)}</td>
                <td class="trend ${changeClass}">${changeSign}${stock.change}%</td>
                <td class="admin-only" style="display: ${state.isAdmin ? 'table-cell' : 'none'}">
                    <button class="remove-btn" onclick="removeStock(${index})">
                        <i data-lucide="trash-2" style="width: 16px;"></i>
                    </button>
                </td>
            `;
            list.appendChild(row);
        });
        lucide.createIcons();
    };

    // --- 4. Navigation & Admin ---
    window.switchTab = (tabName) => {
        const targetId = `section-${tabName.toLowerCase()}`;
        document.querySelectorAll('.view-section').forEach(s => s.classList.remove('active'));
        const targetSection = document.getElementById(targetId);
        if (targetSection) targetSection.classList.add('active');

        // Update sidebar active state
        document.querySelectorAll('.nav-links li').forEach(li => {
            li.classList.remove('active');
            if (li.innerText.includes(tabName)) li.classList.add('active');
        });
    };

    const updateAdminVisibility = () => {
        const adminElements = document.querySelectorAll('.admin-only');
        const lockBtn = document.getElementById('admin-lock-btn');
        const lockIcon = lockBtn.querySelector('i');
        
        adminElements.forEach(el => el.style.display = state.isAdmin ? (el.tagName === 'TD' || el.tagName === 'TH' ? 'table-cell' : 'flex') : 'none');
        
        if (state.isAdmin) {
            lockBtn.classList.add('unlocked');
            lockIcon.setAttribute('data-lucide', 'unlock');
        } else {
            lockBtn.classList.remove('unlocked');
            lockIcon.setAttribute('data-lucide', 'lock');
        }
        lucide.createIcons();
    };

    document.getElementById('admin-lock-btn').onclick = () => {
        if (state.isAdmin) {
            state.isAdmin = false;
        } else {
            const pw = prompt("Enter Admin Passcode:");
            if (pw === "1234") { // Simple passcode for demo
                state.isAdmin = true;
            } else {
                alert("Incorrect passcode.");
            }
        }
        updateAdminVisibility();
        renderTransactionLists();
        renderStocks();
    };

    // --- 5. Data Services (TSEC Integration) ---
    const fetchStockPrices = async () => {
        const refreshBtn = document.getElementById('refresh-stocks');
        if (!refreshBtn) return;
        refreshBtn.classList.add('loading');
        
        try {
            // Using a CORS proxy + Multiple sources for Taiwan stocks
            // For demo, we'll randomize TSEC-like behavior, but here is how you call real data:
            // const url = `https://api.allorigins.win/get?url=${encodeURIComponent('https://www.twse.com.tw/exchangeReport/STOCK_DAY_AVG?response=json&stockNo=2330')}`;
            
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            state.stocks = state.stocks.map(stock => {
                const move = 1 + (Math.random() * 0.02 - 0.01);
                const newPrice = stock.price * move;
                return {
                    ...stock,
                    price: newPrice,
                    change: parseFloat(((newPrice - stock.price) / stock.price * 100).toFixed(2))
                };
            });

            state.lastFetch = new Date().toISOString();
            localStorage.setItem('wp_last_fetch', state.lastFetch);
            updateLastUpdatedText();
            saveState();
            renderStocks();
        } catch (e) { console.error("Stock fetch failed", e); }
        refreshBtn.classList.remove('loading');
    };

    window.removeTransaction = (index) => {
        if (!state.isAdmin) return;
        state.expenses.splice(index, 1);
        saveState();
        updateUI();
    };

    window.removeStock = (index) => {
        if (!state.isAdmin) return;
        state.stocks.splice(index, 1);
        saveState();
        updateUI();
    };

    const updateLastUpdatedText = () => {
        const el = document.getElementById('last-updated');
        if (el && state.lastFetch) {
            const date = new Date(state.lastFetch);
            el.textContent = `Updated: ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
        }
    };

    // --- 6. Event Listeners ---
    document.getElementById('csv-upload').addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (event) => {
            const lines = event.target.result.split('\n');
            const newEx = [];
            for (let i = 1; i < lines.length; i++) {
                if (!lines[i].trim()) continue;
                const v = lines[i].split(',');
                newEx.push({
                    date: v[0], category: v[1], amount: parseFloat(v[3]), currency: v[4],
                    member: v[5], account: v[6], type: v[9], memo: v[8], lastUpdated: Date.now(), uuidCode: v[11] || self.crypto.randomUUID()
                });
            }
            state.expenses = [...state.expenses, ...newEx];
            saveState();
            updateUI();
        };
        reader.readAsText(file);
    });

    document.getElementById('expense-form').onsubmit = (e) => {
        e.preventDefault();
        state.expenses.push({
            date: document.getElementById('expense-date').value,
            category: document.getElementById('expense-category').value,
            amount: parseFloat(document.getElementById('expense-amount').value),
            type: document.getElementById('expense-type').value,
            account: document.getElementById('expense-account').value,
            memo: document.getElementById('expense-memo').value,
            lastUpdated: Date.now(), uuidCode: self.crypto.randomUUID()
        });
        saveState();
        updateUI();
        document.getElementById('expense-modal').classList.remove('active');
        e.target.reset();
    };

    document.getElementById('stock-form').onsubmit = (e) => {
        e.preventDefault();
        state.stocks.push({
            symbol: document.getElementById('stock-symbol').value.toUpperCase() + '.TW',
            name: document.getElementById('stock-name').value,
            price: 100 + Math.random() * 500,
            change: 0
        });
        saveState();
        renderStocks();
        document.getElementById('stock-modal').classList.remove('active');
        e.target.reset();
    };

    document.getElementById('refresh-stocks').onclick = fetchStockPrices;
    document.querySelectorAll('.nav-links li').forEach(li => li.onclick = () => switchTab(li.querySelector('span').innerText));

    // --- Init ---
    initCharts();
    updateUI();
    updateLastUpdatedText();
    
    // Auto-fetch if old
    const last = state.lastFetch ? new Date(state.lastFetch) : 0;
    if ((new Date() - last) > 3600000) fetchStockPrices(); 
});

window.removeTransaction = (idx) => {
    // This is a bit tricky since we might be in filtered views, but for now:
    // This needs to be handled inside the DOM ready scope or globally.
    // I'll move it to a global handler or use event delegation.
};
