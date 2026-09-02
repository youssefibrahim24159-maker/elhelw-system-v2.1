let currentInvoices = [];
let invoiceToDelete = null;
let currentInvoiceToPrint = null;

document.addEventListener('DOMContentLoaded', () => {
    loadInvoices();
    document.getElementById('invSearch').addEventListener('input', filterInvoices);
    document.getElementById('invDateFrom').addEventListener('change', filterInvoices);
    document.getElementById('invDateTo').addEventListener('change', filterInvoices);
    document.getElementById('invFilterStatus').addEventListener('change', filterInvoices);
    document.getElementById('invFilterPayment').addEventListener('change', filterInvoices);
});

// توحيد طريقة الدفع لعرض عربي دايمًا (مخزّنة إنجليزي جوه قاعدة البيانات)
function normalizePaymentMethod(method) {
    if(method === 'cash') return 'كاش';
    if(method === 'credit') return 'آجل';
    if(method === 'visa') return 'فيزا';
    return method || '-';
}

async function loadInvoices() {
    currentInvoices = await getAllInvoices();
    currentInvoices.forEach(inv => { inv.paymentMethod = normalizePaymentMethod(inv.paymentMethod); });
    renderInvoices(currentInvoices);
}

function renderInvoices(invoicesToRender) {
    const tableBody = document.getElementById('invoicesTableBody');
    const totalsRow = document.getElementById('invoicesTotals');
    const countBadge = document.getElementById('invCount');
    
    tableBody.innerHTML = '';
    
    if (!invoicesToRender || invoicesToRender.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="9" class="text-center text-muted py-4">📋 لا توجد فواتير مطابقة</td></tr>';
        totalsRow.innerHTML = '<td colspan="9" class="text-center text-muted">لا توجد بيانات</td>';
        countBadge.textContent = '0';
        return;
    }

    countBadge.textContent = invoicesToRender.length;
    let totalAmount = 0, totalPaid = 0, totalRemaining = 0;

    invoicesToRender.forEach(inv => {
        totalAmount += Number(inv.total || inv.grandTotal || 0);
        totalPaid += Number(inv.paid || 0);
        totalRemaining += Number(inv.remaining || inv.due || 0);

        let statusClass = '';
        if (inv.status === 'مدفوع') statusClass = 'bg-success';
        else statusClass = 'bg-danger';

        let displayDate = inv.dateFormatted || inv.date || '-';

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td class="fw-bold">#${inv.id}</td>
            <td>${displayDate}</td>
            <td><strong>${inv.customerName || 'عميل نقدي'}</strong></td>
            <td><span class="badge bg-dark">${inv.paymentMethod || '-'}</span></td>
            <td class="fw-bold text-warning">${formatCurrency(inv.total || inv.grandTotal || 0)}</td>
            <td class="text-success fw-bold">${formatCurrency(inv.paid || 0)}</td>
            <td class="text-danger fw-bold">${formatCurrency(inv.remaining || inv.due || 0)}</td>
            <td><span class="badge ${statusClass}">${inv.status || '-'}</span></td>
            <td>
                <div class="action-buttons">
                    <button class="btn btn-sm btn-outline-info" onclick="viewInvoice('${inv.id}')"><i class="fas fa-eye"></i></button>
                    <button class="btn btn-sm btn-outline-danger" onclick="deleteInvoice('${inv.id}')"><i class="fas fa-trash"></i></button>
                </div>
            </td>
        `;
        tableBody.appendChild(tr);
    });

    totalsRow.innerHTML = `
        <td colspan="4" class="text-end fw-bold">💰 الإجمالي:</td>
        <td class="text-warning fw-bold">${formatCurrency(totalAmount)}</td>
        <td class="text-success fw-bold">${formatCurrency(totalPaid)}</td>
        <td class="text-danger fw-bold">${formatCurrency(totalRemaining)}</td>
        <td colspan="2"></td>
    `;
}

async function filterInvoices() {
    const searchTerm = document.getElementById('invSearch').value.trim().toLowerCase();
    const dateFrom = document.getElementById('invDateFrom').value;
    const dateTo = document.getElementById('invDateTo').value;
    const status = document.getElementById('invFilterStatus').value.trim();
    const payment = document.getElementById('invFilterPayment').value.trim();
    
    const all = await getAllInvoices();
    all.forEach(inv => { inv.paymentMethod = normalizePaymentMethod(inv.paymentMethod); });

    const filtered = all.filter(inv => {
        let match = true;
        
        if(searchTerm) {
            const invId = String(inv.id || '').toLowerCase();
            const custName = (inv.customerName || 'عميل نقدي').toLowerCase();
            if(!invId.includes(searchTerm) && !custName.includes(searchTerm)) {
                match = false;
            }
        }
        
        if(dateFrom && match) {
            if(new Date(inv.date || inv.id) < new Date(dateFrom)) match = false;
        }
        
        if(dateTo && match) {
            if(new Date(inv.date || inv.id) > new Date(dateTo + 'T23:59:59')) match = false;
        }
        
        if(status && match) {
            if((inv.status || '').trim() !== status) match = false;
        }
        
        if(payment && match) {
            if((inv.paymentMethod || '').trim() !== payment) match = false;
        }
        
        return match;
    });
    
    currentInvoices = filtered;
    renderInvoices(currentInvoices);
}

async function viewInvoice(id) {
    const invoices = await getAllInvoices();
    const inv = invoices.find(i => i.id == id);
    if (!inv) return;
    inv.paymentMethod = normalizePaymentMethod(inv.paymentMethod);
    
    currentInvoiceToPrint = inv;

    let itemsHtml = '';
    if (inv.items && inv.items.length > 0) {
        inv.items.forEach((item, index) => {
            itemsHtml += `
                <tr>
                    <td>${index + 1}</td>
                    <td>${item.name}</td>
                    <td>${formatCurrency(item.price)}</td>
                    <td>${item.qty || item.quantity}</td>
                    <td>${formatCurrency((item.price * (item.qty || item.quantity)))}</td>
                </tr>
            `;
        });
    }

    const html = `
        <div id="printArea" class="p-3">
            <div class="text-center mb-4 border-bottom pb-3">
                <h4>🏪 نظام Elhelw للمبيعات</h4>
                <h5>فاتورة رقم: ${inv.id}</h5>
                <p class="text-muted mb-0">التاريخ: ${formatDateTime(inv.date)}</p>
            </div>
            <div class="row mb-4">
                <div class="col-6"><strong>العميل:</strong> ${inv.customerName || 'عميل نقدي'}</div>
                <div class="col-6 text-end"><strong>طريقة الدفع:</strong> ${inv.paymentMethod} | <strong>الحالة:</strong> ${inv.status}</div>
            </div>
            <table class="table table-bordered table-sm">
                <thead class="table-light"><tr><th>م</th><th>الصنف</th><th>السعر</th><th>الكمية</th><th>الإجمالي</th></tr></thead>
                <tbody>${itemsHtml}</tbody>
                <tfoot>
                    <tr><td colspan="4" class="text-end fw-bold">الإجمالي:</td><td class="fw-bold">${formatCurrency(inv.total || inv.grandTotal)}</td></tr>
                    <tr><td colspan="4" class="text-end text-success">المدفوع:</td><td class="text-success">${formatCurrency(inv.paid)}</td></tr>
                    <tr><td colspan="4" class="text-end text-danger">المتبقي:</td><td class="text-danger">${formatCurrency(inv.remaining || inv.due)}</td></tr>
                </tfoot>
            </table>
        </div>
    `;

    document.getElementById('invoiceDetailContent').innerHTML = html;
    new bootstrap.Modal(document.getElementById('invoiceDetailModal')).show();
}

function printCurrentInvoice() {
    if (!currentInvoiceToPrint) return;
    const inv = currentInvoiceToPrint;
    printInvoiceReceipt({
        id: inv.id,
        date: formatDateTime(inv.date),
        customerName: inv.customerName,
        items: inv.items || [],
        grandTotal: inv.total || inv.grandTotal || 0,
        paid: inv.paid || 0,
        due: inv.remaining || inv.due || 0,
        paymentMethod: inv.paymentMethod
    });
}

function deleteInvoice(id) {
    invoiceToDelete = id;
    document.getElementById('deleteInvoiceId').value = id;
    new bootstrap.Modal(document.getElementById('deleteConfirmModal')).show();
}

async function confirmDeleteInvoice() {
    if (!invoiceToDelete) return;
    const inv = await deleteInvoiceById(invoiceToDelete);
    if (!inv) return;

    const modalEl = document.getElementById('deleteConfirmModal');
    const modal = bootstrap.Modal.getInstance(modalEl);
    if(modal) modal.hide();
    
    showNotification('تم حذف الفاتورة بنجاح 🗑️', 'success');
    loadInvoices();
}

function exportInvoices() {
    if (!currentInvoices || currentInvoices.length === 0) {
        showNotification('لا توجد بيانات للتصدير', 'error');
        return;
    }
    const exportData = currentInvoices.map(inv => ({
        'رقم الفاتورة': inv.id,
        'التاريخ': formatDate(inv.date),
        'العميل': inv.customerName || 'عميل نقدي',
        'طريقة الدفع': inv.paymentMethod,
        'الإجمالي': inv.total || inv.grandTotal,
        'المدفوع': inv.paid,
        'المتبقي': inv.remaining || inv.due,
        'الحالة': inv.status
    }));
    exportToExcel(exportData, 'Invoices');
}
