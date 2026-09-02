// ==================== دوال التنسيق ====================
function formatCurrency(amount) {
    if(isNaN(amount)) amount = 0;
    return amount.toFixed(2) + ' ج.م';
}

function formatDate(date) {
    return new Date(date).toLocaleDateString('ar-EG');
}

function formatDateTime(date) {
    return new Date(date).toLocaleString('ar-EG');
}

// ==================== الإشعارات ====================
function showNotification(message, type) {
    if(type === undefined) type = 'success';
    
    const notification = document.createElement('div');
    let bgColor = '';
    let icon = '';
    let borderColor = '';
    let textColor = '';
    
    if(type === 'success') {
        bgColor = 'linear-gradient(135deg, #1a1a1a, #000000)';
        icon = 'fa-check-circle';
        borderColor = '#e6c942';
        textColor = '#e6c942';
    } else if(type === 'error') {
        bgColor = 'linear-gradient(135deg, #dc2626, #b91c1c)';
        icon = 'fa-exclamation-circle';
        borderColor = '#f87171';
        textColor = '#ffffff';
    } else {
        bgColor = 'linear-gradient(135deg, #1a1a1a, #000000)';
        icon = 'fa-info-circle';
        borderColor = '#e6c942';
        textColor = '#e6c942';
    }
    
    notification.style.cssText = `
        position: fixed;
        top: 25px;
        left: 50%;
        transform: translateX(-50%) translateY(-20px);
        background: ${bgColor};
        color: ${textColor};
        padding: 16px 32px;
        border-radius: 16px;
        z-index: 9999;
        min-width: 320px;
        text-align: center;
        box-shadow: 0 15px 40px rgba(0,0,0,0.3), 0 0 0 3px ${borderColor};
        font-weight: 700;
        font-size: 0.9rem;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 12px;
        animation: notifIn 0.5s cubic-bezier(0.68, -0.55, 0.265, 1.55) forwards;
        border: 2px solid ${borderColor};
        backdrop-filter: blur(10px);
        letter-spacing: 0.5px;
    `;
    
    notification.innerHTML = '<i class="fas ' + icon + ' fa-lg"></i> ' + message;
    
    document.body.appendChild(notification);
    
    if(!document.getElementById('notifStyle')) {
        const style = document.createElement('style');
        style.id = 'notifStyle';
        style.textContent = `
            @keyframes notifIn {
                from { opacity: 0; transform: translateX(-50%) translateY(-30px) scale(0.8); }
                to { opacity: 1; transform: translateX(-50%) translateY(0) scale(1); }
            }
            @keyframes notifOut {
                from { opacity: 1; transform: translateX(-50%) translateY(0) scale(1); }
                to { opacity: 0; transform: translateX(-50%) translateY(-20px) scale(0.8); }
            }
        `;
        document.head.appendChild(style);
    }
    
    setTimeout(function() {
        notification.style.animation = 'notifOut 0.4s ease forwards';
        setTimeout(function() {
            if(notification.parentNode) notification.remove();
        }, 400);
    }, 3500);
}

