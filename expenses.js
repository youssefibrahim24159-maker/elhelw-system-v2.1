// ==================== الشريط الجانبي ====================
function toggleSidebar() {
    document.getElementById('sidebar').classList.toggle('open');
    document.querySelector('.sidebar-overlay').classList.toggle('active');
}
function closeSidebar() {
    document.getElementById('sidebar').classList.remove('open');
    document.querySelector('.sidebar-overlay').classList.remove('active');
}

let currentExpenses = [];

// ==================== عرض المصروفات ====================
function renderExpenses(list) {
    const tbody = document.getElementById('expensesTableBody');
    const totalsRow = document.getElementById('expensesTotals');
    const countBadge = document.getElementById('expensesCount');
    if(!tbody) return;

    const sorted = [...list].sort((a, b) => new Date(b.date) - new Date(a.date));
    countBadge.textContent = sorted.length;

    if(sorted.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="text-center text-muted py-4">📋 لا توجد مصروفات مسجلة</td></tr>';
        totalsRow.innerHTML = '<td colspan="5" class="text-center text-muted">لا توجد بيانات</td>';
        return;
    }

    let html = '';
    let total = 0;
    sorted.forEach(exp => {
        total += Number(exp.amount || 0);
        html += '<tr>';
        html += '<td>' + (exp.dateFormatted || formatDateTime(exp.date)) + '</td>';
        html += '<td><span class="badge bg-dark text-warning">' + exp.category + '</span></td>';
        html += '<td>' + (exp.note || '-') + '</td>';
        html += '<td class="fw-bold text-danger">' + formatCurrency(exp.amount) + '</td>';
        html += '<td><button class="btn btn-sm btn-outline-danger" onclick="deleteExpense(' + exp.id + ')"><i class="fas fa-trash"></i></button></td>';
        html += '</tr>';
    });
    tbody.innerHTML = html;
    totalsRow.innerHTML = '<td colspan="3" class="text-end">💰 الإجمالي:</td><td class="text-danger fw-bold">' + formatCurrency(total) + '</td><td></td>';
}

// ==================== الإحصائيات ====================
async function updateExpenseStats() {
    const all = await getAllExpenses();
    const now = new Date();

    let todayTotal = 0, monthTotal = 0, grandTotal = 0;
    all.forEach(exp => {
        const amount = Number(exp.amount || 0);
        grandTotal += amount;
        if(isSameDay(exp.date)) todayTotal += amount;
        const d = new Date(exp.date);
        if(!isNaN(d.getTime()) && d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()) {
            monthTotal += amount;
        }
    });

    document.getElementById('todayExpenses').textContent = formatCurrency(todayTotal);
    document.getElementById('monthExpenses').textContent = formatCurrency(monthTotal);
    document.getElementById('totalExpensesStat').textContent = formatCurrency(grandTotal);
}

// ==================== الفلاتر ====================
async function loadCategoryFilter() {
    const select = document.getElementById('expCategoryFilter');
    if(!select) return;
    const all = await getAllExpenses();
    const categories = [...new Set(all.map(e => e.category))];
    let html = '<option value="">كل التصنيفات</option>';
    categories.forEach(c => html += '<option value="' + c + '">' + c + '</option>');
    select.innerHTML = html;
}

async function filterExpenses() {
    const start = document.getElementById('expStartDate').value;
    const end = document.getElementById('expEndDate').value;
    const category = document.getElementById('expCategoryFilter').value;

    let list = await getAllExpenses();
    list = list.filter(e => isDateInRange(e.date, start, end));
    if(category) list = list.filter(e => e.category === category);

    currentExpenses = list;
    renderExpenses(list);
}

function resetExpenseFilters() {
    document.getElementById('expStartDate').value = '';
    document.getElementById('expEndDate').value = '';
    document.getElementById('expCategoryFilter').value = '';
    filterExpenses();
}

// ==================== إضافة/حذف مصروف ====================
document.getElementById('expenseCategory')?.addEventListener('change', function() {
    document.getElementById('customCategoryField').style.display = this.value === 'أخرى' ? 'block' : 'none';
});

function saveExpense() {
    const categorySelect = document.getElementById('expenseCategory').value;
    const category = categorySelect === 'أخرى'
        ? document.getElementById('expenseCustomCategory').value.trim()
        : categorySelect;
    const amount = parseFloat(document.getElementById('expenseAmount').value);
    const dateInput = document.getElementById('expenseDate').value;
    const note = document.getElementById('expenseNote').value.trim();

    if(!category) { showNotification('الرجاء اختيار أو كتابة التصنيف ❌', 'error'); return; }
    if(!amount || amount <= 0) { showNotification('الرجاء إدخال قيمة صحيحة ❌', 'error'); return; }

    const expense = {
        category: category,
        amount: amount,
        note: note,
        date: dateInput ? new Date(dateInput + 'T12:00:00').toISOString() : new Date().toISOString()
    };

    addExpenseAndRefresh(expense);
}

async function addExpenseAndRefresh(expense) {
    await addExpense(expense);
    showNotification('تم تسجيل المصروف 🎉', 'success');
    bootstrap.Modal.getInstance(document.getElementById('expenseModal')).hide();

    document.getElementById('expenseAmount').value = '';
    document.getElementById('expenseNote').value = '';
    document.getElementById('expenseCustomCategory').value = '';

    loadCategoryFilter();
    filterExpenses();
    updateExpenseStats();
}

async function deleteExpense(id) {
    if(confirm('⚠️ هل أنت متأكد من حذف هذا المصروف؟')) {
        await deleteExpenseById(id);
        showNotification('تم حذف المصروف 🗑️', 'success');
        loadCategoryFilter();
        filterExpenses();
        updateExpenseStats();
    }
}

// ==================== التهيئة ====================
document.addEventListener('DOMContentLoaded', function() {
    const today = new Date().toISOString().split('T')[0];
    const dateField = document.getElementById('expenseDate');
    if(dateField) dateField.value = today;

    loadCategoryFilter();
    filterExpenses();
    updateExpenseStats();
});
