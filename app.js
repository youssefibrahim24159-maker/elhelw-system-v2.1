// ==================== طبقة البيانات (Supabase) ====================
// كل الدوال هنا بقت async وبتتكلم مع قاعدة بيانات سحابية بدل localStorage.
// كل استعلام بيتفلتر بـ client_id بتاع المتجر المسجّل دخوله حاليًا،
// عشان بيانات كل عميل تفضل منفصلة تمامًا عن باقي العملاء.

function currentClientId() {
    const session = getCurrentSession();
    return session ? session.clientId : null;
}

function generateId() {
    return Date.now();
}

// ==================== تحويل الأعمدة بين شكل قاعدة البيانات وشكل الواجهة ====================
function mapProductFromDb(p) {
    return { id: p.id, name: p.name, barcode: p.barcode, stock: p.stock, price: p.price, cost: p.cost, unit: p.unit, category: p.category, branch: p.branch, minStock: p.min_stock, image: p.image };
}
function mapProductToDb(p, clientId) {
    return { client_id: clientId, name: p.name, barcode: p.barcode || null, stock: p.stock || 0, price: p.price || 0, cost: p.cost || 0, unit: p.unit || null, category: p.category || null, branch: p.branch || null, min_stock: p.minStock || 10, image: p.image || null };
}
function mapInvoiceFromDb(i) {
    return { id: i.id, customerId: i.customer_id, customerName: i.customer_name, items: i.items || [], total: i.total, grandTotal: i.grand_total, paid: i.paid, due: i.due, remaining: i.remaining, paymentMethod: i.payment_method, status: i.status, date: i.date, dateFormatted: i.date ? new Date(i.date).toLocaleString('ar-EG') : '' };
}
function mapCustomerFromDb(c) {
    return { id: c.id, name: c.name, phone: c.phone, address: c.address, balance: c.balance };
}
function mapSupplierFromDb(s) {
    return { id: s.id, name: s.name, phone: s.phone, address: s.address, balance: s.balance };
}
function mapSalesReturnFromDb(r) {
    return { id: r.id, invoiceId: r.invoice_id, customerId: r.customer_id, customerName: r.customer_name, items: r.items || [], total: r.total, reason: r.reason, date: r.date, dateFormatted: r.date ? new Date(r.date).toLocaleString('ar-EG') : '' };
}
function mapPurchaseReturnFromDb(r) {
    return { id: r.id, supplierId: r.supplier_id, supplierName: r.supplier_name, productId: r.product_id, productName: r.product_name, quantity: r.quantity, cost: r.cost, total: r.total, reason: r.reason, date: r.date, dateFormatted: r.date ? new Date(r.date).toLocaleString('ar-EG') : '' };
}
function mapPurchaseInvoiceFromDb(i) {
    return { id: i.id, supplierId: i.supplier_id, supplierName: i.supplier_name, items: i.items || [], total: i.total, paid: i.paid, due: i.due, paymentMethod: i.payment_method, status: i.status, date: i.date, dateFormatted: i.date ? new Date(i.date).toLocaleString('ar-EG') : '' };
}
function mapExpenseFromDb(e) {
    return { id: e.id, category: e.category, amount: e.amount, note: e.note, date: e.date, dateFormatted: e.date ? new Date(e.date).toLocaleString('ar-EG') : '' };
}

// ==================== دوال مساعدة داخلية ====================
async function adjustProductStock(id, delta) {
    const clientId = currentClientId();
    const supabase = getSupabaseClient();
    const { data: product } = await supabase.from('products').select('stock').eq('id', id).eq('client_id', clientId).maybeSingle();
    if(!product) return;
    const newStock = Math.max(0, (product.stock || 0) + delta);
    await supabase.from('products').update({ stock: newStock }).eq('id', id).eq('client_id', clientId);
}

async function adjustCustomerBalance(id, delta) {
    if(!id) return;
    const clientId = currentClientId();
    const supabase = getSupabaseClient();
    const { data: customer } = await supabase.from('customers').select('balance').eq('id', id).eq('client_id', clientId).maybeSingle();
    if(!customer) return;
    await supabase.from('customers').update({ balance: (customer.balance || 0) + delta }).eq('id', id).eq('client_id', clientId);
}

