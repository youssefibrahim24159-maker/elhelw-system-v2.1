// ==================== المتغيرات العامة ====================
let salesChart = null;
let topProductsChart = null;

// ==================== تحديث التقارير ====================
async function updateReports() {
    const startDate = document.getElementById('startDate') ? document.getElementById('startDate').value : '';
    const endDate = document.getElementById('endDate') ? document.getElementById('endDate').value : '';
    
    updateSummaryCards(startDate, endDate);
    updateSalesChart();
    updateTopProducts();
    updateLowStockReport();
    updateProfitLoss(startDate, endDate);
}

async function updateSummaryCards(startDate, endDate) {
    const invoices = await getAllInvoices();
    const filteredInvoices = invoices.filter(inv => isDateInRange(inv.date, startDate, endDate));
    const allReturns = await getAllSalesReturns();
    const filteredSalesReturns = allReturns.filter(r => isDateInRange(r.date, startDate, endDate));
    
    let totalSales = 0;
    let totalPaid = 0;
    let totalDue = 0;
    
    for(let i = 0; i < filteredInvoices.length; i++) {
        totalSales += filteredInvoices[i].grandTotal || 0;
        totalPaid += filteredInvoices[i].paid || 0;
        totalDue += filteredInvoices[i].due || 0;
    }
    
    let totalReturns = 0;
    for(let i = 0; i < filteredSalesReturns.length; i++) {
        totalReturns += filteredSalesReturns[i].total || 0;
    }
    
    const cardsDiv = document.getElementById('summaryCards');
    if(cardsDiv) {
        cardsDiv.innerHTML = 
            '<div class="col-md-3 col-6 mb-3"><div class="stat-card"><div class="stat-icon"><i class="fas fa-chart-line"></i></div><div class="stat-value">' + formatCurrency(totalSales) + '</div><div class="stat-label">إجمالي المبيعات</div></div></div>' +
            '<div class="col-md-3 col-6 mb-3"><div class="stat-card"><div class="stat-icon"><i class="fas fa-check-circle"></i></div><div class="stat-value">' + formatCurrency(totalPaid) + '</div><div class="stat-label">المدفوع</div></div></div>' +
            '<div class="col-md-3 col-6 mb-3"><div class="stat-card"><div class="stat-icon"><i class="fas fa-clock"></i></div><div class="stat-value">' + formatCurrency(totalDue) + '</div><div class="stat-label">المتبقي</div></div></div>' +
            '<div class="col-md-3 col-6 mb-3"><div class="stat-card"><div class="stat-icon"><i class="fas fa-file-invoice"></i></div><div class="stat-value">' + filteredInvoices.length + '</div><div class="stat-label">عدد الفواتير</div></div></div>' +
            '<div class="col-md-3 col-6 mb-3"><div class="stat-card"><div class="stat-icon"><i class="fas fa-undo"></i></div><div class="stat-value">' + formatCurrency(totalReturns) + '</div><div class="stat-label">مرتجعات البيع</div></div></div>';
    }
}

async function updateSalesChart() {
    const invoices = await getAllInvoices();
    const last7Days = [];
    const salesData = [];
    
    for(let i = 6; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        last7Days.push(date.toLocaleDateString('ar-EG'));
        
        let dailyTotal = 0;
        for(let j = 0; j < invoices.length; j++) {
            if(isSameDay(invoices[j].date, date)) {
                dailyTotal += invoices[j].grandTotal || 0;
            }
        }
        salesData.push(dailyTotal);
    }
    
    const ctx = document.getElementById('salesChart');
    if(ctx) {
        if(salesChart) salesChart.destroy();
        salesChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: last7Days,
                datasets: [{
                    label: '💰 المبيعات (ج.م)',
                    data: salesData,
                    borderColor: '#10B981',
                    backgroundColor: 'rgba(16, 185, 129, 0.15)',
                    tension: 0.4,
                    fill: true,
                    borderWidth: 3,
                    pointBackgroundColor: '#059669',
                    pointBorderColor: '#fff',
                    pointBorderWidth: 2,
                    pointRadius: 6,
                    pointHoverRadius: 10
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                plugins: {
                    legend: { position: 'top', labels: { font: { size: 14, weight: 'bold' } } }
                },
                scales: {
                    y: { beginAtZero: true, grid: { color: 'rgba(0,0,0,0.05)' } }
                }
            }
        });
    }
}

