let piCart = [];
let currentPurchaseInvoices = [];
let currentPiToPrint = null;
let lastSavedPiId = null;

// ==================== تحميل القوائم ====================
async function loadPiSelects() {
    const supplierSelect = document.getElementById('piSupplier');
    const suppliers = await getAllSuppliers();
    supplierSelect.innerHTML = suppliers.length
        ? suppliers.map(s => `<option value="${s.id}">${s.name}</option>`).join('')
        : '<option value="">لا يوجد موردين - أضف مورد أولاً من صفحة العملاء والموردين</option>';

    const productSelect = document.getElementById('piProduct');
    const products = await getAllProducts();
    productSelect.innerHTML = products.length
        ? products.map(p => `<option value="${p.id}">${p.name} (${p.branch || 'الرئيسي'} - المتوفر: ${p.stock || 0})</option>`).join('')
        : '<option value="">لا توجد منتجات - أضف منتج أولاً من المخازن</option>';

    onPiProductChange();
}

async function onPiProductChange() {
    const productId = document.getElementById('piProduct').value;
    const products = await getAllProducts();
    const product = products.find(p => p.id == productId);
    const hint = document.getElementById('piStockHint');
    const costInput = document.getElementById('piCost');

    if(product) {
        costInput.value = product.cost || 0;
        hint.textContent = 'المتوفر حاليًا بالمخزون: ' + (product.stock || 0);
    } else {
        costInput.value = '';
        hint.textContent = '';
    }
    updatePiItemPreview();
}

function updatePiItemPreview() {
    const qty = parseFloat(document.getElementById('piQuantity').value) || 0;
    const cost = parseFloat(document.getElementById('piCost').value) || 0;
    document.getElementById('piItemTotalPreview').value = formatCurrency(qty * cost);
}

// ==================== إضافة بالجملة: اختيار من المخزون ====================
let piBulkProducts = [];
let parsedPiImportRows = [];

async function openPiBulkModal() {
    piBulkProducts = await getAllProducts();
    document.getElementById('piBulkSearch').value = '';
    renderPiBulkStockTable(piBulkProducts);

    // ريست تاب الإكسيل
    document.getElementById('piImportFileInput').value = '';
    document.getElementById('piImportPreviewArea').style.display = 'none';
    document.getElementById('piImportErrorArea').style.display = 'none';
    document.getElementById('piBulkImportConfirmBtn').style.display = 'none';
    parsedPiImportRows = [];

    // رجوع لأول تاب
    const firstTabBtn = document.querySelector('#piBulkTabs button');
    bootstrap.Tab.getOrCreateInstance(firstTabBtn).show();
    document.getElementById('piBulkStockAddBtn').style.display = 'inline-block';

    new bootstrap.Modal(document.getElementById('piBulkModal')).show();
}

function renderPiBulkStockTable(products) {
    const tbody = document.getElementById('piBulkStockBody');
    if(products.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" class="text-center text-muted py-3">لا توجد منتجات</td></tr>';
        return;
    }
    tbody.innerHTML = products.map(p => `
        <tr>
            <td class="text-center"><input type="checkbox" class="form-check-input pi-bulk-check" value="${p.id}"></td>
            <td>${p.name} <small class="text-muted">(متوفر: ${p.stock || 0})</small></td>
            <td><input type="number" class="form-control form-control-sm pi-bulk-qty" data-id="${p.id}" value="1" min="1"></td>
            <td><input type="number" class="form-control form-control-sm pi-bulk-cost" data-id="${p.id}" value="${p.cost || 0}" step="0.01" min="0"></td>
        </tr>
    `).join('');
}

function filterPiBulkTable() {
    const term = document.getElementById('piBulkSearch').value.trim().toLowerCase();
    const filtered = term ? piBulkProducts.filter(p => p.name.toLowerCase().includes(term)) : piBulkProducts;
    renderPiBulkStockTable(filtered);
}