async function adjustSupplierBalance(id, delta) {
    if(!id) return;
    const clientId = currentClientId();
    const supabase = getSupabaseClient();
    const { data: supplier } = await supabase.from('suppliers').select('balance').eq('id', id).eq('client_id', clientId).maybeSingle();
    if(!supplier) return;
    await supabase.from('suppliers').update({ balance: (supplier.balance || 0) + delta }).eq('id', id).eq('client_id', clientId);
}

// ==================== المنتجات ====================
async function getAllProducts() {
    const clientId = currentClientId();
    if(!clientId) return [];
    const { data, error } = await getSupabaseClient().from('products').select('*').eq('client_id', clientId).order('id');
    if(error) { console.error(error); return []; }
    return data.map(mapProductFromDb);
}

async function addProduct(product) {
    const clientId = currentClientId();
    const { data, error } = await getSupabaseClient().from('products').insert(mapProductToDb(product, clientId)).select().single();
    if(error) { console.error(error); return null; }
    return mapProductFromDb(data);
}

// استيراد جماعي (من ملف إكسل مثلًا) - بيرجع عدد المنتجات اللي اتضافت فعليًا
async function addProductsBulk(products) {
    const clientId = currentClientId();
    if(!clientId || !products || products.length === 0) return { success: false, count: 0 };
    const rows = products.map(p => mapProductToDb(p, clientId));
    const { data, error } = await getSupabaseClient().from('products').insert(rows).select();
    if(error) { console.error(error); return { success: false, count: 0, message: error.message }; }
    return { success: true, count: (data || []).length };
}

async function updateProductById(id, updatedProduct) {
    const clientId = currentClientId();
    const { error } = await getSupabaseClient().from('products').update(mapProductToDb(updatedProduct, clientId)).eq('id', id).eq('client_id', clientId);
    return !error;
}

async function deleteProductById(id) {
    const clientId = currentClientId();
    const { error } = await getSupabaseClient().from('products').delete().eq('id', id).eq('client_id', clientId);
    return !error;
}

// ==================== أنواع المنتجات (كنصوص، زي الواجهة القديمة) ====================
async function getAllCategories() {
    const clientId = currentClientId();
    if(!clientId) return [];
    const { data, error } = await getSupabaseClient().from('product_categories').select('name').eq('client_id', clientId).order('name');
    if(error) { console.error(error); return []; }
    return data.map(c => c.name);
}

async function addCategory(category) {
    if(!category) return false;
    const clientId = currentClientId();
    const { error } = await getSupabaseClient().from('product_categories').insert({ client_id: clientId, name: category });
    return !error;
}

async function deleteCategory(category) {
    const clientId = currentClientId();
    const { error } = await getSupabaseClient().from('product_categories').delete().eq('client_id', clientId).eq('name', category);
    return !error;
}

// ==================== الفروع/المخازن (كنصوص) ====================
async function getAllBranches() {
    const clientId = currentClientId();
    if(!clientId) return [];
    const { data, error } = await getSupabaseClient().from('branches').select('name').eq('client_id', clientId).order('name');
    if(error) { console.error(error); return []; }
    return data.map(b => b.name);
}

async function addBranch(branch) {
    if(!branch) return false;
    const clientId = currentClientId();
    const { error } = await getSupabaseClient().from('branches').insert({ client_id: clientId, name: branch });
    return !error;
}

async function deleteBranch(branch) {
    const clientId = currentClientId();
    const { error } = await getSupabaseClient().from('branches').delete().eq('client_id', clientId).eq('name', branch);
    return !error;
}

// ==================== نقل المخزون بين الفروع ====================
async function transferStock(productId, fromBranch, toBranch, quantity) {
    const clientId = currentClientId();
    const supabase = getSupabaseClient();

    const { data: product } = await supabase.from('products').select('*').eq('id', productId).eq('client_id', clientId).maybeSingle();
    if(!product) return { success: false, message: 'المنتج غير موجود' };
    if(product.branch !== fromBranch) return { success: false, message: 'المنتج غير موجود في الفرع المصدر' };
    if((product.stock || 0) < quantity) return { success: false, message: 'الكمية غير متوفرة' };

    const { data: target } = await supabase.from('products').select('*').eq('client_id', clientId).eq('name', product.name).eq('branch', toBranch).maybeSingle();

    await supabase.from('products').update({ stock: product.stock - quantity }).eq('id', productId).eq('client_id', clientId);

    if(target) {
        await supabase.from('products').update({ stock: (target.stock || 0) + quantity }).eq('id', target.id).eq('client_id', clientId);
    } else {
        await supabase.from('products').insert({
            client_id: clientId, name: product.name, barcode: product.barcode, stock: quantity,
            price: product.price, cost: product.cost, unit: product.unit, category: product.category,
            branch: toBranch, min_stock: product.min_stock, image: product.image
        });
    }

    return { success: true, message: 'تم نقل المنتج بنجاح' };
}