async function updateTopProducts() {
    const invoices = await getAllInvoices();
    const productSales = {};
    
    for(let i = 0; i < invoices.length; i++) {
        const items = invoices[i].items || [];
        for(let j = 0; j < items.length; j++) {
            const item = items[j];
            if(productSales[item.name]) {
                productSales[item.name] += item.quantity;
            } else {
                productSales[item.name] = item.quantity;
            }
        }
    }
    
    const sortedProducts = [];
    for(let name in productSales) {
        sortedProducts.push({ name: name, quantity: productSales[name] });
    }
    
    sortedProducts.sort((a, b) => b.quantity - a.quantity);
    
    const top5 = sortedProducts.slice(0, 5);
    const labels = top5.map(p => p.name);
    const data = top5.map(p => p.quantity);
    
    const colors = ['#059669', '#10b981', '#3b82f6', '#f59e0b', '#ef4444'];
    
    const ctx = document.getElementById('topProductsChart');
    if(ctx) {
        if(topProductsChart) topProductsChart.destroy();
        topProductsChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: '📦 كمية المبيعات',
                    data: data,
                    backgroundColor: colors,
                    borderRadius: 10,
                    borderSkipped: false
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                plugins: {
                    legend: { position: 'top', labels: { font: { size: 14, weight: 'bold' } } }
                },
                scales: {
                    y: { beginAtZero: true, grid: { color: 'rgba(0,0,0,0.05)' } }
                }
            }
        });
    }
}

async function updateLowStockReport() {
    const products = await getAllProducts();
    const lowStock = [];
    for(let i = 0; i < products.length; i++) {
        if((products[i].stock || 0) < (products[i].minStock || 10)) {
            lowStock.push(products[i]);
        }
    }
    
    const tbody = document.getElementById('lowStockBody');
    if(tbody) {
        if(lowStock.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" class="text-center py-3">✅ جميع المنتجات متوفرة بكميات كافية</td></tr>';
            return;
        }
        
        let html = '';
        for(let i = 0; i < lowStock.length; i++) {
            const p = lowStock[i];
            html += '<tr class="scale-hover">';
            html += '<td><strong>' + p.name + '</strong></td>';
            html += '<td class="text-danger fw-bold pulse-animation">' + (p.stock || 0) + '</td>';
            html += '<td>' + (p.minStock || 10) + '</td>';
            html += '<td><a href="inventory.html" class="btn btn-sm btn-warning shake">⚡ تزويد</a></td>';
            html += '</tr>';
        }
        tbody.innerHTML = html;
    }
}

