let editingUserId = null;

// ==================== صفحات قابلة للتخصيص لكل كاشير ====================
function renderPageCheckboxes(containerId, checkedKeys) {
    const container = document.getElementById(containerId);
    const checked = Array.isArray(checkedKeys) ? checkedKeys : DEFAULT_CASHIER_PAGES;
    container.innerHTML = ASSIGNABLE_PAGES.map(p =>
        '<div class="form-check">' +
        '<input class="form-check-input page-perm-checkbox" type="checkbox" value="' + p.key + '" id="' + containerId + '_' + p.key + '"' + (checked.includes(p.key) ? ' checked' : '') + '>' +
        '<label class="form-check-label" for="' + containerId + '_' + p.key + '">' + p.label + '</label>' +
        '</div>'
    ).join('');
}

function getCheckedPages(containerId) {
    return Array.from(document.querySelectorAll('#' + containerId + ' .page-perm-checkbox:checked')).map(el => el.value);
}

function onUserRoleChange() {
    const isAdmin = document.getElementById('userRole').value === 'admin';
    document.getElementById('userPagesField').style.display = isAdmin ? 'none' : 'block';
}

// ==================== عرض المستخدمين ====================
let lastRenderedUsers = [];

async function renderUsers() {
    const users = (await getUsers()).sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
    lastRenderedUsers = users;
    const tbody = document.getElementById('usersTableBody');

    if(users.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted py-4">لا يوجد مستخدمين</td></tr>';
        return;
    }

    let html = '';
    users.forEach(u => {
        const isMe = u.id == currentSession.id;
        const roleBadge = u.role === 'admin'
            ? '<span class="badge bg-warning text-dark">👑 مدير</span>'
            : '<span class="badge bg-secondary">👤 كاشير</span>';
        const statusBadge = u.active
            ? '<span class="badge bg-success">فعّال</span>'
            : '<span class="badge bg-danger">موقوف</span>';

        html += '<tr>';
        html += '<td><strong>' + u.name + '</strong>' + (isMe ? ' <span class="text-muted small">(أنت)</span>' : '') + '</td>';
        html += '<td dir="ltr" class="text-muted">' + u.username + '</td>';
        html += '<td>' + roleBadge + '</td>';
        html += '<td>' + statusBadge + '</td>';
        html += '<td>' + formatDate(u.createdAt) + '</td>';
        html += '<td><div class="action-buttons">';
        if(u.role === 'cashier') {
            html += '<button class="btn btn-sm btn-outline-primary" onclick="openUserPermissions(' + u.id + ')" title="الصفحات المسموحة"><i class="fas fa-list-check"></i></button>';
        }
        html += '<button class="btn btn-sm btn-warning" onclick="openResetPassword(' + u.id + ')" title="إعادة تعيين كلمة المرور"><i class="fas fa-key"></i></button>';
        if(!isMe) {
            html += '<button class="btn btn-sm ' + (u.active ? 'btn-outline-secondary' : 'btn-outline-success') + '" onclick="toggleUserActive(' + u.id + ', ' + (!u.active) + ')" title="' + (u.active ? 'إيقاف' : 'تفعيل') + '"><i class="fas fa-' + (u.active ? 'ban' : 'check') + '"></i></button>';
            html += '<button class="btn btn-sm btn-danger" onclick="removeUser(' + u.id + ')" title="حذف"><i class="fas fa-trash"></i></button>';
        }
        html += '</div></td>';
        html += '</tr>';
    });
    tbody.innerHTML = html;
}

// ==================== إضافة/تعديل ====================
function openUserModal() {
    editingUserId = null;
    document.getElementById('userModalTitle').innerText = '➕ إضافة مستخدم جديد';
    document.getElementById('userId').value = '';
    document.getElementById('userName').value = '';
    document.getElementById('userUsername').value = '';
    document.getElementById('userPassword').value = '';
    document.getElementById('userRole').value = 'cashier';
    document.getElementById('userPasswordField').style.display = 'block';
    document.getElementById('userPagesField').style.display = 'block';
    renderPageCheckboxes('userPagesCheckboxes', DEFAULT_CASHIER_PAGES);
}

async function saveUser() {
    const name = document.getElementById('userName').value.trim();
    const username = document.getElementById('userUsername').value.trim();
    const password = document.getElementById('userPassword').value;
    const role = document.getElementById('userRole').value;
    const permissions = role === 'cashier' ? getCheckedPages('userPagesCheckboxes') : null;

    if(!name || !username) { showNotification('الرجاء ملء الاسم واسم المستخدم ❌', 'error'); return; }
    if(!password || password.length < 6) { showNotification('كلمة المرور لازم تكون 6 أحرف على الأقل ❌', 'error'); return; }

    const result = await addUser({ name, username, password, role, permissions });
    if(!result.success) { showNotification(result.message, 'error'); return; }

    showNotification('تم إضافة المستخدم بنجاح 🎉', 'success');
    bootstrap.Modal.getInstance(document.getElementById('userModal')).hide();
    renderUsers();
}

// ==================== تفعيل/إيقاف/حذف ====================
async function toggleUserActive(id, newState) {
    const result = await updateUserRoleOrStatus(id, { active: newState });
    if(!result.success) { showNotification(result.message, 'error'); return; }
    showNotification(newState ? 'تم تفعيل الحساب ✅' : 'تم إيقاف الحساب 🚫', 'success');
    renderUsers();
}

async function removeUser(id) {
    if(!confirm('⚠️ هل أنت متأكد من حذف هذا المستخدم نهائياً؟')) return;
    const result = await deleteUserById(id);
    if(!result.success) { showNotification(result.message, 'error'); return; }
    showNotification('تم حذف المستخدم 🗑️', 'success');
    renderUsers();
}

// ==================== تعديل صلاحيات كاشير موجود ====================
function openUserPermissions(id) {
    const user = lastRenderedUsers.find(u => u.id == id);
    if(!user) return;
    document.getElementById('permsUserId').value = id;
    renderPageCheckboxes('userPermsCheckboxes', user.permissions === null || user.permissions === undefined ? DEFAULT_CASHIER_PAGES : user.permissions);
    new bootstrap.Modal(document.getElementById('userPermsModal')).show();
}

async function submitUserPermissions() {
    const id = document.getElementById('permsUserId').value;
    const permissions = getCheckedPages('userPermsCheckboxes');
    const result = await updateUserPermissions(id, permissions);
    if(!result.success) { showNotification(result.message, 'error'); return; }
    showNotification('تم تحديث الصفحات المسموحة ✅', 'success');
    bootstrap.Modal.getInstance(document.getElementById('userPermsModal')).hide();
    renderUsers();
}

// ==================== إعادة تعيين كلمة المرور ====================
function openResetPassword(id) {
    document.getElementById('resetUserId').value = id;
    document.getElementById('newPassword').value = '';
    new bootstrap.Modal(document.getElementById('resetPassModal')).show();
}

async function submitResetPassword() {
    const id = document.getElementById('resetUserId').value;
    const newPassword = document.getElementById('newPassword').value;
    if(!newPassword || newPassword.length < 6) { showNotification('كلمة المرور لازم تكون 6 أحرف على الأقل ❌', 'error'); return; }

    await resetUserPassword(id, newPassword);
    showNotification('تم تغيير كلمة المرور بنجاح 🔑', 'success');
    bootstrap.Modal.getInstance(document.getElementById('resetPassModal')).hide();
}

// ==================== التهيئة ====================
document.addEventListener('DOMContentLoaded', renderUsers);
