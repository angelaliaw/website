document.addEventListener('DOMContentLoaded', () => {
    // --- 1. State Management ---
    const defaultStocks = [
        { symbol: 'AAPL', name: 'Apple Inc.', price: 229.45, change: 1.85 },
        { symbol: 'TSLA', name: 'Tesla Inc.', price: 218.70, change: -0.65 },
        { symbol: 'NVDA', name: 'Nvidia Corp.', price: 138.10, change: 2.11 },
        { symbol: 'AMZN', name: 'Amazon.com', price: 185.35, change: 0.92 }
    ];

    const defaultExpenses = [
        { date: '2026-03-28', category: 'Housing', categoryGroup: '', amount: 2800, currency: 'TWD', member: 'Self', account: 'Fuban', tags: '', memo: 'Rent', type: 'EXP', lastUpdated: Date.now(), uuidCode: self.crypto.randomUUID() },
        { date: '2026-03-29', category: 'Food & Dining', categoryGroup: '', amount: 1650, currency: 'TWD', member: 'Self', account: 'Fuban', tags: '', memo: 'Groceries', type: 'EXP', lastUpdated: Date.now(), uuidCode: self.crypto.randomUUID() },
        { date: '2026-03-30', category: 'Entertainment', categoryGroup: '', amount: 1100, currency: 'TWD', member: 'Self', account: 'Fuban', tags: '', memo: 'Movies', type: 'EXP', lastUpdated: Date.now(), uuidCode: self.crypto.randomUUID() }
    ];

    let state = {
        stocks: JSON.parse(localStorage.getItem('wp_stocks')) || defaultStocks,
        expenses: JSON.parse(localStorage.getItem('wp_expenses')) || defaultExpenses,
        lastFetch: localStorage.getItem('wp_last_fetch') || null
    };

    const saveState = () => {
        localStorage.setItem('wp_stocks', JSON.stringify(state.stocks));
        localStorage.setItem('wp_expenses', JSON.stringify(state.expenses));
    };

    // --- 2. Chart & List Utilities ---
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
                    label: 'Portfolio Value',
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
                    y: { grid: { color: 'rgba(255, 255, 255, 0.05)' }, ticks: { color: '#64748b', callback: (val) => '$' + (val / 1000) + 'k' } }
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

    const updateTotalSpending = () => {
        const data = getAggregateSpending();
        const total = Object.values(data).reduce((a, b) => a + b, 0);
        document.getElementById('total-spending-value').textContent = '$' + total.toLocaleString(undefined, { minimumFractionDigits: 2 });
    };

    const renderTransactionList = () => {
        const list = document.getElementById('transaction-list');
        list.innerHTML = '';
        // Show last 50 transactions, newest first
        [...state.expenses].reverse().slice(0, 50).forEach((ex, idx) => {
            const originalIdx = state.expenses.length - 1 - idx;
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${ex.date}</td>
                <td>${ex.category}</td>
                <td class="${ex.type === 'EXP' ? 'negative' : 'positive'}">
                    ${ex.type === 'EXP' ? '-' : '+'}$${parseFloat(ex.amount).toLocaleString()}
                </td>
                <td>
                    <button class="remove-btn" onclick="removeTransaction(${originalIdx})">
                        <i data-lucide="x" style="width: 14px;"></i>
                    </button>
                </td>
            `;
            list.appendChild(row);
        });
        lucide.createIcons();
    };

    window.removeTransaction = (index) => {
        state.expenses.splice(index, 1);
        saveState();
        updateUI();
    };

    const updateUI = () => {
        const data = getAggregateSpending();
        spendingChart.data.labels = Object.keys(data);
        spendingChart.data.datasets[0].data = Object.values(data);
        spendingChart.update();
        updateTotalSpending();
        renderTransactionList();
    };

    // --- 3. CSV Handling ---
    const headers_csv = ["Date", "Category", "Category Group", "Amount", "Currency", "Member", "Account", "Tags", "Memo", "Income&Exp", "Last updated", "UUID"];

    const parseCSV = (text) => {
        const lines = text.split('\n');
        const headers = lines[0].split(',').map(h => h.trim());
        const result = [];
        
        for (let i = 1; i < lines.length; i++) {
            if (!lines[i].trim()) continue;
            // Handle basic CSV splitting (doesn't handle commas in quotes, but matches common export formats)
            const values = lines[i].split(',').map(v => v.trim());
            const entry = {};
            headers.forEach((header, index) => {
                entry[header] = values[index];
            });
            
            let dateStr = entry['Date'] || '';
            if (dateStr.length === 8 && !dateStr.includes('-')) {
                dateStr = `${dateStr.substring(0,4)}-${dateStr.substring(4,6)}-${dateStr.substring(6,8)}`;
            }

            result.push({
                date: dateStr,
                category: entry['Category'] || 'Others',
                categoryGroup: entry['Category Group'] || '',
                amount: parseFloat(entry['Amount']) || 0,
                currency: entry['Currency'] || 'TWD',
                member: entry['Member'] || 'Self',
                account: entry['Account'] || 'Default',
                tags: entry['Tags'] || '',
                memo: entry['Memo'] || '',
                type: entry['Income&Exp'] || 'EXP',
                lastUpdated: entry['Last updated'] || Date.now(),
                uuidCode: entry['UUID'] || self.crypto.randomUUID()
            });
        }
        return result;
    };

    const exportToCSV = () => {
        let csvContent = headers_csv.join(",") + "\n";
        state.expenses.forEach(ex => {
            const dateClean = ex.date.replace(/-/g, '');
            const row = [
                dateClean,
                ex.category,
                ex.categoryGroup || '',
                ex.amount,
                ex.currency,
                ex.member || 'Self',
                ex.account || 'Fuban',
                ex.tags || '',
                `"${ex.memo || ''}"`,
                ex.type,
                ex.lastUpdated || Date.now(),
                ex.uuidCode || self.crypto.randomUUID()
            ];
            csvContent += row.join(",") + "\n";
        });

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", `wealthpulse_expenses_${new Date().toISOString().split('T')[0]}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    document.getElementById('csv-upload').addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (event) => {
            const text = event.target.result;
            const newExpenses = parseCSV(text);
            state.expenses = [...state.expenses, ...newExpenses];
            saveState();
            updateUI();
            alert(`Imported ${newExpenses.length} records.`);
        };
        reader.readAsText(file);
    });

    document.getElementById('export-csv').onclick = exportToCSV;

    // --- 4. Form & View Handling ---
    const setupModals = () => {
        const expenseModal = document.getElementById('expense-modal');
        const stockModal = document.getElementById('stock-modal');
        
        document.getElementById('add-expense-btn').onclick = () => {
            document.getElementById('expense-date').value = new Date().toISOString().split('T')[0];
            expenseModal.classList.add('active');
        };
        document.getElementById('add-stock-btn').onclick = () => stockModal.classList.add('active');

        document.querySelectorAll('.close-modal').forEach(btn => {
            btn.onclick = () => {
                expenseModal.classList.remove('active');
                stockModal.classList.remove('active');
            };
        });

        document.getElementById('expense-form').onsubmit = (e) => {
            e.preventDefault();
            const transaction = {
                date: document.getElementById('expense-date').value,
                type: document.getElementById('expense-type').value,
                category: document.getElementById('expense-category').value,
                categoryGroup: '',
                amount: parseFloat(document.getElementById('expense-amount').value),
                currency: document.getElementById('expense-currency').value,
                member: 'Self',
                account: document.getElementById('expense-account').value,
                tags: '',
                memo: document.getElementById('expense-memo').value,
                lastUpdated: Date.now(),
                uuidCode: self.crypto.randomUUID()
            };
            
            state.expenses.push(transaction);
            saveState();
            updateUI();
            expenseModal.classList.remove('active');
            e.target.reset();
        };

        // View Toggle Logic
        document.querySelectorAll('.toggle-btn').forEach(btn => {
            btn.onclick = () => {
                const view = btn.getAttribute('data-view');
                document.querySelectorAll('.toggle-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                
                document.querySelectorAll('.spending-view').forEach(v => v.classList.remove('active'));
                document.getElementById(`spending-${view}-view`).classList.add('active');
            };
        });
    };

    // --- 5. Stocks (Retained from previous) ---
    const renderStocks = () => {
        const stockList = document.getElementById('stock-list');
        stockList.innerHTML = '';
        state.stocks.forEach((stock, index) => {
            const row = document.createElement('tr');
            const changeClass = stock.change >= 0 ? 'positive' : 'negative';
            const changeSign = stock.change >= 0 ? '+' : '';
            row.innerHTML = `
                <td>
                    <div class="symbol-cell">
                        <div class="symbol-icon">${stock.symbol.charAt(0)}</div>
                        <div class="symbol-info">
                            <strong>${stock.symbol}</strong><br>
                            <small style="color: #64748b">${stock.name}</small>
                        </div>
                    </div>
                </td>
                <td>$${parseFloat(stock.price).toFixed(2)}</td>
                <td class="trend ${changeClass}">${changeSign}${stock.change}%</td>
                <td>
                    <button class="remove-btn" onclick="removeStock(${index})">
                        <i data-lucide="trash-2" style="width: 16px;"></i>
                    </button>
                </td>
            `;
            stockList.appendChild(row);
        });
        lucide.createIcons();
    };

    window.removeStock = (index) => {
        state.stocks.splice(index, 1);
        saveState();
        renderStocks();
    };

    // --- 6. Initialization ---
    initCharts();
    renderStocks();
    renderTransactionList();
    setupModals();
    
    // Auto-fetch placeholder logic (can be expanded)
    const updateLastUpdatedText = () => {
        const el = document.getElementById('last-updated');
        if (state.lastFetch) {
            const date = new Date(state.lastFetch);
            el.textContent = `Updated: ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
        }
    };
    updateLastUpdatedText();
});