async function updateProfitLoss(startDate, endDate) {
    const invoices = await getAllInvoices();
    const products = await getAllProducts();
    
    const filteredInvoices = invoices.filter(inv => isDateInRange(inv.date, startDate, endDate));
    const allSalesReturns = await getAllSalesReturns();
    const filteredSalesReturns = allSalesReturns.filter(r => isDateInRange(r.date, startDate, endDate));
    const allPurchaseReturns = await getAllPurchaseReturns();
    const filteredPurchaseReturns = allPurchaseReturns.filter(r => isDateInRange(r.date, startDate, endDate));
    const allExpenses = await getAllExpenses();
    const filteredExpenses = allExpenses.filter(e => isDateInRange(e.date, startDate, endDate));
    
    function costOf(productId) {
        const p = products.find(pr => pr.id == productId);
        return p ? (p.cost || 0) : 0;
    }
    
    let totalSales = 0;
    let totalCost = 0;
    
    for(let i = 0; i < filteredInvoices.length; i++) {
        const inv = filteredInvoices[i];
        totalSales += inv.grandTotal || 0;
        
        const items = inv.items || [];
        for(let j = 0; j < items.length; j++) {
            const item = items[j];
            totalCost += costOf(item.id) * (item.quantity || item.qty || 0);
        }
    }
    
    // مرتجعات البيع: بتقلل صافي المبيعات وترجّع تكلفة البضاعة المرتجعة للمخزون (بتقلل التكلفة)
    let salesReturnsValue = 0;
    let salesReturnsCost = 0;
    for(let i = 0; i < filteredSalesReturns.length; i++) {
        const ret = filteredSalesReturns[i];
        salesReturnsValue += ret.total || 0;
        (ret.items || []).forEach(item => {
            salesReturnsCost += costOf(item.id) * (item.quantity || 0);
        });
    }
    
    // مرتجعات الشراء: بيانات إضافية عن البضاعة المرجوعة للمورد (بند مستقل، مش جزء من ربح المبيعات)
    let purchaseReturnsValue = 0;
    for(let i = 0; i < filteredPurchaseReturns.length; i++) {
        purchaseReturnsValue += filteredPurchaseReturns[i].total || 0;
    }
    
    let totalExpenses = 0;
    for(let i = 0; i < filteredExpenses.length; i++) {
        totalExpenses += filteredExpenses[i].amount || 0;
    }
    
    const netSales = totalSales - salesReturnsValue;
    const netCost = totalCost - salesReturnsCost;
    const grossProfit = netSales - netCost;
    const netProfit = grossProfit - totalExpenses;
    
    document.getElementById('totalSales').innerHTML = formatCurrency(totalSales);
    document.getElementById('totalCost').innerHTML = formatCurrency(totalCost);
    document.getElementById('totalProfit').innerHTML = formatCurrency(grossProfit);
    document.getElementById('totalExpenses').innerHTML = formatCurrency(totalExpenses);
    document.getElementById('netProfit').innerHTML = formatCurrency(netProfit);
    
    const salesReturnsEl = document.getElementById('salesReturnsValue');
    if(salesReturnsEl) salesReturnsEl.innerHTML = formatCurrency(salesReturnsValue);
    const purchaseReturnsEl = document.getElementById('purchaseReturnsValue');
    if(purchaseReturnsEl) purchaseReturnsEl.innerHTML = formatCurrency(purchaseReturnsValue);
    
    // نبض للقيم المهمة
    applyPulseEffect(document.getElementById('totalSales'));
    applyPulseEffect(document.getElementById('netProfit'));
}

function resetDates() {
    document.getElementById('startDate').value = '';
    document.getElementById('endDate').value = '';
    updateReports();
}

