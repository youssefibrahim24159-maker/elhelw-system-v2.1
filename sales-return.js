// ==================== الشريط الجانبي ====================
function toggleSidebar() {
    document.getElementById('sidebar').classList.toggle('open');
    document.querySelector('.sidebar-overlay').classList.toggle('active');
}
function closeSidebar() {
    document.getElementById('sidebar').classList.remove('open');
    document.querySelector('.sidebar-overlay').classList.remove('active');
}

let selectedInvoice = null;

// ==================== البحث عن فاتورة ====================
async function searchInvoiceForReturn() {
    const query = document.getElementById('invoiceSearchInput').value.trim().toLowerCase();
    const resultsDiv = document.getElementById('invoiceSearchResults');
    if(query === '') { resultsDiv.innerHTML = ''; return; }

    const allInvoices = await getAllInvoices();
    const invoices = allInvoices.filter(inv => {
        const invId = String(inv.id || '').toLowerCase();
        const custName = (inv.customerName || 'عميل نقدي').toLowerCase();
        return invId.includes(query) || custName.includes(query);
    }).sort((a, b) => new Date(b.date || b.id) - new Date(a.date || a.id));

    if(invoices.length === 0) {
        resultsDiv.innerHTML = '<div class="alert alert-warning text-center py-2">❌ لا توجد فواتير مطابقة</div>';
        return;
    }

    let html = '';
    invoices.slice(0, 20).forEach(inv => {
        html += '<div class="product-search-result mb-2" onclick="selectInvoiceForReturn(\'' + inv.id + '\')" style="cursor:pointer;">';
        html += '<div class="d-flex justify-content-between align-items-center">';
        html += '<div><strong>فاتورة #' + inv.id + '</strong><br><small class="text-muted">' + (inv.customerName || 'عميل نقدي') + '</small></div>';
        html += '<div class="text-end"><strong class="text-warning">' + formatCurrency(inv.total || inv.grandTotal || 0) + '</strong><br><small class="text-muted">' + (inv.dateFormatted || inv.date || '-') + '</small></div>';
        html += '</div></div>';
    });
    resultsDiv.innerHTML = html;
}

document.getElementById('invoiceSearchInput')?.addEventListener('keypress', function(e) {
    if(e.key === 'Enter') { e.preventDefault(); searchInvoiceForReturn(); }
});

// ==================== اختيار فاتورة ====================
async function selectInvoiceForReturn(id) {
    const invoices = await getAllInvoices();
    const invoice = invoices.find(i => i.id == id);
    if(!invoice) return;
    selectedInvoice = invoice;

    document.getElementById('invoiceSearchResults').innerHTML = '';
    document.getElementById('invoiceSearchInput').value = '';
    document.getElementById('selInvId').textContent = invoice.id;
    document.getElementById('selInvCustomer').textContent = invoice.customerName || 'عميل نقدي';
    document.getElementById('selInvDate').textContent = invoice.dateFormatted || invoice.date || '-';
    document.getElementById('selectedInvoiceCard').style.display = 'block';

    renderReturnItems(invoice);
}

async function renderReturnItems(invoice) {
    const tbody = document.getElementById('returnItemsBody');
    let html = '';
    for(const item of (invoice.items || [])) {
        const soldQty = Number(item.qty || item.quantity || 0);
        const alreadyReturned = await getReturnedQtyForInvoiceItem(invoice.id, item.id);
        const available = Math.max(0, soldQty - alreadyReturned);
        html += '<tr data-id="' + item.id + '" data-name="' + item.name + '" data-price="' + item.price + '" data-max="' + available + '">';
        html += '<td><strong>' + item.name + '</strong></td>';
        html += '<td>' + formatCurrency(item.price) + '</td>';
        html += '<td>' + soldQty + '</td>';
        html += '<td>' + alreadyReturned + '</td>';
        html += '<td class="fw-bold ' + (available === 0 ? 'text-muted' : 'text-success') + '">' + available + '</td>';
        html += '<td><input type="number" class="form-control form-control-sm return-qty-input" min="0" max="' + available + '" value="0" ' + (available === 0 ? 'disabled' : '') + ' onchange="clampReturnQty(this)" oninput="updateReturnTotalPreview()"></td>';
        html += '</tr>';
    }
    tbody.innerHTML = html || '<tr><td colspan="6" class="text-center text-muted py-3">لا توجد أصناف في هذه الفاتورة</td></tr>';
    updateReturnTotalPreview();
}

