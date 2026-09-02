// ==================== إعدادات الاتصال بقاعدة البيانات ====================
const SUPABASE_URL = 'https://guxytwmzecmdxigkdlgh.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd1eHl0d216ZWNtZHhpZ2tkbGdoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY2NTY3MDgsImV4cCI6MjEwMjIzMjcwOH0.vFpOBjCL1vXZBxmvpsmbousmd368IBjf8gxbn0XA5Yc';

let _supabaseClient = null;
let _supabaseClientHeaderKey = null;

// بيرجع نفس عميل Supabase طول ما الجلسة (توكن المستخدم أو توكن صفحة المبرمج) متغيرتش،
// ولو اتغيرت (تسجيل دخول/خروج) بيعمل عميل جديد بالـ headers الصح - عشان الـ RLS يعرف صاحب الطلب
function getSupabaseClient() {
    let appToken = null, devToken = null;
    try { appToken = (JSON.parse(localStorage.getItem('currentSession') || 'null') || {}).token || null; } catch(e) {}
    try { devToken = sessionStorage.getItem('devConsoleToken') || null; } catch(e) {}

    const headerKey = (appToken || '') + '::' + (devToken || '');
    if(!_supabaseClient || _supabaseClientHeaderKey !== headerKey) {
        const headers = {};
        if(appToken) headers['x-app-token'] = appToken;
        if(devToken) headers['x-dev-token'] = devToken;
        _supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { global: { headers } });
        _supabaseClientHeaderKey = headerKey;
    }
    return _supabaseClient;
}