// ==================== الفواتير ====================
async function getAllInvoices() {
    const clientId = currentClientId();
    if(!clientId) return [];
    const { data, error } = await getSupabaseClient().from('invoices').select('*').eq('client_id', clientId).order('date', { ascending: false });
    if(error) { console.error(error); return []; }
    return data.map(mapInvoiceFromDb);
}

// بينشئ فاتورة، وبيخصم الكميات من المخزون، وبيسجل المتبقي على العميل لو موجود
async function addInvoice(invoice) {
    const clientId = currentClientId();
    const supabase = getSupabaseClient();

    const { data, error } = await supabase.from('invoices').insert({
        client_id: clientId,
        customer_id: invoice.customerId || null,
        customer_name: invoice.customerName || 'عميل نقدي',
        items: invoice.items || [],
        total: invoice.total || 0,
        grand_total: invoice.grandTotal || 0,
        paid: invoice.paid || 0,
        due: invoice.due || 0,
        remaining: invoice.due || 0,
        payment_method: invoice.paymentMethod,
        status: invoice.status,
        date: invoice.date || new Date().toISOString()
    }).select().single();

    if(error) { console.error(error); return null; }

    for(const item of (invoice.items || [])) {
        await adjustProductStock(item.id, -Number(item.qty || item.quantity || 0));
    }

    if(invoice.customerId && invoice.due > 0) {
        await adjustCustomerBalance(invoice.customerId, Number(invoice.due));
    }

    return mapInvoiceFromDb(data);
}

async function deleteInvoiceById(id) {
    const clientId = currentClientId();
    const supabase = getSupabaseClient();

    const { data: inv } = await supabase.from('invoices').select('*').eq('id', id).eq('client_id', clientId).maybeSingle();
    if(!inv) return null;

    for(const item of (inv.items || [])) {
        await adjustProductStock(item.id, Number(item.qty || item.quantity || 0));
    }

    if(inv.customer_id && (inv.remaining || 0) > 0) {
        await adjustCustomerBalance(inv.customer_id, -Number(inv.remaining || 0));
    }

    await supabase.from('invoices').delete().eq('id', id).eq('client_id', clientId);
    return mapInvoiceFromDb(inv);
}

// ==================== فواتير الشراء (من المورد للمخزن) ====================
async function getAllPurchaseInvoices() {
    const clientId = currentClientId();
    if(!clientId) return [];
    const { data, error } = await getSupabaseClient().from('purchase_invoices').select('*').eq('client_id', clientId).order('date', { ascending: false });
    if(error) { console.error(error); return []; }
    return data.map(mapPurchaseInvoiceFromDb);
}

// بينشئ فاتورة شراء، وبيزود الكميات في المخزون، وبيسجل المتبقي على المورد لو موجود
async function addPurchaseInvoice(invoice) {
    const clientId = currentClientId();
    const supabase = getSupabaseClient();

    const { data, error } = await supabase.from('purchase_invoices').insert({
        client_id: clientId,
        supplier_id: invoice.supplierId || null,
        supplier_name: invoice.supplierName || 'مورد نقدي',
        items: invoice.items || [],
        total: invoice.total || 0,
        paid: invoice.paid || 0,
        due: invoice.due || 0,
        payment_method: invoice.paymentMethod,
        status: invoice.status,
        date: invoice.date || new Date().toISOString()
    }).select().single();

    if(error) { console.error(error); return null; }

    for(const item of (invoice.items || [])) {
        await adjustProductStock(item.id, Number(item.qty || item.quantity || 0));
    }

    if(invoice.supplierId && invoice.due > 0) {
        await adjustSupplierBalance(invoice.supplierId, Number(invoice.due));
    }

    return mapPurchaseInvoiceFromDb(data);
}

async function deletePurchaseInvoiceById(id) {
    const clientId = currentClientId();
    const supabase = getSupabaseClient();

    const { data: inv } = await supabase.from('purchase_invoices').select('*').eq('id', id).eq('client_id', clientId).maybeSingle();
    if(!inv) return null;

    for(const item of (inv.items || [])) {
        await adjustProductStock(item.id, -Number(item.qty || item.quantity || 0));
    }

    if(inv.supplier_id && (inv.due || 0) > 0) {
        await adjustSupplierBalance(inv.supplier_id, -Number(inv.due || 0));
    }

    await supabase.from('purchase_invoices').delete().eq('id', id).eq('client_id', clientId);
    return mapPurchaseInvoiceFromDb(inv);
}