function addPiBulkFromStock() {
    const checked = Array.from(document.querySelectorAll('.pi-bulk-check:checked'));
    if(checked.length === 0) { showNotification('اختر صنف واحد على الأقل ❌', 'error'); return; }

    let addedCount = 0;
    checked.forEach(chk => {
        const id = chk.value;
        const product = piBulkProducts.find(p => p.id == id);
        if(!product) return;
        const qty = parseFloat(document.querySelector('.pi-bulk-qty[data-id="' + id + '"]').value) || 0;
        const cost = parseFloat(document.querySelector('.pi-bulk-cost[data-id="' + id + '"]').value) || 0;
        if(qty <= 0) return;

        const existing = piCart.find(i => i.id == id);
        if(existing) {
            existing.qty += qty;
            existing.cost = cost;
            existing.total = existing.qty * existing.cost;
        } else {
            piCart.push({ id: product.id, name: product.name, qty: qty, cost: cost, total: qty * cost });
        }
        addedCount++;
    });

    renderPiCart();
    updatePiTotals();
    bootstrap.Modal.getInstance(document.getElementById('piBulkModal')).hide();
    showNotification('تم إضافة ' + addedCount + ' صنف للفاتورة 🎉', 'success');
}

// ==================== إضافة بالجملة: استيراد من إكسيل ====================
function findPiColumnValue(row, candidates) {
    for(const key of Object.keys(row)) {
        const normalized = key.trim().toLowerCase();
        if(candidates.some(c => normalized === c.toLowerCase())) return row[key];
    }
    return undefined;
}

function handlePiImportFile(event) {
    const file = event.target.files[0];
    const errorArea = document.getElementById('piImportErrorArea');
    const previewArea = document.getElementById('piImportPreviewArea');
    errorArea.style.display = 'none';
    previewArea.style.display = 'none';
    document.getElementById('piBulkImportConfirmBtn').style.display = 'none';
    if(!file) return;

    const reader = new FileReader();
    reader.onload = async function(e) {
        try {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, { type: 'array' });
            const sheet = workbook.Sheets[workbook.SheetNames[0]];
            const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });

            const products = await getAllProducts();

            parsedPiImportRows = rows.map(row => {
                const name = findPiColumnValue(row, ['الاسم', 'name', 'اسم المنتج', 'اسم الصنف', 'الصنف']);
                const barcode = findPiColumnValue(row, ['الباركود', 'barcode', 'رقم الصنف', 'كود الصنف', 'الكود']) || '';
                const qty = parseFloat(findPiColumnValue(row, ['الكمية', 'stock', 'quantity'])) || 0;
                const cost = parseFloat(findPiColumnValue(row, ['سعر الشراء', 'cost'])) || 0;
                if(!name || String(name).trim() === '') return null;

                const nameStr = String(name).trim();
                let match = null;
                if(barcode) match = products.find(p => p.barcode && String(p.barcode).trim() === String(barcode).trim());
                if(!match) match = products.find(p => p.name.trim().toLowerCase() === nameStr.toLowerCase());

                return { name: nameStr, barcode: String(barcode || ''), qty: qty || 1, cost: cost, productId: match ? match.id : null, isNew: !match };
            }).filter(r => r !== null);

            if(parsedPiImportRows.length === 0) {
                errorArea.textContent = 'مفيش صفوف صالحة في الملف - تأكد إن عمود "اسم الصنف" موجود ومليان';
                errorArea.style.display = 'block';
                return;
            }

            const newCount = parsedPiImportRows.filter(r => r.isNew).length;
            document.getElementById('piImportSummary').textContent =
                'هيتم إضافة ' + parsedPiImportRows.length + ' صنف للفاتورة' + (newCount > 0 ? ' (منهم ' + newCount + ' صنف جديد هيتم إنشاؤه في المخزون تلقائيًا)' : '') + '. راجعهم قبل التأكيد:';
            document.getElementById('piImportPreviewBody').innerHTML = parsedPiImportRows.slice(0, 100).map(r =>
                '<tr><td>' + r.name + '</td><td>' + r.qty + '</td><td>' + r.cost + '</td><td>' + (r.isNew ? '<span class="badge bg-warning text-dark">صنف جديد</span>' : '<span class="badge bg-success">موجود بالمخزون</span>') + '</td></tr>'
            ).join('') + (parsedPiImportRows.length > 100 ? '<tr><td colspan="4" class="text-center text-muted">... و' + (parsedPiImportRows.length - 100) + ' صنف تاني</td></tr>' : '');

            previewArea.style.display = 'block';
            document.getElementById('piBulkImportConfirmBtn').style.display = 'inline-block';
        } catch(err) {
            errorArea.textContent = 'حصل خطأ في قراءة الملف: ' + err.message;
            errorArea.style.display = 'block';
        }
    };
    reader.readAsArrayBuffer(file);
}

