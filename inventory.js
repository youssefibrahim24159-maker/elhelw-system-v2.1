// ==================== عرض المنتجات ====================
async function renderInventoryTable() {
    const products = await getAllProducts();
    const tbody = document.getElementById('inventoryTableBody');
    if(!tbody) return;
    
    if(products.length === 0) {
        tbody.innerHTML = '<tr><td colspan="11" class="text-center text-muted py-5">🎯 لا توجد منتجات في المخزن</td></tr>';
        return;
    }
    
    let html = '';
    for(let i = 0; i < products.length; i++) {
        const p = products[i];
        const profit = p.price - p.cost;
        let profitPercent = 0;
        if(p.cost > 0) profitPercent = ((profit / p.cost) * 100).toFixed(1);
        const stockClass = (p.stock || 0) < (p.minStock || 10) ? 'text-danger fw-bold pulse-animation' : '';
        
        html += '<tr class="scale-hover">';
        html += '<td class="text-center fw-bold">' + (i + 1) + '</td>';
        html += '<td class="text-center"><img src="' + (p.image || 'https://via.placeholder.com/40') + '" width="45" height="45" class="rounded shadow-sm" onerror="this.src=\'https://via.placeholder.com/40\'"></td>';
        html += '<td><strong class="gradient-text">' + p.name + '</strong></td>';
        html += '<td><small class="text-muted fw-bold">' + (p.barcode || '-') + '</small></td>';
        html += '<td><span class="badge bg-dark text-warning">' + (p.category || '-') + '</span></td>';
        html += '<td class="' + stockClass + '">' + (p.stock || 0) + '</td>';
        html += '<td class="fw-bold text-warning">' + formatCurrency(p.price) + '</td>';
        html += '<td>' + formatCurrency(p.cost) + '</td>';
        html += '<td class="text-success small fw-bold">' + formatCurrency(profit) + ' (' + profitPercent + '%)</td>';
        html += '<td><span class="badge bg-dark">' + (p.branch || 'الرئيسي') + '</span></td>';
        html += '<td><div class="action-buttons">';
        html += '<button class="btn btn-sm btn-warning rotate-hover" onclick="editProduct(' + p.id + ')" title="تعديل"><i class="fas fa-edit"></i></button>';
        html += '<button class="btn btn-sm btn-danger shake" onclick="deleteProduct(' + p.id + ')" title="حذف"><i class="fas fa-trash"></i></button>';
        html += '<button class="btn btn-sm btn-info text-white glitch" onclick="addStock(' + p.id + ')" title="توريد"><i class="fas fa-plus"></i> توريد</button>';
        html += '</div></td>';
        html += '</tr>';
    }
    tbody.innerHTML = html;
}

// ==================== إضافة/تعديل منتج ====================
function showAddProductModal() {
    document.getElementById('productModalLabel').innerText = '✨ إضافة منتج جديد';
    document.getElementById('productForm').reset();
    document.getElementById('productId').value = '';
    new bootstrap.Modal(document.getElementById('productModal')).show();
}

async function saveProduct() {
    const id = document.getElementById('productId').value;
    const product = {
        name: document.getElementById('productName').value,
        barcode: document.getElementById('productBarcode').value,
        stock: parseInt(document.getElementById('productStock').value) || 0,
        price: parseFloat(document.getElementById('productPrice').value),
        cost: parseFloat(document.getElementById('productCost').value),
        unit: document.getElementById('productUnit').value,
        category: document.getElementById('productCategory').value,
        branch: document.getElementById('productBranch').value,
        minStock: parseInt(document.getElementById('productMinStock').value) || 10,
        image: document.getElementById('productImage').value || 'https://via.placeholder.com/40'
    };
    
    if(!validateProduct(product)) return;
    
    if(id) {
        const ok = await updateProductById(id, product);
        if(!ok) { showNotification('حصل خطأ أثناء تحديث المنتج ❌ (تأكد من تسجيل الدخول)', 'error'); return; }
        showNotification('تم تحديث المنتج بنجاح ✅', 'success');
    } else {
        const created = await addProduct(product);
        if(!created) { showNotification('حصل خطأ أثناء إضافة المنتج ❌ (تأكد من تسجيل الدخول)', 'error'); return; }
        showNotification('تم إضافة المنتج بنجاح 🎉', 'success');
        showConfetti();
    }
    bootstrap.Modal.getInstance(document.getElementById('productModal')).hide();
    if(typeof filterProducts === 'function') filterProducts(); else renderInventoryTable();
    if(typeof loadFilterSelects === 'function') loadFilterSelects();
}

async function editProduct(id) {
    const products = await getAllProducts();
    const product = products.find(p => p.id == id);
    if(product) {
        document.getElementById('productModalLabel').innerText = '🔧 تعديل منتج';
        document.getElementById('productId').value = product.id;
        document.getElementById('productName').value = product.name;
        document.getElementById('productBarcode').value = product.barcode || '';
        document.getElementById('productStock').value = product.stock || 0;
        document.getElementById('productPrice').value = product.price;
        document.getElementById('productCost').value = product.cost;
        document.getElementById('productUnit').value = product.unit || 'قطعة';
        document.getElementById('productBranch').value = product.branch || 'الفرع الرئيسي';
        document.getElementById('productMinStock').value = product.minStock || 10;
        document.getElementById('productImage').value = product.image || '';
        new bootstrap.Modal(document.getElementById('productModal')).show();
    }
}

async function deleteProduct(id) {
    if(confirm('⚠️ هل أنت متأكد من حذف هذا المنتج نهائياً؟')) {
        await deleteProductById(id);
        showNotification('تم حذف المنتج بنجاح 🗑️', 'success');
        if(typeof filterProducts === 'function') filterProducts();
        if(typeof loadTransferSelects === 'function') loadTransferSelects();
    }
}

// ==================== توريد منتج ====================
async function addStock(id) {
    const products = await getAllProducts();
    const product = products.find(p => p.id == id);
    if(product) {
        const quantity = prompt('📦 أدخل كمية التوريد للمنتج: ' + product.name, "0");
        if(quantity && !isNaN(quantity) && parseInt(quantity) > 0) {
            product.stock = (product.stock || 0) + parseInt(quantity);
            await updateProductById(id, product);
            showNotification('تم توريد ' + quantity + ' قطعة من ' + product.name + ' 🎉', 'success');
            showConfetti();
            if(typeof filterProducts === 'function') filterProducts(); else renderInventoryTable();
        }
    }
}

// ==================== تصدير المخزون ====================
async function exportInventory() {
    const products = await getAllProducts();
    let exportData = [];
    for(let i = 0; i < products.length; i++) {
        const p = products[i];
        exportData.push({
            'الاسم': p.name,
            'الباركود': p.barcode,
            'الكمية': p.stock,
            'سعر البيع': p.price,
            'سعر الشراء': p.cost,
            'الربح المتوقع': p.price - p.cost,
            'الفرع': p.branch
        });
    }
    exportToExcel(exportData, 'المخزون');
}

// ==================== ملحوظة ====================
// تهيئة تحميل المنتجات بتحصل من inventory.html (عبر filterProducts) عشان
// الفلاتر تتطبق من أول تحميل للصفحة
