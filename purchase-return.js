// ==================== الشريط الجانبي ====================
function toggleSidebar() {
    document.getElementById('sidebar').classList.toggle('open');
    document.querySelector('.sidebar-overlay').classList.toggle('active');
}
function closeSidebar() {
    document.getElementById('sidebar').classList.remove('open');
    document.querySelector('.sidebar-overlay').classList.remove('active');
}

// ==================== تحميل القوائم ====================
async function loadPrSelects() {
    const supplierSelect = document.getElementById('prSupplier');
    const suppliers = await getAllSuppliers();
    supplierSelect.innerHTML = suppliers.length
        ? suppliers.map(s => `<option value="${s.id}">${s.name}</option>`).join('')
        : '<option value="">لا يوجد موردين - أضف مورد أولاً</option>';

    const productSelect = document.getElementById('prProduct');
    const products = await getAllProducts();
    productSelect.innerHTML = products.length
        ? products.map(p => `<option value="${p.id}">${p.name} (${p.branch || 'الرئيسي'} - المتوفر: ${p.stock || 0})</option>`).join('')
        : '<option value="">لا توجد منتجات</option>';

    onPrProductChange();
}

async function onPrProductChange() {
    const productId = document.getElementById('prProduct').value;
    const products = await getAllProducts();
    const product = products.find(p => p.id == productId);
    const qtyInput = document.getElementById('prQuantity');
    const costInput = document.getElementById('prCost');
    const hint = document.getElementById('prStockHint');

    if(product) {
        costInput.value = product.cost;
        qtyInput.max = product.stock || 0;
        hint.textContent = 'المتوفر بالمخزون: ' + (product.stock || 0);
    } else {
        costInput.value = '';
        qtyInput.max = '';
        hint.textContent = '';
    }
    updatePrTotalPreview();
}

function updatePrTotalPreview() {
    const qty = parseFloat(document.getElementById('prQuantity').value) || 0;
    const cost = parseFloat(document.getElementById('prCost').value) || 0;
    document.getElementById('prTotalPreview').value = formatCurrency(qty * cost);
}

// ==================== تنفيذ المرتجع ====================
async function submitPurchaseReturn() {
    const supplierId = document.getElementById('prSupplier').value;
    const productId = document.getElementById('prProduct').value;
    const quantity = parseInt(document.getElementById('prQuantity').value);
    const cost = parseFloat(document.getElementById('prCost').value);
    const reason = document.getElementById('prReason').value.trim();

    if(!supplierId) { showNotification('اختر المورد ❌', 'error'); return; }
    if(!productId) { showNotification('اختر المنتج ❌', 'error'); return; }
    if(!quantity || quantity <= 0) { showNotification('أدخل كمية صحيحة ❌', 'error'); return; }
    if(!cost || cost < 0) { showNotification('أدخل سعر شراء صحيح ❌', 'error'); return; }

    const products = await getAllProducts();
    const product = products.find(p => p.id == productId);
    if(product && quantity > (product.stock || 0)) {
        showNotification('الكمية أكبر من المتوفر بالمخزون (' + (product.stock || 0) + ') ❌', 'error');
        return;
    }

    const suppliers = await getAllSuppliers();
    const supplier = suppliers.find(s => s.id == supplierId);

    await addPurchaseReturn({
        supplierId: supplierId,
        supplierName: supplier ? supplier.name : '-',
        productId: productId,
        productName: product ? product.name : '-',
        quantity: quantity,
        cost: cost,
        reason: reason
    });

    showNotification('تم تنفيذ مرتجع الشراء وتحديث المخزون ورصيد المورد 🎉', 'success');

    document.getElementById('prQuantity').value = '';
    document.getElementById('prReason').value = '';

    loadPrSelects();
    renderPurchaseReturnsLog();
}

// ==================== سجل المرتجعات ====================
async function renderPurchaseReturnsLog() {
    const all = await getAllPurchaseReturns();
    const list = all.sort((a, b) => new Date(b.date) - new Date(a.date));
    const tbody = document.getElementById('purchaseReturnsTableBody');
    const countBadge = document.getElementById('purchaseReturnsCount');
    countBadge.textContent = list.length;

    if(list.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="text-center text-muted py-4">📋 لا توجد مرتجعات بعد</td></tr>';
        return;
    }

    let html = '';
    list.forEach(ret => {
        html += '<tr>';
        html += '<td class="fw-bold">#' + ret.id + '</td>';
        html += '<td>' + ret.supplierName + '</td>';
        html += '<td>' + ret.productName + '</td>';
        html += '<td>' + ret.quantity + '</td>';
        html += '<td>' + (ret.dateFormatted || ret.date) + '</td>';
        html += '<td class="fw-bold text-primary">' + formatCurrency(ret.total) + '</td>';
        html += '<td><button class="btn btn-sm btn-outline-danger" onclick="deletePurchaseReturn(' + ret.id + ')"><i class="fas fa-trash"></i></button></td>';
        html += '</tr>';
    });
    tbody.innerHTML = html;
}

async function deletePurchaseReturn(id) {
    if(confirm('⚠️ سيتم التراجع عن هذا المرتجع (إعادة الكمية للمخزون وتعديل رصيد المورد). هل أنت متأكد؟')) {
        await deletePurchaseReturnById(id);
        showNotification('تم إلغاء المرتجع 🗑️', 'success');
        loadPrSelects();
        renderPurchaseReturnsLog();
    }
}

// ==================== التهيئة ====================
document.addEventListener('DOMContentLoaded', function() {
    loadPrSelects();
    renderPurchaseReturnsLog();
});