async function confirmPiImport() {
    if(parsedPiImportRows.length === 0) return;
    const btn = document.getElementById('piBulkImportConfirmBtn');
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جاري الإضافة...';

    // 1) إنشاء الأصناف الجديدة الفعلية في المخزون (قاعدة البيانات) أولًا
    const newRows = parsedPiImportRows.filter(r => r.isNew);
    if(newRows.length > 0) {
        const toCreate = newRows.map(r => ({
            name: r.name, barcode: r.barcode, stock: 0, price: r.cost, cost: r.cost,
            unit: 'قطعة', category: '', branch: 'الفرع الرئيسي', minStock: 10
        }));
        const result = await addProductsBulk(toCreate);
        if(!result.success) {
            showNotification('حصل خطأ أثناء إنشاء الأصناف الجديدة ❌: ' + (result.message || ''), 'error');
            btn.disabled = false;
            btn.innerHTML = '<i class="fas fa-check"></i> تأكيد وإضافة للفاتورة';
            return;
        }
    }

    // 2) إعادة تحميل المنتجات عشان ناخد الـ id بتاع الأصناف الجديدة اللي اتعملت
    const freshProducts = await getAllProducts();
    let addedCount = 0;
    parsedPiImportRows.forEach(r => {
        const product = r.productId
            ? freshProducts.find(p => p.id == r.productId)
            : freshProducts.find(p => p.name.trim().toLowerCase() === r.name.trim().toLowerCase());
        if(!product) return;

        const existing = piCart.find(i => i.id == product.id);
        if(existing) {
            existing.qty += r.qty;
            existing.cost = r.cost;
            existing.total = existing.qty * existing.cost;
        } else {
            piCart.push({ id: product.id, name: product.name, qty: r.qty, cost: r.cost, total: r.qty * r.cost });
        }
        addedCount++;
    });

    renderPiCart();
    updatePiTotals();

    btn.disabled = false;
    btn.innerHTML = '<i class="fas fa-check"></i> تأكيد وإضافة للفاتورة';
    bootstrap.Modal.getInstance(document.getElementById('piBulkModal')).hide();
    showNotification('تم إضافة ' + addedCount + ' صنف للفاتورة من ملف الإكسيل 🎉', 'success');
}

// ==================== سلة الفاتورة ====================
async function addPiItem() {
    const productId = document.getElementById('piProduct').value;
    const qty = parseInt(document.getElementById('piQuantity').value);
    const cost = parseFloat(document.getElementById('piCost').value);

    if(!productId) { showNotification('اختر منتج ❌', 'error'); return; }
    if(!qty || qty <= 0) { showNotification('أدخل كمية صحيحة ❌', 'error'); return; }
    if(cost === null || isNaN(cost) || cost < 0) { showNotification('أدخل سعر شراء صحيح ❌', 'error'); return; }

    const products = await getAllProducts();
    const product = products.find(p => p.id == productId);
    if(!product) return;

    const existing = piCart.find(i => i.id == productId);
    if(existing) {
        existing.qty += qty;
        existing.cost = cost;
        existing.total = existing.qty * existing.cost;
    } else {
        piCart.push({ id: product.id, name: product.name, qty: qty, cost: cost, total: qty * cost });
    }

    renderPiCart();
    updatePiTotals();

    document.getElementById('piQuantity').value = 1;
    updatePiItemPreview();
}

function removePiItem(index) {
    piCart.splice(index, 1);
    renderPiCart();
    updatePiTotals();
}

function renderPiCart() {
    const tbody = document.getElementById('piCartItems');
    if(piCart.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="text-center text-muted py-3">🧾 لسه مفيش أصناف مضافة</td></tr>';
        return;
    }
    let html = '';
    piCart.forEach((item, index) => {
        html += '<tr>';
        html += '<td>' + item.name + '</td>';
        html += '<td>' + item.qty + '</td>';
        html += '<td>' + formatCurrency(item.cost) + '</td>';
        html += '<td class="fw-bold">' + formatCurrency(item.total) + '</td>';
        html += '<td><button class="btn btn-sm btn-outline-danger" onclick="removePiItem(' + index + ')"><i class="fas fa-trash"></i></button></td>';
        html += '</tr>';
    });
    tbody.innerHTML = html;
}