function printReport() {
    const startDate = document.getElementById('startDate').value;
    const endDate = document.getElementById('endDate').value;
    
    const printWindow = window.open('', '_blank');
    
    let dateRangeText = '';
    if (startDate || endDate) {
        const start = startDate ? startDate.split('-').reverse().join('/') : 'بداية';
        const end = endDate ? endDate.split('-').reverse().join('/') : 'نهاية';
        dateRangeText = `<p style="text-align:center;background:#f0fdf4;padding:10px;border-radius:10px;font-weight:bold;color:#0d6e3b;">الفترة: ${start} - ${end}</p>`;
    } else {
        dateRangeText = `<p style="text-align:center;background:#f0fdf4;padding:10px;border-radius:10px;font-weight:bold;color:#0d6e3b;">عرض جميع البيانات</p>`;
    }
    
    const totalSales = document.getElementById('totalSales').innerText;
    const totalCost = document.getElementById('totalCost').innerText;
    const totalProfit = document.getElementById('totalProfit').innerText;
    const totalExpenses = document.getElementById('totalExpenses').innerText;
    const netProfit = document.getElementById('netProfit').innerText;
    const salesReturnsValue = document.getElementById('salesReturnsValue') ? document.getElementById('salesReturnsValue').innerText : '0.00 ج.م';
    const purchaseReturnsValue = document.getElementById('purchaseReturnsValue') ? document.getElementById('purchaseReturnsValue').innerText : '0.00 ج.م';
    const summaryCards = document.getElementById('summaryCards').innerHTML;
    const lowStockTable = document.getElementById('lowStockBody').innerHTML;
    
    printWindow.document.write(`
        <!DOCTYPE html>
        <html dir="rtl">
        <head>
            <meta charset="UTF-8">
            <title>تقرير المبيعات - نظام Elhelw</title>
            <style>
                * { margin: 0; padding: 0; box-sizing: border-box; }
                body { font-family: 'Cairo', 'Tahoma', sans-serif; background: white; color: #0f172a; padding: 30px; line-height: 1.5; }
                .print-header { text-align: center; margin-bottom: 30px; padding-bottom: 20px; border-bottom: 3px solid #0d6e3b; }
                .print-header h1 { color: #0d6e3b; font-size: 2rem; margin-bottom: 5px; }
                .print-title { font-size: 1.4rem; font-weight: bold; margin: 25px 0 15px 0; padding-right: 10px; border-right: 5px solid #0d6e3b; }
                table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
                th, td { border: 1px solid #e2e8f0; padding: 12px; text-align: center; }
                th { background: #f1f5f9; font-weight: bold; }
                .profit-loss-table { max-width: 500px; margin: 0 auto 30px auto; }
                .profit-loss-table td { text-align: right; }
                .profit-loss-table td:first-child { font-weight: bold; background: #f8fafc; }
                .footer { margin-top: 40px; padding-top: 20px; text-align: center; font-size: 0.7rem; color: #94a3b8; border-top: 1px solid #e2e8f0; }
                @media print { body { padding: 20px; } }
            </style>
        </head>
        <body>
            <div class="print-header">
                <h1>📊 ${getStoreName()}</h1>
                <p>تقرير المبيعات والأرباح</p>
                ${dateRangeText}
                <p style="font-size: 0.8rem; margin-top: 10px;">تاريخ الطباعة: ${new Date().toLocaleString('ar-EG')}</p>
            </div>
            <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:15px;margin-bottom:30px;">
                ${summaryCards}
            </div>
            <div class="print-title">💰 الأرباح والخسائر</div>
            <table class="profit-loss-table">
                <tr><td>إجمالي المبيعات</td><td style="color:#3b82f6;font-weight:bold;">${totalSales}</td></tr>
                <tr><td>مرتجعات البيع</td><td style="color:#ef4444;">- ${salesReturnsValue}</td></tr>
                <tr><td>تكلفة البضائع المباعة</td><td style="color:#ef4444;">${totalCost}</td></tr>
                <tr style="background:#f0fdf4;"><td style="font-weight:bold;">إجمالي الربح</td><td style="color:#10b981;font-weight:bold;">${totalProfit}</td></tr>
                <tr><td>إجمالي المصروفات</td><td style="color:#ef4444;">${totalExpenses}</td></tr>
                <tr style="background:#e0f2fe;"><td style="font-weight:bold;">صافي الربح</td><td style="color:#3b82f6;font-weight:bold;">${netProfit}</td></tr>
                <tr><td>مرتجعات الشراء (للمورد)</td><td style="color:#64748b;">${purchaseReturnsValue}</td></tr>
            </table>
            <div class="print-title">⚠️ تقرير جرد المخزون</div>
            <table>
                <thead><tr><th>المنتج</th><th>الكمية الحالية</th><th>الحد الأدنى</th><th>الإجراء</th></tr></thead>
                <tbody>${lowStockTable}</tbody>
            </table>
            <div class="footer"><p>تم إنشاء هذا التقرير بواسطة ${getStoreName()} - جميع الحقوق محفوظة © 2025</p></div>
        </body>
        </html>
    `);
    
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
        printWindow.print();
    }, 500);
}

function toggleSidebar() {
    document.getElementById('sidebar').classList.toggle('open');
    document.querySelector('.sidebar-overlay').classList.toggle('active');
}

function closeSidebar() {
    document.getElementById('sidebar').classList.remove('open');
    document.querySelector('.sidebar-overlay').classList.remove('active');
}

// ==================== التهيئة ====================
if(document.getElementById('salesChart')) {
    updateReports();
}