// ==================== العملاء ====================
async function getAllCustomers() {
    const clientId = currentClientId();
    if(!clientId) return [];
    const { data, error } = await getSupabaseClient().from('customers').select('*').eq('client_id', clientId).order('name');
    if(error) { console.error(error); return []; }
    return data.map(mapCustomerFromDb);
}

async function addCustomer(customer) {
    const clientId = currentClientId();
    const { error } = await getSupabaseClient().from('customers').insert({ client_id: clientId, name: customer.name, phone: customer.phone || null, address: customer.address || null, balance: customer.balance || 0 });
    return !error;
}

async function updateCustomer(id, updatedCustomer) {
    const clientId = currentClientId();
    const { error } = await getSupabaseClient().from('customers').update({ name: updatedCustomer.name, phone: updatedCustomer.phone || null, address: updatedCustomer.address || null, balance: updatedCustomer.balance || 0 }).eq('id', id).eq('client_id', clientId);
    return !error;
}

async function deleteCustomerById(id) {
    const clientId = currentClientId();
    const { error } = await getSupabaseClient().from('customers').delete().eq('id', id).eq('client_id', clientId);
    return !error;
}

// ==================== الموردين ====================
async function getAllSuppliers() {
    const clientId = currentClientId();
    if(!clientId) return [];
    const { data, error } = await getSupabaseClient().from('suppliers').select('*').eq('client_id', clientId).order('name');
    if(error) { console.error(error); return []; }
    return data.map(mapSupplierFromDb);
}

async function addSupplier(supplier) {
    const clientId = currentClientId();
    const { error } = await getSupabaseClient().from('suppliers').insert({ client_id: clientId, name: supplier.name, phone: supplier.phone || null, address: supplier.address || null, balance: supplier.balance || 0 });
    return !error;
}

async function updateSupplier(id, updatedSupplier) {
    const clientId = currentClientId();
    const { error } = await getSupabaseClient().from('suppliers').update({ name: updatedSupplier.name, phone: updatedSupplier.phone || null, address: updatedSupplier.address || null, balance: updatedSupplier.balance || 0 }).eq('id', id).eq('client_id', clientId);
    return !error;
}

async function deleteSupplierById(id) {
    const clientId = currentClientId();
    const { error } = await getSupabaseClient().from('suppliers').delete().eq('id', id).eq('client_id', clientId);
    return !error;
}

// ==================== تحميل العملاء في قوائم الاختيار ====================
async function loadCustomersToSelects() {
    const selects = document.querySelectorAll('#customerSelect, #receiptCustomer');
    if(selects.length === 0) return;
    const customers = await getAllCustomers();
    let html = '<option value="">عميل نقدي</option>';
    customers.forEach(c => html += '<option value="' + c.id + '">' + c.name + ' (' + formatCurrency(c.balance) + ')</option>');
    selects.forEach(select => { if(select) select.innerHTML = html; });
}

// ==================== مرتجعات البيع ====================
async function getAllSalesReturns() {
    const clientId = currentClientId();
    if(!clientId) return [];
    const { data, error } = await getSupabaseClient().from('sales_returns').select('*').eq('client_id', clientId).order('date', { ascending: false });
    if(error) { console.error(error); return []; }
    return data.map(mapSalesReturnFromDb);
}

async function getReturnedQtyForInvoiceItem(invoiceId, productId) {
    const clientId = currentClientId();
    const { data, error } = await getSupabaseClient().from('sales_returns').select('items').eq('client_id', clientId).eq('invoice_id', invoiceId);
    if(error || !data) return 0;
    let qty = 0;
    data.forEach(r => (r.items || []).forEach(item => { if(item.id == productId) qty += Number(item.quantity || 0); }));
    return qty;
}