function updatePiTotals() {
    const total = piCart.reduce((sum, i) => sum + i.total, 0);
    let paid = parseFloat(document.getElementById('piPaid').value) || 0;
    if(paid > total) {
        paid = total;
        document.getElementById('piPaid').value = paid;
    }
    const due = Math.max(0, total - paid);
    document.getElementById('piGrandTotal').value = formatCurrency(total);
    document.getElementById('piDue').value = formatCurrency(due);
}

function clearPiCart() {
    piCart = [];
    renderPiCart();
    document.getElementById('piPaid').value = 0;
    updatePiTotals();
}

// ==================== حفظ الفاتورة ====================
async function submitPurchaseInvoice() {
    const supplierId = document.getElementById('piSupplier').value;
    const paymentMethod = document.getElementById('piPaymentMethod').value;
    const paid = parseFloat(document.getElementById('piPaid').value) || 0;

    if(!supplierId) { showNotification('اختر المورد ❌', 'error'); return; }
    if(piCart.length === 0) { showNotification('أضف صنف واحد على الأقل للفاتورة ❌', 'error'); return; }

    const suppliers = await getAllSuppliers();
    const supplier = suppliers.find(s => s.id == supplierId);
    const total = piCart.reduce((sum, i) => sum + i.total, 0);
    const due = Math.max(0, total - paid);
    const status = due > 0 ? 'غير مدفوع بالكامل' : 'مدفوع';

    const result = await addPurchaseInvoice({
        supplierId: supplierId,
        supplierName: supplier ? supplier.name : '-',
        items: piCart.map(i => ({ id: i.id, name: i.name, qty: i.qty, cost: i.cost, total: i.total })),
        total: total,
        paid: paid,
        due: due,
        paymentMethod: paymentMethod,
        status: status
    });

    if(!result) { showNotification('حصل خطأ أثناء حفظ الفاتورة ❌', 'error'); return; }

    lastSavedPiId = result.id;
    showNotification('تم حفظ فاتورة الشراء وتحديث المخزون ورصيد المورد 🎉', 'success');
    if(typeof showConfetti === 'function') showConfetti();

    clearPiCart();
    loadPiSelects();
    await renderPurchaseInvoicesLog();

    if(confirm('تم الحفظ ✅ - عايز تطبع الفاتورة دلوقتي؟')) {
        printPurchaseInvoiceById(result.id);
    }
}

// ==================== سجل فواتير الشراء ====================
async function renderPurchaseInvoicesLog() {
    currentPurchaseInvoices = (await getAllPurchaseInvoices()).sort((a, b) => new Date(b.date) - new Date(a.date));
    const tbody = document.getElementById('purchaseInvoicesTableBody');
    const countBadge = document.getElementById('purchaseInvoicesCount');
    countBadge.textContent = currentPurchaseInvoices.length;

    if(currentPurchaseInvoices.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" class="text-center text-muted py-4">📋 لا توجد فواتير شراء بعد</td></tr>';
        return;
    }

    let html = '';
    currentPurchaseInvoices.forEach(inv => {
        html += '<tr>';
        html += '<td class="fw-bold">#' + inv.id + '</td>';
        html += '<td>' + (inv.supplierName || '-') + '</td>';
        html += '<td>' + (inv.dateFormatted || inv.date) + '</td>';
        html += '<td>' + (inv.items ? inv.items.length : 0) + '</td>';
        html += '<td class="fw-bold text-warning">' + formatCurrency(inv.total) + '</td>';
        html += '<td class="text-success fw-bold">' + formatCurrency(inv.paid) + '</td>';
        html += '<td class="text-danger fw-bold">' + formatCurrency(inv.due) + '</td>';
        html += '<td><div class="action-buttons">';
        html += '<button class="btn btn-sm btn-outline-info" onclick="viewPurchaseInvoice(' + inv.id + ')"><i class="fas fa-eye"></i></button>';
        html += '<button class="btn btn-sm btn-outline-primary" onclick="printPurchaseInvoiceById(' + inv.id + ')"><i class="fas fa-print"></i></button>';
        html += '<button class="btn btn-sm btn-outline-danger" onclick="deletePurchaseInvoice(' + inv.id + ')"><i class="fas fa-trash"></i></button>';
        html += '</div></td>';
        html += '</tr>';
    });
    tbody.innerHTML = html;
}

