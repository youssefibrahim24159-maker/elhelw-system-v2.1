// ==================== عرض العملاء ====================
async function renderCustomers() {
    const customers = await getAllCustomers();
    renderFilteredCustomers(customers);
    updateStats();
}

// ==================== تحديث الإحصائيات ====================
async function updateStats() {
    const customers = await getAllCustomers();
    const suppliers = await getAllSuppliers();
    
    const totalCustomersCount = document.getElementById('totalCustomersCount');
    if(totalCustomersCount) totalCustomersCount.textContent = customers.length;
    
    const debtors = customers.filter(c => c.balance > 0);
    const totalDebtors = document.getElementById('totalDebtors');
    if(totalDebtors) totalDebtors.textContent = debtors.length;
    
    const totalDebt = debtors.reduce((sum, c) => sum + c.balance, 0);
    const totalDebtAmount = document.getElementById('totalDebtAmount');
    if(totalDebtAmount) totalDebtAmount.textContent = formatCurrency(totalDebt);
    
    const totalSuppliersCount = document.getElementById('totalSuppliersCount');
    if(totalSuppliersCount) totalSuppliersCount.textContent = suppliers.length;
}

// ==================== فلترة العملاء ====================
async function filterCustomers() {
    const search = document.getElementById('customerSearch')?.value.toLowerCase() || '';
    const filter = document.getElementById('customerFilter')?.value || 'all';
    let customers = await getAllCustomers();
    if(search) customers = customers.filter(c => c.name.toLowerCase().includes(search) || (c.phone && c.phone.includes(search)));
    if(filter === 'debtor') customers = customers.filter(c => c.balance > 0);
    else if(filter === 'creditor') customers = customers.filter(c => c.balance < 0);
    renderFilteredCustomers(customers);
}