async function addSalesReturn(returnObj) {
    const clientId = currentClientId();
    const supabase = getSupabaseClient();

    // تحقق حقيقي (مش بس في الواجهة) إن الكمية المرتجعة متعديش الكمية المتاحة فعليًا
    // للإرجاع من الفاتورة الأصلية (المباعة ناقص أي مرتجع سابق لنفس الصنف)
    if(returnObj.invoiceId) {
        const { data: originalInvoice } = await supabase.from('invoices').select('items').eq('id', returnObj.invoiceId).eq('client_id', clientId).maybeSingle();
        const soldItems = (originalInvoice && originalInvoice.items) || [];
        for(const item of (returnObj.items || [])) {
            const soldItem = soldItems.find(si => si.id == item.id);
            const soldQty = soldItem ? Number(soldItem.qty || soldItem.quantity || 0) : 0;
            const alreadyReturned = await getReturnedQtyForInvoiceItem(returnObj.invoiceId, item.id);
            const available = Math.max(0, soldQty - alreadyReturned);
            if(Number(item.quantity || 0) > available) {
                return { error: true, message: 'الكمية المطلوب إرجاعها من "' + item.name + '" أكبر من المتاح فعليًا للإرجاع' };
            }
        }
    }

    let total = 0;
    (returnObj.items || []).forEach(item => { total += Number(item.price) * Number(item.quantity); });

    const { data, error } = await supabase.from('sales_returns').insert({
        client_id: clientId,
        invoice_id: returnObj.invoiceId,
        customer_id: returnObj.customerId || null,
        customer_name: returnObj.customerName,
        items: returnObj.items || [],
        total: total,
        reason: returnObj.reason || null,
        date: new Date().toISOString()
    }).select().single();

    if(error) { console.error(error); return null; }

    for(const item of (returnObj.items || [])) {
        await adjustProductStock(item.id, Number(item.quantity || 0));
    }
    if(returnObj.customerId) {
        await adjustCustomerBalance(returnObj.customerId, -total);
    }

    return mapSalesReturnFromDb(data);
}

async function deleteSalesReturnById(id) {
    const clientId = currentClientId();
    const supabase = getSupabaseClient();

    const { data: ret } = await supabase.from('sales_returns').select('*').eq('id', id).eq('client_id', clientId).maybeSingle();
    if(!ret) return null;

    for(const item of (ret.items || [])) {
        await adjustProductStock(item.id, -Number(item.quantity || 0));
    }
    if(ret.customer_id) {
        await adjustCustomerBalance(ret.customer_id, Number(ret.total || 0));
    }

    await supabase.from('sales_returns').delete().eq('id', id).eq('client_id', clientId);
    return mapSalesReturnFromDb(ret);
}

// ==================== مرتجعات الشراء ====================
async function getAllPurchaseReturns() {
    const clientId = currentClientId();
    if(!clientId) return [];
    const { data, error } = await getSupabaseClient().from('purchase_returns').select('*').eq('client_id', clientId).order('date', { ascending: false });
    if(error) { console.error(error); return []; }
    return data.map(mapPurchaseReturnFromDb);
}

async function addPurchaseReturn(returnObj) {
    const clientId = currentClientId();
    const supabase = getSupabaseClient();
    const total = Number(returnObj.cost) * Number(returnObj.quantity);

    const { data, error } = await supabase.from('purchase_returns').insert({
        client_id: clientId,
        supplier_id: returnObj.supplierId || null,
        supplier_name: returnObj.supplierName,
        product_id: returnObj.productId,
        product_name: returnObj.productName,
        quantity: returnObj.quantity,
        cost: returnObj.cost,
        total: total,
        reason: returnObj.reason || null,
        date: new Date().toISOString()
    }).select().single();

    if(error) { console.error(error); return null; }

    await adjustProductStock(returnObj.productId, -Number(returnObj.quantity || 0));
    if(returnObj.supplierId) {
        await adjustSupplierBalance(returnObj.supplierId, total);
    }

    return mapPurchaseReturnFromDb(data);
}

async function deletePurchaseReturnById(id) {
    const clientId = currentClientId();
    const supabase = getSupabaseClient();

    const { data: ret } = await supabase.from('purchase_returns').select('*').eq('id', id).eq('client_id', clientId).maybeSingle();
    if(!ret) return null;

    await adjustProductStock(ret.product_id, Number(ret.quantity || 0));
    if(ret.supplier_id) {
        await adjustSupplierBalance(ret.supplier_id, -Number(ret.total || 0));
    }

    await supabase.from('purchase_returns').delete().eq('id', id).eq('client_id', clientId);
    return mapPurchaseReturnFromDb(ret);
}