// ==================== التصدير إلى Excel ====================
function exportToExcel(data, filename) {
    if(!data || data.length === 0) {
        showNotification('لا توجد بيانات للتصدير', 'error');
        return; 
    }
    
    let headers = [];
    for(let key in data[0]) {
        headers.push(key);
    }
    
    let csvRows = [];
    csvRows.push(headers.join(','));
    
    for(let i = 0; i < data.length; i++) {
        const row = data[i];
        let values = [];
        for(let j = 0; j < headers.length; j++) {
            let value = row[headers[j]] || '';
            value = String(value).replace(/"/g, '""');
            values.push('"' + value + '"');
        } 
        csvRows.push(values.join(','));
    }
    
    const blob = new Blob(['\uFEFF' + csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.href = url;
    link.setAttribute('download', filename + '_' + new Date().toISOString().split('T')[0] + '.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    showNotification('تم التصدير بنجاح 🎉', 'success');
}

// ==================== الطباعة ====================
// اسم المتجر الحالي (من بيانات تسجيل الدخول) - بيتحط تلقائيًا في أي فاتورة/تقرير مطبوع
function getStoreName() {
    try {
        const session = JSON.parse(localStorage.getItem('currentSession') || '{}');
        return session.storeName || 'ELHELW';
    } catch (e) {
        return 'ELHELW';
    }
}

function printElement(elementId) {
    const element = document.getElementById(elementId);
    if(!element) return;
    
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
        <!DOCTYPE html>
        <html dir="rtl">
        <head>
            <meta charset="UTF-8">
            <title>طباعة</title>
            <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
            <style>
                body { font-family: 'Tahoma', 'Cairo', sans-serif; padding: 20px; }
                table { width: 100%; }
                @media print { body { padding: 0; } }
            </style>
        </head>
        <body>${element.innerHTML}</body>
        </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
        printWindow.print();
        printWindow.close();
    }, 700);
}

// ==================== طباعة فاتورة موحّدة (نفس التصميم في كل الصفحة) ====================
// invoice المتوقع: { id, date (نص جاهز للعرض), customerName, items: [{name, price, qty|quantity}],
// subtotal?, discount?, tax?, grandTotal|total, paid, due|remaining, paymentMethod }
function buildInvoiceReceiptHTML(invoice) {
    const items = invoice.items || [];
    const grandTotal = invoice.grandTotal || invoice.total || 0;
    const due = invoice.due !== undefined ? invoice.due : (invoice.remaining || 0);
    const subtotal = invoice.subtotal !== undefined ? invoice.subtotal : items.reduce((s, i) => s + (i.price * (i.qty || i.quantity || 0)), 0);
    const discount = invoice.discount || 0;
    const tax = invoice.tax || 0;

    const paymentLabelMap = { cash: '💰 كاش', visa: '💳 فيزا', credit: '📅 آجل', 'كاش': '💰 كاش', 'فيزا': '💳 فيزا', 'آجل': '📅 آجل' };
    const paymentLabel = paymentLabelMap[invoice.paymentMethod] || (invoice.paymentMethod || '-');

    const itemsHtml = items.map(i => `
        <tr>
            <td style="text-align:right;font-weight:600;">${i.name}</td>
            <td>${i.qty || i.quantity || 0}</td>
            <td>${formatCurrency(i.price)}</td>
            <td>${formatCurrency(i.price * (i.qty || i.quantity || 0))}</td>
        </tr>
    `).join('');

    return `
        <!DOCTYPE html>
        <html dir="rtl">
        <head>
            <meta charset="UTF-8">
            <title>فاتورة ${invoice.id}</title>
            <style>
                * { margin: 0; padding: 0; box-sizing: border-box; }
                body { font-family: 'Tahoma', 'Cairo', sans-serif; background: #f5f5f5; display: flex; justify-content: center; align-items: center; min-height: 100vh; padding: 30px; }
                .invoice-wrapper { max-width: 400px; margin: 0 auto; background: white; border-radius: 20px; box-shadow: 0 30px 60px rgba(0,0,0,0.2); overflow: hidden; position: relative; }
                .invoice-wrapper::before { content: ''; position: absolute; top: 0; left: 0; right: 0; height: 8px; background: linear-gradient(90deg, #fbbf24, #d97706, #fbbf24); }
                .invoice-header { background: linear-gradient(135deg, #0d6e3b, #064e2b); padding: 25px 20px; text-align: center; color: white; }
                .store-name { font-size: 1.6rem; font-weight: 800; letter-spacing: 2px; }
                .store-slogan { font-size: 0.7rem; opacity: 0.8; margin-top: 5px; }
                .invoice-info { padding: 20px; background: #f8fafc; border-bottom: 1px solid #e2e8f0; }
                .info-row { display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 0.85rem; }
                .customer-section { padding: 15px 20px; background: #fffbeb; border-bottom: 1px solid #fef3c7; }
                .products-table { width: 100%; border-collapse: collapse; }
                .products-table th { background: #f1f5f9; padding: 12px 8px; font-size: 0.7rem; color: #475569; border-bottom: 1px solid #e2e8f0; }
                .products-table td { padding: 10px 8px; font-size: 0.8rem; border-bottom: 1px solid #f1f5f9; text-align: center; }
                .totals-section { padding: 15px 20px; background: #f8fafc; }
                .total-row { display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 0.85rem; }
                .grand-total { background: #e8f5e9; margin: 10px -20px -15px -20px; padding: 15px 20px; font-size: 1.2rem; font-weight: 800; }
                .invoice-footer { padding: 15px 20px; text-align: center; background: white; border-top: 1px dashed #e2e8f0; }
                @media print { body { background: white; padding: 0; } .invoice-wrapper { box-shadow: none; border-radius: 0; } }
            </style>
        </head>
        <body>
            <div class="invoice-wrapper">
                <div class="invoice-header">
                    <div style="font-size:3rem;">🏪</div>
                    <div class="store-name">${getStoreName()}</div>
                    <div class="store-slogan">نظام متكامل لإدارة المبيعات</div>
                </div>
                <div class="invoice-info">
                    <div class="info-row"><span>رقم الفاتورة</span><span><strong>#${invoice.id}</strong></span></div>
                    <div class="info-row"><span>التاريخ</span><span>${invoice.date}</span></div>
                </div>
                <div class="customer-section">
                    <div style="font-size:0.7rem;color:#d97706;">بيانات العميل</div>
                    <div style="font-weight:700;">${invoice.customerName || 'عميل نقدي'}</div>
                </div>
                <table class="products-table">
                    <thead><tr><th>المنتج</th><th>الكمية</th><th>السعر</th><th>الإجمالي</th></tr></thead>
                    <tbody>${itemsHtml}</tbody>
                </table>
                <div style="background:#e8f5e9;padding:10px 20px;display:flex;justify-content:space-between;">
                    <span>طريقة الدفع</span>
                    <span><strong>${paymentLabel}</strong></span>
                </div>
                <div class="totals-section">
                    <div class="total-row"><span>الإجمالي الفرعي</span><span>${formatCurrency(subtotal)}</span></div>
                    ${discount > 0 ? `<div class="total-row"><span>الخصم</span><span style="color:#d97706;">- ${formatCurrency(discount)}</span></div>` : ''}
                    ${tax > 0 ? `<div class="total-row"><span>الضريبة</span><span>${formatCurrency(tax)}</span></div>` : ''}
                    <div class="total-row grand-total"><span>الإجمالي النهائي</span><span>${formatCurrency(grandTotal)}</span></div>
                    <div class="total-row"><span>المدفوع</span><span>${formatCurrency(invoice.paid || 0)}</span></div>
                    ${due > 0 ? `<div class="total-row"><span style="color:#ef4444;">المتبقي</span><span style="color:#ef4444;font-weight:bold;">${formatCurrency(due)}</span></div>` : ''}
                </div>
                <div class="invoice-footer">
                    <div style="font-weight:700;color:#0d6e3b;">شكراً لتسوقكم معنا</div>
                    <div style="font-size:0.65rem;color:#94a3b8;">نظام Elhelw</div>
                </div>
            </div>
            <script>window.onload=function(){window.print();setTimeout(function(){window.close();},1000);}<\/script>
        </body>
        </html>
    `;
}

function printInvoiceReceipt(invoice) {
    const w = window.open('', '_blank');
    w.document.write(buildInvoiceReceiptHTML(invoice));
    w.document.close();
}

// ==================== طباعة فاتورة شراء (نفس شكل فاتورة البيع بس بيانات مورد) ====================
// invoice المتوقع: { id, date, supplierName, items: [{name, cost, qty}], total, paid, due, paymentMethod }
function buildPurchaseInvoiceReceiptHTML(invoice) {
    const items = invoice.items || [];
    const total = invoice.total || 0;
    const due = invoice.due || 0;

    const paymentLabelMap = { cash: '💰 كاش', visa: '💳 فيزا', credit: '📅 آجل', 'كاش': '💰 كاش', 'فيزا': '💳 فيزا', 'آجل': '📅 آجل' };
    const paymentLabel = paymentLabelMap[invoice.paymentMethod] || (invoice.paymentMethod || '-');

    const itemsHtml = items.map(i => `
        <tr>
            <td style="text-align:right;font-weight:600;">${i.name}</td>
            <td>${i.qty || i.quantity || 0}</td>
            <td>${formatCurrency(i.cost)}</td>
            <td>${formatCurrency((i.cost || 0) * (i.qty || i.quantity || 0))}</td>
        </tr>
    `).join('');

    return `
        <!DOCTYPE html>
        <html dir="rtl">
        <head>
            <meta charset="UTF-8">
            <title>فاتورة شراء ${invoice.id}</title>
            <style>
                * { margin: 0; padding: 0; box-sizing: border-box; }
                body { font-family: 'Tahoma', 'Cairo', sans-serif; background: #f5f5f5; display: flex; justify-content: center; align-items: center; min-height: 100vh; padding: 30px; }
                .invoice-wrapper { max-width: 400px; margin: 0 auto; background: white; border-radius: 20px; box-shadow: 0 30px 60px rgba(0,0,0,0.2); overflow: hidden; position: relative; }
                .invoice-wrapper::before { content: ''; position: absolute; top: 0; left: 0; right: 0; height: 8px; background: linear-gradient(90deg, #fbbf24, #d97706, #fbbf24); }
                .invoice-header { background: linear-gradient(135deg, #7c2d12, #431407); padding: 25px 20px; text-align: center; color: white; }
                .store-name { font-size: 1.6rem; font-weight: 800; letter-spacing: 2px; }
                .store-slogan { font-size: 0.7rem; opacity: 0.8; margin-top: 5px; }
                .invoice-info { padding: 20px; background: #f8fafc; border-bottom: 1px solid #e2e8f0; }
                .info-row { display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 0.85rem; }
                .customer-section { padding: 15px 20px; background: #fffbeb; border-bottom: 1px solid #fef3c7; }
                .products-table { width: 100%; border-collapse: collapse; }
                .products-table th { background: #f1f5f9; padding: 12px 8px; font-size: 0.7rem; color: #475569; border-bottom: 1px solid #e2e8f0; }
                .products-table td { padding: 10px 8px; font-size: 0.8rem; border-bottom: 1px solid #f1f5f9; text-align: center; }
                .totals-section { padding: 15px 20px; background: #f8fafc; }
                .total-row { display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 0.85rem; }
                .grand-total { background: #fef3c7; margin: 10px -20px -15px -20px; padding: 15px 20px; font-size: 1.2rem; font-weight: 800; }
                .invoice-footer { padding: 15px 20px; text-align: center; background: white; border-top: 1px dashed #e2e8f0; }
                @media print { body { background: white; padding: 0; } .invoice-wrapper { box-shadow: none; border-radius: 0; } }
            </style>
        </head>
        <body>
            <div class="invoice-wrapper">
                <div class="invoice-header">
                    <div style="font-size:3rem;">📦</div>
                    <div class="store-name">${getStoreName()}</div>
                    <div class="store-slogan">فاتورة شراء - نظام متكامل لإدارة المبيعات</div>
                </div>
                <div class="invoice-info">
                    <div class="info-row"><span>رقم فاتورة الشراء</span><span><strong>#${invoice.id}</strong></span></div>
                    <div class="info-row"><span>التاريخ</span><span>${invoice.date}</span></div>
                </div>
                <div class="customer-section">
                    <div style="font-size:0.7rem;color:#d97706;">بيانات المورد</div>
                    <div style="font-weight:700;">${invoice.supplierName || '-'}</div>
                </div>
                <table class="products-table">
                    <thead><tr><th>الصنف</th><th>الكمية</th><th>سعر الشراء</th><th>الإجمالي</th></tr></thead>
                    <tbody>${itemsHtml}</tbody>
                </table>
                <div style="background:#fef3c7;padding:10px 20px;display:flex;justify-content:space-between;">
                    <span>طريقة الدفع</span>
                    <span><strong>${paymentLabel}</strong></span>
                </div>
                <div class="totals-section">
                    <div class="total-row grand-total"><span>الإجمالي النهائي</span><span>${formatCurrency(total)}</span></div>
                    <div class="total-row"><span>المدفوع</span><span>${formatCurrency(invoice.paid || 0)}</span></div>
                    ${due > 0 ? `<div class="total-row"><span style="color:#ef4444;">المتبقي على الحساب</span><span style="color:#ef4444;font-weight:bold;">${formatCurrency(due)}</span></div>` : ''}
                </div>
                <div class="invoice-footer">
                    <div style="font-weight:700;color:#7c2d12;">فاتورة شراء داخلية</div>
                    <div style="font-size:0.65rem;color:#94a3b8;">نظام Elhelw</div>
                </div>
            </div>
            <script>window.onload=function(){window.print();setTimeout(function(){window.close();},1000);}<\/script>
        </body>
        </html>
    `;
}

function printPurchaseInvoiceReceipt(invoice) {
    const w = window.open('', '_blank');
    w.document.write(buildPurchaseInvoiceReceiptHTML(invoice));
    w.document.close();
}

// ==================== توليد المعرف ====================
function generateId() {
    return Date.now();
}

// ==================== التحقق من البيانات ====================
function validateProduct(product) {
    if(!product.name || product.name.trim() === '') {
        showNotification('اسم المنتج مطلوب ❌', 'error');
        return false;
    }
    if(!product.price || product.price <= 0) {
        showNotification('سعر البيع يجب أن يكون أكبر من صفر ❌', 'error');
        return false;
    }
    return true;
}

// ==================== تأثير الجليتش ====================
function applyGlitchEffect(element) {
    element.classList.add('glitch');
    setTimeout(() => element.classList.remove('glitch'), 300);
}

// ==================== تأثير النبض ====================
function applyPulseEffect(element) {
    if(!element) return;
    element.classList.add('pulse-animation');
    setTimeout(() => {
        if(element) element.classList.remove('pulse-animation');
    }, 2000);
}

// ==================== الكونفيتي ====================
function showConfetti() {
    const colors = ['#e6c942', '#dc2626', '#1a1a1a', '#000000', '#fbbf24', '#ef4444', '#d4a81e'];
    
    for(let i = 0; i < 80; i++) {
        const confetti = document.createElement('div');
        confetti.style.cssText = `
            position: fixed;
            top: -50px;
            left: ${Math.random() * 100}%;
            width: ${Math.random() * 10 + 8}px;
            height: ${Math.random() * 10 + 8}px;
            background: ${colors[Math.floor(Math.random() * colors.length)]};
            border-radius: ${Math.random() > 0.5 ? '50%' : '2px'};
            z-index: 99999;
            pointer-events: none;
            animation: confettiFall ${Math.random() * 2 + 2}s ease-in forwards;
            animation-delay: ${Math.random() * 0.5}s;
            transform: rotate(${Math.random() * 360}deg);
        `;
        document.body.appendChild(confetti);
        
        setTimeout(() => confetti.remove(), 3000);
    }
    
    if(!document.getElementById('confettiStyle')) {
        const style = document.createElement('style');
        style.id = 'confettiStyle';
        style.textContent = `
            @keyframes confettiFall {
                0% { transform: translateY(0) rotate(0deg) scale(1); opacity: 1; }
                100% { transform: translateY(100vh) rotate(720deg) scale(0.3); opacity: 0; }
            }
        `;
        document.head.appendChild(style);
    }
}