function renderFilteredCustomers(customers) {
    const tbody = document.getElementById('customersTableBody');
    const countBadge = document.getElementById('customersCount');
    if(!tbody) return;
    if(countBadge) countBadge.textContent = customers.length;
    if(customers.length === 0) { tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted py-5">🎯 لا يوجد عملاء مطابقين</td></tr>'; return; }
    let html = '';
    customers.forEach((c, i) => {
        const balanceClass = c.balance > 0 ? 'balance-positive' : (c.balance < 0 ? 'balance-negative' : 'balance-zero');
        const balanceText = formatCurrency(Math.abs(c.balance)) + ' ' + (c.balance > 0 ? '(مدين)' : (c.balance < 0 ? '(دائن)' : ''));
        html += '<tr>';
        html += '<td class="text-center fw-bold">' + (i + 1) + '</td>';
        html += '<td><div class="d-flex align-items-center gap-2"><div class="customer-avatar-sm">' + c.name.charAt(0) + '</div><strong>' + c.name + '</strong></div></td>';
        html += '<td><i class="fas fa-phone text-warning me-1"></i>' + (c.phone || '-') + '</td>';
        html += '<td><i class="fas fa-map-marker-alt text-danger me-1"></i>' + (c.address || '-') + '</td>';
        html += '<td><span class="balance-badge ' + balanceClass + '">' + balanceText + '</span></td>';
        html += '<td><div class="action-btns">';
        html += '<button class="btn-action btn-statement" onclick="showCustomerStatement(' + c.id + ')"><i class="fas fa-book"></i> كشف</button>';
        html += '<button class="btn-action btn-edit" onclick="editCustomer(' + c.id + ')"><i class="fas fa-edit"></i></button>';
        html += '<button class="btn-action btn-delete" onclick="deleteCustomer(' + c.id + ')"><i class="fas fa-trash"></i></button>';
        html += '</div></td>';
        html += '</tr>';
    });
    tbody.innerHTML = html;
}

// ==================== إضافة/تعديل عميل ====================
function showCustomerModal() {
    document.getElementById('customerId').value = '';
    document.getElementById('customerName').value = '';
    document.getElementById('customerPhone').value = '';
    document.getElementById('customerAddress').value = '';
    document.getElementById('customerBalance').value = '0';
    new bootstrap.Modal(document.getElementById('customerModal')).show();
}

async function saveCustomer() {
    const id = document.getElementById('customerId').value;
    const customer = {
        name: document.getElementById('customerName').value,
        phone: document.getElementById('customerPhone').value,
        address: document.getElementById('customerAddress').value,
        balance: parseFloat(document.getElementById('customerBalance').value) || 0
    };
    if(!customer.name) { showNotification('الرجاء إدخال اسم العميل ❌', 'error'); return; }
    
    if(id) {
        const ok = await updateCustomer(id, customer);
        if(!ok) { showNotification('حصل خطأ أثناء تحديث العميل ❌', 'error'); return; }
        showNotification('تم تحديث بيانات العميل ✅', 'success');
    } else {
        const ok = await addCustomer(customer);
        if(!ok) { showNotification('حصل خطأ أثناء إضافة العميل ❌', 'error'); return; }
        showNotification('تم إضافة العميل بنجاح 🎉', 'success');
        showConfetti();
    }
    bootstrap.Modal.getInstance(document.getElementById('customerModal')).hide();
    renderCustomers();
    if(typeof loadCustomersToSelects === 'function') loadCustomersToSelects();
}

async function editCustomer(id) {
    const customers = await getAllCustomers();
    const customer = customers.find(c => c.id == id);
    if(customer) {
        document.getElementById('customerId').value = customer.id;
        document.getElementById('customerName').value = customer.name;
        document.getElementById('customerPhone').value = customer.phone || '';
        document.getElementById('customerAddress').value = customer.address || '';
        document.getElementById('customerBalance').value = customer.balance;
        new bootstrap.Modal(document.getElementById('customerModal')).show();
    }
}

async function deleteCustomer(id) {
    const customers = await getAllCustomers();
    const customer = customers.find(c => c.id == id);
    if(customer && customer.balance > 0) {
        if(!confirm('⚠️ هذا العميل عليه رصيد مدين ' + formatCurrency(customer.balance) + '. هل تريد حذفه فعلاً؟')) return;
    } else if(!confirm('⚠️ هل أنت متأكد من حذف هذا العميل؟')) {
        return;
    }
    await deleteCustomerById(id);
    showNotification('تم حذف العميل 🗑️', 'success');
    renderCustomers();
    if(typeof loadCustomersToSelects === 'function') loadCustomersToSelects();
    if(typeof loadCustomersToSelect === 'function') loadCustomersToSelect();
}

// ==================== كشف حساب العميل ====================
async function showCustomerStatement(id) {
    const customers = await getAllCustomers();
    const customer = customers.find(c => c.id == id);
    if(!customer) return;
    const allInvoices = await getAllInvoices();
    const invoices = allInvoices.filter(inv => inv.customerId == id).sort((a, b) => new Date(a.date) - new Date(b.date));
    let balance = customer.balance;
    
    let rowsHtml = '';
    rowsHtml += '<tr><td>-</td><td>الرصيد الافتتاحي</td><td>' + (customer.balance > 0 ? formatCurrency(customer.balance) : '-') + '</td><td>' + (customer.balance < 0 ? formatCurrency(-customer.balance) : '-') + '</td><td>' + formatCurrency(customer.balance) + '</td></tr>';
    
    invoices.forEach(inv => {
        rowsHtml += '<tr><td>' + (inv.dateFormatted || inv.date) + '</td><td>فاتورة رقم #' + inv.id + '</td><td class="text-danger">' + formatCurrency(inv.grandTotal) + '</td><td>-</td><td class="fw-bold">' + formatCurrency(balance) + '</td></tr>';
    });
    
    const printContent = `
        <div class="print-area">
            <div class="print-header">
                <h3>🏪 ${getStoreName()}</h3>
                <h4>كشف حساب عميل</h4>
                <hr style="border-color: #e6c942;">
            </div>
            <div class="row mb-3">
                <div class="col-6"><strong>العميل:</strong> ${customer.name}</div>
                <div class="col-6 text-end"><strong>التاريخ:</strong> ${new Date().toLocaleDateString('ar-EG')}</div>
            </div>
            <div class="row mb-3">
                <div class="col-6"><strong>الهاتف:</strong> ${customer.phone || '-'}</div>
                <div class="col-6 text-end"><strong>العنوان:</strong> ${customer.address || '-'}</div>
            </div>
            <table class="print-table">
                <thead><tr><th>التاريخ</th><th>البيان</th><th>مدين</th><th>دائن</th><th>الرصيد</th></tr></thead>
                <tbody>${rowsHtml}</tbody>
                <tfoot><tr class="print-total-row"><td colspan="4" class="text-end">الرصيد الحالي</td><td>${formatCurrency(balance)}</td></tr></tfoot>
            </table>
            <div class="print-footer">شكراً لتعاملكم معنا - ${getStoreName()} © 2026</div>
        </div>
    `;
    
    const modalHtml = `
        <div class="modal fade" id="statementModal" tabindex="-1">
            <div class="modal-dialog modal-lg modal-dialog-centered">
                <div class="modal-content">
                    <div class="modal-header bg-dark text-warning" style="border-bottom: 2px solid #e6c942;">
                        <h5 class="modal-title"><i class="fas fa-book"></i> كشف حساب: ${customer.name}</h5>
                        <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body" style="max-height: 500px; overflow-y: auto;">
                        ${printContent}
                    </div>
                    <div class="modal-footer">
                        <button class="btn btn-secondary" data-bs-dismiss="modal"><i class="fas fa-times"></i> إغلاق</button>
                        <button class="btn btn-warning" onclick="printStatement()"><i class="fas fa-print"></i> طباعة</button>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    const existingModal = document.getElementById('statementModal');
    if(existingModal) existingModal.remove();
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    new bootstrap.Modal(document.getElementById('statementModal')).show();
    document.getElementById('statementModal').addEventListener('hidden.bs.modal', function() { this.remove(); });
}

function printStatement() {
    const printArea = document.querySelector('#statementModal .print-area');
    if(!printArea) return;
    const win = window.open('', '_blank');
    win.document.write(`
        <!DOCTYPE html>
        <html dir="rtl">
        <head>
            <meta charset="UTF-8">
            <title>كشف حساب</title>
            <style>
                *{margin:0;padding:0;box-sizing:border-box;}
                body{font-family:'Cairo',sans-serif;padding:30px;background:white;}
                .print-header{text-align:center;border-bottom:3px solid #e6c942;padding-bottom:15px;margin-bottom:20px;}
                .print-header h3{font-size:1.5rem;color:#1a1a1a;}
                .print-header h4{color:#737373;margin-top:5px;}
                .print-table{width:100%;border-collapse:collapse;margin:20px 0;}
                .print-table th{background:#1a1a1a;color:#e6c942;padding:12px 10px;border:1px solid #333;}
                .print-table td{padding:10px;border:1px solid #e5e5e5;}
                .print-total-row{background:#fefce8;font-weight:bold;}
                .print-footer{text-align:center;margin-top:30px;padding-top:15px;border-top:1px solid #e5e5e5;font-size:0.8rem;color:#737373;}
                @media print{body{padding:10px;}}
            </style>
        </head>
        <body>${printArea.outerHTML}</body>
        </html>
    `);
    win.document.close();
    setTimeout(() => { win.print(); win.close(); }, 500);
}

// ==================== عرض الموردين ====================
async function renderSuppliers() {
    const suppliers = await getAllSuppliers();
    renderFilteredSuppliers(suppliers);
}

async function filterSuppliers() {
    const search = document.getElementById('supplierSearch')?.value.toLowerCase() || '';
    let suppliers = await getAllSuppliers();
    if(search) suppliers = suppliers.filter(s => s.name.toLowerCase().includes(search) || (s.phone && s.phone.includes(search)));
    renderFilteredSuppliers(suppliers);
}

function renderFilteredSuppliers(suppliers) {
    const tbody = document.getElementById('suppliersTableBody');
    const countBadge = document.getElementById('suppliersCount');
    if(!tbody) return;
    if(countBadge) countBadge.textContent = suppliers.length;
    if(suppliers.length === 0) { tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted py-5">🎯 لا يوجد موردين مطابقين</td></tr>'; return; }
    let html = '';
    suppliers.forEach((s, i) => {
        const balanceClass = s.balance > 0 ? 'balance-positive' : (s.balance < 0 ? 'balance-negative' : 'balance-zero');
        const balanceText = formatCurrency(Math.abs(s.balance)) + ' ' + (s.balance > 0 ? '(عليه)' : (s.balance < 0 ? '(له)' : ''));
        html += '<tr><td class="text-center fw-bold">' + (i + 1) + '</td><td><div class="d-flex align-items-center gap-2"><div class="customer-avatar-sm bg-info text-white">' + s.name.charAt(0) + '</div><strong>' + s.name + '</strong></div></td><td><i class="fas fa-phone text-warning me-1"></i>' + (s.phone || '-') + '</td><td><i class="fas fa-map-marker-alt text-danger me-1"></i>' + (s.address || '-') + '</td><td><span class="balance-badge ' + balanceClass + '">' + balanceText + '</span></td><td><div class="action-btns"><button class="btn-action btn-edit" onclick="editSupplier(' + s.id + ')"><i class="fas fa-edit"></i></button><button class="btn-action btn-delete" onclick="deleteSupplier(' + s.id + ')"><i class="fas fa-trash"></i></button></div></td></tr>';
    });
    tbody.innerHTML = html;
}

function showSupplierModal() {
    document.getElementById('supplierId').value = '';
    document.getElementById('supplierName').value = '';
    document.getElementById('supplierPhone').value = '';
    document.getElementById('supplierAddress').value = '';
    document.getElementById('supplierBalance').value = '0';
    new bootstrap.Modal(document.getElementById('supplierModal')).show();
}

async function saveSupplier() {
    const id = document.getElementById('supplierId').value;
    const supplier = {
        name: document.getElementById('supplierName').value,
        phone: document.getElementById('supplierPhone').value,
        address: document.getElementById('supplierAddress').value,
        balance: parseFloat(document.getElementById('supplierBalance').value) || 0
    };
    if(!supplier.name) { showNotification('الرجاء إدخال اسم المورد ❌', 'error'); return; }
    
    if(id) {
        const ok = await updateSupplier(id, supplier);
        if(!ok) { showNotification('حصل خطأ أثناء تحديث المورد ❌', 'error'); return; }
        showNotification('تم تحديث بيانات المورد ✅', 'success');
    } else {
        const ok = await addSupplier(supplier);
        if(!ok) { showNotification('حصل خطأ أثناء إضافة المورد ❌', 'error'); return; }
        showNotification('تم إضافة المورد بنجاح 🎉', 'success');
    }
    bootstrap.Modal.getInstance(document.getElementById('supplierModal')).hide();
    renderSuppliers();
    updateStats();
}

async function editSupplier(id) {
    const suppliers = await getAllSuppliers();
    const supplier = suppliers.find(s => s.id == id);
    if(supplier) {
        document.getElementById('supplierId').value = supplier.id;
        document.getElementById('supplierName').value = supplier.name;
        document.getElementById('supplierPhone').value = supplier.phone || '';
        document.getElementById('supplierAddress').value = supplier.address || '';
        document.getElementById('supplierBalance').value = supplier.balance;
        new bootstrap.Modal(document.getElementById('supplierModal')).show();
    }
}

async function deleteSupplier(id) {
    if(confirm('⚠️ هل أنت متأكد من حذف هذا المورد؟')) {
        await deleteSupplierById(id);
        showNotification('تم حذف المورد 🗑️', 'success');
        renderSuppliers();
        updateStats();
    }
}

// ==================== التهيئة ====================
document.addEventListener('DOMContentLoaded', function() {
    if(document.getElementById('customersTableBody')) renderCustomers();
    if(document.getElementById('suppliersTableBody')) renderSuppliers();
    updateStats();
});