// ==================== المصروفات ====================
async function getAllExpenses() {
    const clientId = currentClientId();
    if(!clientId) return [];
    const { data, error } = await getSupabaseClient().from('expenses').select('*').eq('client_id', clientId).order('date', { ascending: false });
    if(error) { console.error(error); return []; }
    return data.map(mapExpenseFromDb);
}

async function addExpense(expenseObj) {
    const clientId = currentClientId();
    const { data, error } = await getSupabaseClient().from('expenses').insert({
        client_id: clientId,
        category: expenseObj.category,
        amount: expenseObj.amount,
        note: expenseObj.note || null,
        date: expenseObj.date || new Date().toISOString()
    }).select().single();
    if(error) { console.error(error); return null; }
    return mapExpenseFromDb(data);
}

async function deleteExpenseById(id) {
    const clientId = currentClientId();
    const { error } = await getSupabaseClient().from('expenses').delete().eq('id', id).eq('client_id', clientId);
    return !error;
}

// ==================== أدوات التاريخ الموحّدة ====================
function isSameDay(dateValue, referenceDate) {
    if(!dateValue) return false;
    const d = new Date(dateValue);
    const r = referenceDate || new Date();
    if(isNaN(d.getTime())) return false;
    return d.getFullYear() === r.getFullYear() &&
           d.getMonth() === r.getMonth() &&
           d.getDate() === r.getDate();
}

function isDateInRange(dateValue, startYmd, endYmd) {
    if(!dateValue) return true;
    const d = new Date(dateValue);
    if(isNaN(d.getTime())) return true;
    if(startYmd) {
        const start = new Date(startYmd + 'T00:00:00');
        if(d < start) return false;
    }
    if(endYmd) {
        const end = new Date(endYmd + 'T23:59:59');
        if(d > end) return false;
    }
    return true;
}

// ==================== نسخة احتياطية (تصدير/استيراد) ====================
async function exportAllDataForBackup() {
    const [products, invoices, purchaseInvoices, customers, suppliers, productCategories, branches, salesReturns, purchaseReturns, expenses] = await Promise.all([
        getAllProducts(), getAllInvoices(), getAllPurchaseInvoices(), getAllCustomers(), getAllSuppliers(),
        getAllCategories(), getAllBranches(), getAllSalesReturns(), getAllPurchaseReturns(), getAllExpenses()
    ]);
    return { products, invoices, purchaseInvoices, customers, suppliers, productCategories, branches, salesReturns, purchaseReturns, expenses, date: new Date().toISOString() };
}

// بيستورد نسخة احتياطية (إضافة فوق البيانات الحالية، مش استبدال)
async function restoreFromBackup(data) {
    if(!data || typeof data !== 'object') return { success: false, message: 'ملف النسخة الاحتياطية غير صالح' };
    const clientId = currentClientId();
    if(!clientId) return { success: false, message: 'لازم تسجل دخول أولاً' };
    const supabase = getSupabaseClient();

    try {
        if(Array.isArray(data.products) && data.products.length) {
            await supabase.from('products').insert(data.products.map(p => mapProductToDb(p, clientId)));
        }
        if(Array.isArray(data.customers) && data.customers.length) {
            await supabase.from('customers').insert(data.customers.map(c => ({ client_id: clientId, name: c.name, phone: c.phone || null, address: c.address || null, balance: c.balance || 0 })));
        }
        if(Array.isArray(data.suppliers) && data.suppliers.length) {
            await supabase.from('suppliers').insert(data.suppliers.map(s => ({ client_id: clientId, name: s.name, phone: s.phone || null, address: s.address || null, balance: s.balance || 0 })));
        }
        if(Array.isArray(data.productCategories) && data.productCategories.length) {
            await supabase.from('product_categories').insert(data.productCategories.map(name => ({ client_id: clientId, name })));
        }
        if(Array.isArray(data.branches) && data.branches.length) {
            await supabase.from('branches').insert(data.branches.map(name => ({ client_id: clientId, name })));
        }
        if(Array.isArray(data.expenses) && data.expenses.length) {
            await supabase.from('expenses').insert(data.expenses.map(e => ({ client_id: clientId, category: e.category, amount: e.amount, note: e.note || null, date: e.date || new Date().toISOString() })));
        }
        return { success: true, message: 'تم استيراد النسخة الاحتياطية بنجاح 🎉 (تمت الإضافة فوق البيانات الحالية)' };
    } catch(e) {
        return { success: false, message: 'حدث خطأ أثناء الاستيراد: ' + e.message };
    }
}