function clampReturnQty(input) {
    const max = parseInt(input.max) || 0;
    let val = parseInt(input.value) || 0;
    if(val < 0) val = 0;
    if(val > max) { val = max; showNotification('الكمية القصوى المتاحة للإرجاع: ' + max, 'error'); }
    input.value = val;
    updateReturnTotalPreview();
}

function updateReturnTotalPreview() {
    let total = 0;
    document.querySelectorAll('#returnItemsBody tr').forEach(row => {
        const price = parseFloat(row.dataset.price) || 0;
        const input = row.querySelector('.return-qty-input');
        const qty = input ? (parseInt(input.value) || 0) : 0;
        total += price * qty;
    });
    document.getElementById('returnTotalPreview').textContent = formatCurrency(total);
}

// ==================== تنفيذ المرتجع ====================
async function submitSalesReturn() {
    if(!selectedInvoice) return;

    const items = [];
    document.querySelectorAll('#returnItemsBody tr').forEach(row => {
        const input = row.querySelector('.return-qty-input');
        const qty = input ? (parseInt(input.value) || 0) : 0;
        if(qty > 0) {
            items.push({
                id: parseInt(row.dataset.id) || row.dataset.id,
                name: row.dataset.name,
                price: parseFloat(row.dataset.price),
                quantity: qty
            });
        }
    });

    if(items.length === 0) {
        showNotification('حدد كمية صنف واحد على الأقل للإرجاع ❌', 'error');
        return;
    }

    const returnObj = {
        invoiceId: selectedInvoice.id,
        customerId: selectedInvoice.customerId || null,
        customerName: selectedInvoice.customerName || 'عميل نقدي',
        items: items,
        reason: document.getElementById('returnReason').value.trim()
    };

    const result = await addSalesReturn(returnObj);
    if(!result || result.error) {
        showNotification((result && result.message) || 'حصل خطأ أثناء تنفيذ المرتجع ❌', 'error');
        return;
    }
    showNotification('تم تنفيذ المرتجع وتحديث المخزون ورصيد العميل 🎉', 'success');

    document.getElementById('selectedInvoiceCard').style.display = 'none';
    document.getElementById('returnReason').value = '';
    selectedInvoice = null;

    renderSalesReturnsLog();
}

// ==================== سجل المرتجعات ====================
async function renderSalesReturnsLog() {
    const all = await getAllSalesReturns();
    const list = all.sort((a, b) => new Date(b.date) - new Date(a.date));
    const tbody = document.getElementById('salesReturnsTableBody');
    const countBadge = document.getElementById('salesReturnsCount');
    countBadge.textContent = list.length;

    if(list.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted py-4">📋 لا توجد مرتجعات بعد</td></tr>';
        return;
    }

    let html = '';
    list.forEach(ret => {
        html += '<tr>';
        html += '<td class="fw-bold">#' + ret.id + '</td>';
        html += '<td>#' + ret.invoiceId + '</td>';
        html += '<td>' + (ret.customerName || 'عميل نقدي') + '</td>';
        html += '<td>' + (ret.dateFormatted || ret.date) + '</td>';
        html += '<td class="fw-bold text-danger">' + formatCurrency(ret.total) + '</td>';
        html += '<td><button class="btn btn-sm btn-outline-danger" onclick="deleteSalesReturn(' + ret.id + ')"><i class="fas fa-trash"></i></button></td>';
        html += '</tr>';
    });
    tbody.innerHTML = html;
}

async function deleteSalesReturn(id) {
    if(confirm('⚠️ سيتم التراجع عن هذا المرتجع (سحب الكمية من المخزون وتعديل رصيد العميل). هل أنت متأكد؟')) {
        await deleteSalesReturnById(id);
        showNotification('تم إلغاء المرتجع 🗑️', 'success');
        renderSalesReturnsLog();
    }
}

// ==================== التهيئة ====================
document.addEventListener('DOMContentLoaded', renderSalesReturnsLog);
