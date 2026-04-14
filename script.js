// Define switchTab globally so it's accessible from HTML onclick attributes
window.switchTab = (tabName) => {
    // Determine the target section ID
    const targetId = `section-${tabName.toLowerCase().trim()}`;
    const targetSection = document.getElementById(targetId);
    
    if (targetSection) {
        // Toggle visibility of sections
        document.querySelectorAll('.view-section').forEach(s => s.classList.remove('active'));
        targetSection.classList.add('active');

        // Update sidebar "active" styling
        document.querySelectorAll('.nav-links li').forEach(li => {
            li.classList.remove('active');
            const spanText = li.querySelector('span').innerText.toLowerCase();
            if (spanText === tabName.toLowerCase().trim()) {
                li.classList.add('active');
            }
        });

        // Trigger chart refreshes if needed when switching
        window.dispatchEvent(new Event('resize'));
    } else {
        console.warn(`Section ${targetId} not found.`);
    }
};

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

    // --- 2. Chart Initialization ---
    let spendingChart, allocationChart;
    
    const initCharts = () => {
        // Line Chart: Portfolio History
        const ctxPortfolio = document.getElementById('portfolioHistoryChart')?.getContext('2d');
        if (ctxPortfolio) {
            new Chart(ctxPortfolio, {
                type: 'line',
                data: {
                    labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct'],
                    datasets: [{
                        label: 'Value (TWD)',
                        data: [780000, 950000, 1050000, 1120000, 1080000, 1250000, 1380000, 1420000, 1350000, 1485720],
                        borderColor: '#10b981',
                        borderWidth: 3,
                        tension: 0.4,
                        fill: true,
                        backgroundColor: 'rgba(16, 185, 129, 0.1)'
                    }]
                },
                options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }
            });
        }

        // Donut Chart: Spending Breakdown
        const ctxSpending = document.getElementById('spendingDonutChart')?.getContext('2d');
        if (ctxSpending) {
            const data = getAggregateSpending();
            spendingChart = new Chart(ctxSpending, {
                type: 'doughnut',
                data: {
                    labels: Object.keys(data),
                    datasets: [{
                        data: Object.values(data),
                        backgroundColor: ['#3b82f6', '#10b981', '#8b5cf6', '#f59e0b', '#06b6d4'],
                        borderWidth: 0
                    }]
                },
                options: { responsive: true, maintainAspectRatio: false, cutout: '75%', plugins: { legend: { display: false } } }
            });
        }

        // Bar Chart: Asset Allocation (Investments Page)
        const ctxAlloc = document.getElementById('allocationChart')?.getContext('2d');
        if (ctxAlloc) {
            allocationChart = new Chart(ctxAlloc, {
                type: 'bar',
                data: {
                    labels: ['Stocks', 'ETFs', 'Cash', 'Bonds'],
                    datasets: [{
                        label: 'Allocation %',
                        data: [65, 20, 10, 5],
                        backgroundColor: '#3b82f6',
                        borderRadius: 8
                    }]
                },
                options: { 
                    responsive: true, 
                    maintainAspectRatio: false, 
                    indexAxis: 'y',
                    plugins: { legend: { display: false } },
                    scales: { x: { grid: { display: false } }, y: { grid: { display: false } } }
                }
            });
        }
    };

    const getAggregateSpending = () => {
        const totals = {};
        state.expenses.forEach(ex => {
            if (ex.type === 'EXP') {
                totals[ex.category] = (totals[ex.category] || 0) + parseFloat(ex.amount);
            }
        });
        return totals;
    };

    const updateUI = () => {
        const data = getAggregateSpending();
        if (spendingChart) {
            spendingChart.data.labels = Object.keys(data);
            spendingChart.data.datasets[0].data = Object.values(data);
            spendingChart.update();
        }
        
        const totalValue = Object.values(data).reduce((a, b) => a + b, 0);
        const totalEl = document.getElementById('total-spending-value');
        if (totalEl) totalEl.textContent = '$' + totalValue.toLocaleString();

        renderTransactionLists();
        renderStocks();
        updateAdminVisibility();
    };

    const renderTransactionLists = () => {
        const miniList = document.getElementById('transaction-list');
        const fullList = document.getElementById('full-transaction-list');
        
        const createRow = (ex, idx, isFull = false) => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${ex.date}</td>
                <td>${ex.category}</td>
                <td class="${ex.type === 'EXP' ? 'negative' : 'positive'}">
                    ${ex.type === 'EXP' ? '-' : '+'}$${parseFloat(ex.amount).toLocaleString()}
                </td>
                ${isFull ? `<td>${ex.account}</td><td>${ex.memo}</td><td>${ex.type}</td>` : ''}
                <td class="admin-only" style="display: ${state.isAdmin ? 'table-cell' : 'none'}">
                    <button class="remove-btn" title="Remove" onclick="window.removeTransaction(${idx})">
                        <i data-lucide="x" style="width: 14px;"></i>
                    </button>
                </td>
            `;
            return row;
        };

        if (miniList) {
            miniList.innerHTML = '';
            state.expenses.slice(-5).reverse().forEach((ex, i) => miniList.appendChild(createRow(ex, state.expenses.length - 1 - i)));
        }
        if (fullList) {
            fullList.innerHTML = '';
            state.expenses.slice().reverse().forEach((ex, i) => fullList.appendChild(createRow(ex, state.expenses.length - 1 - i, true)));
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
                <td>$${parseFloat(stock.price).toFixed(2)}</td>
                <td class="trend ${changeClass}">${changeSign}${stock.change}%</td>
                <td class="admin-only" style="display: ${state.isAdmin ? 'table-cell' : 'none'}">
                    <button class="remove-btn" title="Remove" onclick="window.removeStock(${index})">
                        <i data-lucide="trash-2" style="width: 16px;"></i>
                    </button>
                </td>
            `;
            list.appendChild(row);
        });
        lucide.createIcons();
    };

    // --- 3. Deletion Functions (Global) ---
    window.removeTransaction = (index) => {
        if (!state.isAdmin) return;
        if (confirm("Remove this transaction?")) {
            state.expenses.splice(index, 1);
            saveState();
            updateUI();
        }
    };

    window.removeStock = (index) => {
        if (!state.isAdmin) return;
        if (confirm("Remove this stock?")) {
            state.stocks.splice(index, 1);
            saveState();
            renderStocks();
        }
    };

    // --- 4. Admin Management ---
    const updateAdminVisibility = () => {
        const adminElements = document.querySelectorAll('.admin-only');
        adminElements.forEach(el => {
            const displayType = (el.tagName === 'TD' || el.tagName === 'TH') ? 'table-cell' : 'flex';
            el.style.display = state.isAdmin ? displayType : 'none';
        });

        const lockBtn = document.getElementById('admin-lock-btn');
        if (lockBtn) {
            lockBtn.classList.toggle('unlocked', state.isAdmin);
            const icon = lockBtn.querySelector('i');
            if (icon) {
                icon.setAttribute('data-lucide', state.isAdmin ? 'unlock' : 'lock');
                lucide.createIcons();
            }
        }
    };

    document.getElementById('admin-lock-btn').onclick = () => {
        if (state.isAdmin) {
            state.isAdmin = false;
            updateAdminVisibility();
        } else {
            const pw = prompt("Enter Passcode (Hint: 1234):");
            if (pw === "1234") {
                state.isAdmin = true;
                updateAdminVisibility();
            } else if (pw !== null) {
                alert("Wrong passcode.");
            }
        }
    };

    // --- 5. Data Actions ---
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
                const entry = {};
                headers.forEach((h, idx) => entry[h] = v[idx]);
                
                newEx.push({
                    date: entry['Date'] || '',
                    category: entry['Category'] || 'Others',
                    amount: parseFloat(entry['Amount']) || 0,
                    currency: entry['Currency'] || 'TWD',
                    account: entry['Account'] || 'Default',
                    type: entry['Income&Exp'] || 'EXP',
                    memo: entry['Memo'] || '',
                    lastUpdated: Date.now(),
                    uuidCode: entry['UUID'] || self.crypto.randomUUID()
                });
            }
            state.expenses = [...state.expenses, ...newEx];
            saveState();
            updateUI();
            alert(`Imported ${newEx.length} records!`);
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
            lastUpdated: Date.now(),
            uuidCode: self.crypto.randomUUID()
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

    // --- 6. Initialization ---
    initCharts();
    updateUI();
    
    // Sidebar nav listeners
    document.querySelectorAll('.nav-links li').forEach(li => {
        li.addEventListener('click', () => {
            const tabName = li.querySelector('span').innerText;
            window.switchTab(tabName);
        });
    });

    // Auto-fetch simulation for stocks
    const fetchStocks = async () => {
        const btn = document.getElementById('refresh-stocks');
        if (!btn) return;
        btn.classList.add('loading');
        await new Promise(r => setTimeout(r, 1200));
        state.stocks = state.stocks.map(s => ({
            ...s,
            price: s.price * (1 + (Math.random() * 0.02 - 0.01)),
            change: (Math.random() * 2 - 1).toFixed(2)
        }));
        saveState();
        renderStocks();
        btn.classList.remove('loading');
        
        const lastEl = document.getElementById('last-updated');
        if (lastEl) lastEl.textContent = `Updated: ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    };
    
    document.getElementById('refresh-stocks').onclick = fetchStocks;
});
