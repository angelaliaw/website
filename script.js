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
    // --- 1. State ---
    const defaultStocks = [
        { symbol: '2330.TW', name: 'TSMC', price: 820.0, change: 1.2 },
        { symbol: '2317.TW', name: 'Hon Hai', price: 155.0, change: -0.4 }
    ];
    const defaultExpenses = [
        { date: '2026-03-28', category: 'Housing', amount: 2800, type: 'EXP', currency: 'TWD', account: 'Fuban', memo: 'Rent', uuidCode: self.crypto.randomUUID() },
        { date: '2026-04-14', category: 'Food & Dining', amount: 1650, type: 'EXP', currency: 'TWD', account: 'Fuban', memo: 'Groceries', uuidCode: self.crypto.randomUUID() },
        { date: '2024-01-15', category: 'Others', amount: 1200, type: 'EXP', currency: 'TWD', account: 'Fuban', memo: 'Old Record', uuidCode: self.crypto.randomUUID() }
    ];

    let state = {
        stocks: JSON.parse(localStorage.getItem('wp_stocks')) || defaultStocks,
        expenses: JSON.parse(localStorage.getItem('wp_expenses')) || defaultExpenses,
        isAdmin: false
    };

    const save = () => {
        localStorage.setItem('wp_stocks', JSON.stringify(state.stocks));
        localStorage.setItem('wp_expenses', JSON.stringify(state.expenses));
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
    window.triggerUIUpdate = () => {
        const yF = document.getElementById('filter-year')?.value || 'all';
        const mF = document.getElementById('filter-month')?.value || 'all';
        const cF = document.getElementById('filter-category')?.value || 'all';
        const now = new Date();
        const curM = (now.getMonth() + 1).toString().padStart(2, '0');
        const curY = now.getFullYear().toString();

        // Totals mapping
        let detExp = 0, detInc = 0, detExpData = {}, filtered = [];
        let ovExp = 0, ovInc = 0, ovExpData = {};

        state.expenses.forEach(ex => {
            const { y, m } = parseDateObj(ex.date);
            const amount = parseFloat(ex.amount) || 0;

            // Overview (Home) filter: Current Month only
            if (y === curY && m === curM) {
                if (ex.type === 'INC') ovInc += amount;
                else {
                    ovExp += amount;
                    ovExpData[ex.category] = (ovExpData[ex.category] || 0) + amount;
                }
            }

            // Detailed Report filter
            const yearMatch = (yF === 'all') || (y === yF);
            const monthMatch = (mF === 'all') || (mF === 'current' && m === curM && y === curY) || (m === mF);
            const catMatch = (cF === 'all') || (ex.category === cF);

            if (yearMatch && monthMatch && catMatch) {
                filtered.push(ex);
                if (ex.type === 'INC') detInc += amount;
                else {
                    detExp += amount;
                    detExpData[ex.category] = (detExpData[ex.category] || 0) + amount;
                }
            }
        });

        // Update Overview UI
        const netOv = document.getElementById('net-income-value');
        if (netOv) {
            const net = ovInc - ovExp;
            netOv.textContent = (net >= 0 ? '+' : '') + '$' + net.toLocaleString();
            netOv.style.color = net >= 0 ? 'var(--accent-emerald)' : 'var(--accent-ruby)';
        }
        if (spendingChart) {
            spendingChart.data.labels = Object.keys(ovExpData);
            spendingChart.data.datasets[0].data = Object.values(ovExpData);
            spendingChart.update();
            const label = document.getElementById('total-spending-value');
            if (label) label.textContent = '$' + ovExp.toLocaleString();
        }

        // Update Detailed UI
        const setVal = (id, val) => { if (document.getElementById(id)) document.getElementById(id).textContent = '$' + val.toLocaleString(); };
        setVal('stats-total-exp', detExp);
        setVal('stats-total-inc', detInc);
        const netDet = document.getElementById('stats-net-income');
        if (netDet) {
            const net = detInc - detExp;
            netDet.textContent = (net >= 0 ? '+' : '') + '$' + net.toLocaleString();
            netDet.style.color = net >= 0 ? 'var(--accent-emerald)' : 'var(--accent-ruby)';
        }

        if (detailedChart) {
            detailedChart.data.labels = Object.keys(detExpData);
            detailedChart.data.datasets[0].data = Object.values(detExpData);
            detailedChart.update();
        }

        // Tables
        const fullBody = document.getElementById('full-transaction-list');
        if (fullBody) {
            fullBody.innerHTML = filtered.length === 0 ? `<tr><td colspan="6" style="text-align:center; padding: 2rem; color: var(--text-secondary);">No data found for this selection.</td></tr>` : '';
            filtered.sort((a,b) => b.date.localeCompare(a.date)).forEach(ex => {
                const row = document.createElement('tr');
                row.innerHTML = `<td>${ex.date}</td><td>${ex.category}</td><td class="${ex.type === 'EXP' ? 'negative' : 'positive'}">${ex.type === 'EXP' ? '-' : '+'}$${parseFloat(ex.amount).toLocaleString()}</td>
                    <td>${ex.account}</td><td>${ex.memo}</td>
                    <td class="admin-only"><button class="remove-btn" onclick="window.delTask(${state.expenses.indexOf(ex)})"><i data-lucide="x"></i></button></td>`;
                fullBody.appendChild(row);
            });
        }

        const miniBody = document.getElementById('transaction-list');
        if (miniBody) {
            miniBody.innerHTML = '';
            state.expenses.filter(e => e.type === 'EXP').sort((a,b) => b.date.localeCompare(a.date)).slice(0, 5).forEach(ex => {
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
            row.innerHTML = `<td><strong>${s.symbol}</strong><br><small>${s.name}</small></td><td>$${s.price.toFixed(2)}</td><td class="${s.change>=0?'positive':'negative'}">${s.change>=0?'+':''}${s.change}%</td><td class="admin-only"><button class="remove-btn" onclick="window.delStock(${i})"><i data-lucide="trash-2"></i></button></td>`;
            list.appendChild(row);
        });
    };

    const updateAdminUI = () => {
        const els = document.querySelectorAll('.admin-only');
        els.forEach(el => el.style.display = state.isAdmin ? (el.tagName === 'TD' ? 'table-cell' : 'flex') : 'none');
        const lock = document.getElementById('admin-lock-btn');
        if (lock) {
            lock.classList.toggle('unlocked', state.isAdmin);
            lock.querySelector('i')?.setAttribute('data-lucide', state.isAdmin ? 'unlock' : 'lock');
        }
    };

    window.delTask = (id) => { if (state.isAdmin && confirm("Delete?")) { state.expenses.splice(id,1); save(); window.triggerUIUpdate(); } };
    window.delStock = (id) => { if (state.isAdmin && confirm("Delete?")) { state.stocks.splice(id,1); save(); window.triggerUIUpdate(); } };

    // --- 5. Events ---
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
            const heads = lines[0].split(',').map(h => h.trim());
            const added = [];
            for (let i = 1; i < lines.length; i++) {
                if (!lines[i].trim()) continue;
                const v = lines[i].split(',').map(c => c.trim());
                const entry = {}; heads.forEach((h, idx) => entry[h] = v[idx]);
                added.push({ date: entry['Date'] || '', category: entry['Category'] || 'Others', amount: parseFloat(entry['Amount']) || 0, currency: entry['Currency'] || 'TWD', account: entry['Account'] || 'Default', type: entry['Income&Exp'] || 'EXP', memo: entry['Memo'] || '', uuidCode: entry['UUID'] || self.crypto.randomUUID() });
            }
            state.expenses = [...state.expenses, ...added];
            save(); updateYearDropdown(); window.triggerUIUpdate(); alert("Success!");
        };
        reader.readAsText(file);
    });

    document.getElementById('expense-form').onsubmit = (e) => {
        e.preventDefault();
        state.expenses.push({ date: document.getElementById('expense-date').value, category: document.getElementById('expense-category').value, amount: parseFloat(document.getElementById('expense-amount').value), type: document.getElementById('expense-type').value, account: document.getElementById('expense-account').value, memo: document.getElementById('expense-memo').value, uuidCode: self.crypto.randomUUID() });
        save(); updateYearDropdown(); window.triggerUIUpdate(); document.getElementById('expense-modal').classList.remove('active'); e.target.reset();
    };

    // --- 6. Start ---
    initCharts();
    updateYearDropdown();
    window.triggerUIUpdate();
    document.querySelectorAll('.nav-links li').forEach(li => li.onclick = () => window.switchTab(li.querySelector('span').innerText));
    document.getElementById('refresh-stocks').onclick = async () => {
        const b = document.getElementById('refresh-stocks'); b.classList.add('loading');
        await new Promise(r => setTimeout(r, 1000));
        state.stocks = state.stocks.map(s => ({ ...s, price: s.price*(1+(Math.random()*0.02-0.01)), change: (Math.random()*2-1).toFixed(2) }));
        save(); window.triggerUIUpdate(); b.classList.remove('loading');
    };
});