function viewPurchaseInvoice(id) {
    const inv = currentPurchaseInvoices.find(i => i.id == id);
    if(!inv) return;
    currentPiToPrint = inv;

    let itemsHtml = '';
    (inv.items || []).forEach((item, index) => {
        itemsHtml += `
            <tr>
                <td>${index + 1}</td>
                <td>${item.name}</td>
                <td>${formatCurrency(item.cost)}</td>
                <td>${item.qty}</td>
                <td>${formatCurrency(item.total)}</td>
            </tr>
        `;
    });

    const html = `
        <div class="p-3">
            <div class="text-center mb-4 border-bottom pb-3">
                <h4>🏪 نظام Elhelw للمبيعات</h4>
                <h5>فاتورة شراء رقم: ${inv.id}</h5>
                <p class="text-muted mb-0">التاريخ: ${inv.dateFormatted || inv.date}</p>
            </div>
            <div class="row mb-4">
                <div class="col-6"><strong>المورد:</strong> ${inv.supplierName || '-'}</div>
                <div class="col-6 text-end"><strong>طريقة الدفع:</strong> ${inv.paymentMethod || '-'} | <strong>الحالة:</strong> ${inv.status || '-'}</div>
            </div>
            <table class="table table-bordered table-sm">
                <thead class="table-light"><tr><th>م</th><th>الصنف</th><th>سعر الشراء</th><th>الكمية</th><th>الإجمالي</th></tr></thead>
                <tbody>${itemsHtml}</tbody>
                <tfoot>
                    <tr><td colspan="4" class="text-end fw-bold">الإجمالي:</td><td class="fw-bold">${formatCurrency(inv.total)}</td></tr>
                    <tr><td colspan="4" class="text-end text-success">المدفوع:</td><td class="text-success">${formatCurrency(inv.paid)}</td></tr>
                    <tr><td colspan="4" class="text-end text-danger">المتبقي:</td><td class="text-danger">${formatCurrency(inv.due)}</td></tr>
                </tfoot>
            </table>
        </div>
    `;

    document.getElementById('piDetailContent').innerHTML = html;
    new bootstrap.Modal(document.getElementById('piDetailModal')).show();
}

function printCurrentPurchaseInvoice() {
    if(!currentPiToPrint) return;
    printPurchaseInvoiceReceipt({
        id: currentPiToPrint.id,
        date: currentPiToPrint.dateFormatted || formatDateTime(currentPiToPrint.date),
        supplierName: currentPiToPrint.supplierName,
        items: currentPiToPrint.items || [],
        total: currentPiToPrint.total || 0,
        paid: currentPiToPrint.paid || 0,
        due: currentPiToPrint.due || 0,
        paymentMethod: currentPiToPrint.paymentMethod
    });
}

async function printPurchaseInvoiceById(id) {
    let inv = currentPurchaseInvoices.find(i => i.id == id);
    if(!inv) {
        currentPurchaseInvoices = await getAllPurchaseInvoices();
        inv = currentPurchaseInvoices.find(i => i.id == id);
    }
    if(!inv) return;
    currentPiToPrint = inv;
    printCurrentPurchaseInvoice();
}

async function deletePurchaseInvoice(id) {
    if(!confirm('⚠️ سيتم التراجع عن هذه الفاتورة (خصم الكميات من المخزون وتعديل رصيد المورد). هل أنت متأكد؟')) return;
    const inv = await deletePurchaseInvoiceById(id);
    if(!inv) { showNotification('حصل خطأ أثناء الحذف ❌', 'error'); return; }
    showNotification('تم حذف فاتورة الشراء 🗑️', 'success');
    loadPiSelects();
    renderPurchaseInvoicesLog();
}

// ==================== تصدير Excel ====================
function exportPurchaseInvoices() {
    if(!currentPurchaseInvoices || currentPurchaseInvoices.length === 0) {
        showNotification('لا توجد بيانات للتصدير', 'error');
        return;
    }
    const exportData = currentPurchaseInvoices.map(inv => ({
        'رقم الفاتورة': inv.id,
        'التاريخ': formatDate(inv.date),
        'المورد': inv.supplierName || '-',
        'طريقة الدفع': inv.paymentMethod,
        'الإجمالي': inv.total,
        'المدفوع': inv.paid,
        'المتبقي': inv.due,
        'الحالة': inv.status
    }));
    exportToExcel(exportData, 'فواتير الشراء');
}

// ==================== التهيئة ====================
document.addEventListener('DOMContentLoaded', function() {
    loadPiSelects();
    renderPurchaseInvoicesLog();
    document.getElementById('piPaid').addEventListener('input', updatePiTotals);
});
