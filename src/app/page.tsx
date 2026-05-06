'use client';

import { useState, useEffect, useCallback } from 'react';

/* ═══════════════════════════════════════════
   TYPES & CONSTANTS
   ═══════════════════════════════════════════ */
interface UserInfo {
  id: string;
  username: string;
  real_name: string;
  role_code: string;
  org_id: string | null;
  is_disabled: boolean;
  account_expires_at: string | null;
}

interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

const ROLE_LABELS: Record<string, string> = {
  SYSTEM_DEVELOPER: '网站开发者',
  COMPANY_MANAGER: '公司负责人',
  CANTEEN_MANAGER: '食堂负责人',
  STALL_MANAGER: '档口负责人',
};

const EXPENSE_CATEGORIES = ['食材采购', '电费', '水费', '人工', '房租', '折旧', '其他'];

const Icons = {
  dashboard: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg>,
  revenue: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
  expense: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" /></svg>,
  settings: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>,
  download: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>,
  menu: <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>,
  close: <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>,
  edit: <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>,
  trash: <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>,
  plus: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>,
};

/* ═══════════════════════════════════════════
   API HELPER
   ═══════════════════════════════════════════ */
async function api<T = unknown>(url: string, options?: RequestInit): Promise<ApiResponse<T>> {
  const token = localStorage.getItem('token');
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  try {
    const res = await fetch(url, { ...options, headers: { ...headers, ...(options?.headers as Record<string, string>) } });
    return await res.json();
  } catch {
    return { success: false, error: '网络请求失败' };
  }
}

function getLocalDate(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/* ═══════════════════════════════════════════
   MAIN APP
   ═══════════════════════════════════════════ */
export default function CanteenApp() {
  const [user, setUser] = useState<UserInfo | null>(null);
  const [tab, setTab] = useState('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem('user');
    if (saved) {
      try { setUser(JSON.parse(saved)); } catch { /* ignore */ }
    }
  }, []);

  const handleLogin = async (username: string, password: string) => {
    const r = await api<{ token: string; user: UserInfo }>('/api/auth/login', {
      method: 'POST', body: JSON.stringify({ username, password }),
    });
    if (r.success && r.data) {
      localStorage.setItem('token', r.data.token);
      localStorage.setItem('user', JSON.stringify(r.data.user));
      setUser(r.data.user);
    } else {
      alert(r.error || '登录失败');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
  };

  if (!user) {
    return <LoginPage onLogin={handleLogin} />;
  }

  const navItems = [
    { key: 'dashboard', label: '仪表盘', icon: Icons.dashboard, roles: ['SYSTEM_DEVELOPER', 'COMPANY_MANAGER', 'CANTEEN_MANAGER', 'STALL_MANAGER'] },
    { key: 'revenue', label: '营收录入', icon: Icons.revenue, roles: ['SYSTEM_DEVELOPER', 'COMPANY_MANAGER', 'CANTEEN_MANAGER', 'STALL_MANAGER'] },
    { key: 'expense', label: '支出录入', icon: Icons.expense, roles: ['SYSTEM_DEVELOPER', 'COMPANY_MANAGER', 'CANTEEN_MANAGER'] },
    { key: 'settings', label: '基础设置', icon: Icons.settings, roles: ['SYSTEM_DEVELOPER', 'COMPANY_MANAGER', 'CANTEEN_MANAGER', 'STALL_MANAGER'] },
  ];

  const visibleNav = navItems.filter(n => n.roles.includes(user.role_code));

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Mobile header */}
      <div className="lg:hidden flex items-center justify-between px-4 py-3 bg-white border-b shadow-sm sticky top-0 z-30">
        <button onClick={() => setSidebarOpen(true)}>{Icons.menu}</button>
        <span className="font-bold text-gray-800">食堂管理系统</span>
        <div className="w-6" />
      </div>

      {/* Sidebar overlay (mobile) */}
      {sidebarOpen && <div className="fixed inset-0 bg-black/30 z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />}

      {/* Sidebar */}
      <aside className={`fixed lg:static inset-y-0 left-0 z-50 w-64 bg-white border-r shadow-sm transform transition-transform lg:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex items-center justify-between p-4 border-b">
          <h1 className="text-lg font-bold text-gray-800">食堂管理系统</h1>
          <button className="lg:hidden" onClick={() => setSidebarOpen(false)}>{Icons.close}</button>
        </div>
        <nav className="p-3 space-y-1">
          {visibleNav.map(n => (
            <button key={n.key} onClick={() => { setTab(n.key); setSidebarOpen(false); }}
              className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm transition-colors ${tab === n.key ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-600 hover:bg-gray-100'}`}>
              {n.icon}{n.label}
            </button>
          ))}
        </nav>
        <div className="absolute bottom-0 left-0 right-0 p-4 border-t">
          <div className="text-sm mb-2"><span className="font-medium">{user.real_name}</span> <span className="text-gray-400">({ROLE_LABELS[user.role_code] || user.role_code})</span></div>
          <button onClick={handleLogout} className="text-sm text-red-600 hover:underline">退出登录</button>
        </div>
      </aside>

      {/* Main content */}
      <main className="lg:ml-64 p-4 md:p-6">
        {tab === 'dashboard' && <DashboardPage user={user} />}
        {tab === 'revenue' && <RevenuePage user={user} />}
        {tab === 'expense' && <ExpensePage user={user} />}
        {tab === 'settings' && <SettingsPage user={user} />}
      </main>
    </div>
  );
}

/* ═══════════════════════════════════════════
   LOGIN PAGE
   ═══════════════════════════════════════════ */
function LoginPage({ onLogin }: { onLogin: (u: string, p: string) => void }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const quickAccounts = [
    { label: '开发者', username: 'dev', password: 'dev123456' },
    { label: '公司负责人', username: 'company_mgr', password: 'company123456' },
    { label: '食堂负责人', username: 'canteen_mgr', password: 'canteen123456' },
    { label: '档口负责人', username: 'stall_mgr', password: 'stall123456' },
  ];

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-800">食堂管理系统</h1>
          <p className="text-gray-500 mt-2">请使用您的账号登录系统</p>
        </div>
        <div className="bg-white rounded-2xl shadow-lg p-6 md:p-8">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">用户名</label>
              <input value={username} onChange={e => setUsername(e.target.value)} className="w-full px-4 py-2.5 border rounded-lg text-sm" placeholder="请输入用户名" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">密码</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} className="w-full px-4 py-2.5 border rounded-lg text-sm" placeholder="请输入密码" />
            </div>
            <button onClick={() => onLogin(username, password)} className="w-full py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors">登录</button>
          </div>
          <div className="mt-6 pt-4 border-t">
            <p className="text-xs text-gray-400 mb-2">快速登录（测试账号）：</p>
            <div className="flex flex-wrap gap-2">
              {quickAccounts.map(a => (
                <button key={a.username} onClick={() => { setUsername(a.username); setPassword(a.password); }}
                  className="px-3 py-1.5 border rounded-lg text-xs text-gray-600 hover:bg-gray-50">{a.label}</button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════
   DASHBOARD PAGE
   ═══════════════════════════════════════════ */
function DashboardPage({ user }: { user: UserInfo }) {
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [dateRange, setDateRange] = useState('7d');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams({ date: getLocalDate(), range: dateRange });
    api('/api/dashboard?' + params.toString()).then(r => {
      if (r.success && r.data) setData(r.data as Record<string, unknown>);
    }).finally(() => setLoading(false));
  }, [dateRange]);

  if (loading && !data) return <div className="text-center py-20 text-gray-400">加载中...</div>;

  const kpi = (data?.kpi || {}) as Record<string, unknown>;
  const num = (v: unknown) => typeof v === 'number' ? v : parseFloat(String(v || 0));
  const canteenComparison = (data?.canteen_revenue || []) as { name: string; amount: number }[];
  const stallRanking = (data?.stall_ranking || []) as { name: string; amount: number }[];
  const revenueTrend = (data?.revenue_trend || []) as { date: string; amount: number }[];
  const expenseBreakdown = (data?.expense_composition || []) as { category: string; amount: number }[];
  const dailyDetail = (data?.daily_detail || []) as Record<string, unknown>[];

  return (
    <div className="space-y-4 max-w-6xl mx-auto">
      {/* Date range selector */}
      <div className="flex gap-2 items-center">
        {['7d', '30d'].map(r => (
          <button key={r} onClick={() => setDateRange(r)} className={`px-4 py-1.5 rounded-lg text-sm ${dateRange === r ? 'bg-blue-600 text-white' : 'bg-white border text-gray-600'}`}>
            {r === '7d' ? '近7天' : '近30天'}
          </button>
        ))}
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        {[
          { label: '今日营收', value: num(kpi.total_revenue), color: 'text-blue-600', prefix: '¥' },
          { label: '今日支出', value: num(kpi.total_expense), color: 'text-red-600', prefix: '¥' },
          { label: '今日毛利', value: num(kpi.gross_profit), color: 'text-green-600', prefix: '¥' },
          { label: '毛利率', value: num(kpi.gross_margin), color: 'text-purple-600', suffix: '%' },
        ].map(k => (
          <div key={k.label} className="bg-white rounded-xl p-4 shadow-sm border">
            <div className="text-xs text-gray-500 mb-1">{k.label}</div>
            <div className={`text-xl md:text-2xl font-bold ${k.color}`}>
              {k.prefix}{k.value.toFixed(k.suffix ? 1 : 2)}{k.suffix || ''}
            </div>
          </div>
        ))}
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Canteen Comparison */}
        <div className="bg-white rounded-xl p-4 shadow-sm border">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">食堂营收对比</h3>
          <div className="space-y-2">
            {canteenComparison.length > 0 ? canteenComparison.map(c => {
              const cAmt = num(c.amount);
              const maxAmt = Math.max(...canteenComparison.map(x => num(x.amount)), 1);
              return (
              <div key={c.name} className="flex items-center gap-3">
                <span className="text-sm text-gray-600 w-24 truncate">{c.name}</span>
                <div className="flex-1 bg-gray-100 rounded-full h-6 overflow-hidden">
                  <div className="bg-blue-500 h-full rounded-full flex items-center justify-end pr-2" style={{ width: `${Math.max(5, (cAmt / maxAmt) * 100)}%` }}>
                    <span className="text-xs text-white font-medium">¥{cAmt.toFixed(0)}</span>
                  </div>
                </div>
              </div>
              );
            }) : <div className="text-center text-gray-400 py-6 text-sm">暂无数据</div>}
          </div>
        </div>

        {/* Stall Ranking */}
        <div className="bg-white rounded-xl p-4 shadow-sm border">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">档口营收排行 (Top 5)</h3>
          <div className="space-y-2">
            {stallRanking.length > 0 ? stallRanking.map((s, i) => (
              <div key={s.name} className="flex items-center gap-3">
                <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${i < 3 ? 'bg-amber-500 text-white' : 'bg-gray-200 text-gray-600'}`}>{i + 1}</span>
                <span className="text-sm text-gray-600 flex-1 truncate">{s.name}</span>
                <span className="text-sm font-medium text-gray-800">¥{num(s.amount).toFixed(0)}</span>
              </div>
            )) : <div className="text-center text-gray-400 py-6 text-sm">暂无数据</div>}
          </div>
        </div>
      </div>

      {/* Revenue Trend */}
      <div className="bg-white rounded-xl p-4 shadow-sm border">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">营收趋势</h3>
        <div className="h-48 flex items-end gap-1 overflow-x-auto">
          {revenueTrend.length > 0 ? revenueTrend.map((r, i) => {
            const rAmt = num(r.amount);
            const maxAmt = Math.max(...revenueTrend.map(x => num(x.amount)), 1);
            const h = Math.max(4, (rAmt / maxAmt) * 100);
            return (
              <div key={i} className="flex-1 min-w-[30px] flex flex-col items-center gap-1" title={`${r.date}: ¥${rAmt.toFixed(0)}`}>
                <span className="text-xs text-gray-500">¥{(rAmt / 1000).toFixed(1)}k</span>
                <div className="w-full bg-blue-400 rounded-t" style={{ height: `${h}%`, minHeight: '4px' }} />
                <span className="text-xs text-gray-400">{r.date.slice(5)}</span>
              </div>
            );
          }) : <div className="text-gray-400 text-sm w-full text-center py-10">暂无数据</div>}
        </div>
      </div>

      {/* Expense Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl p-4 shadow-sm border">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">支出构成</h3>
          <div className="space-y-2">
            {expenseBreakdown.length > 0 ? expenseBreakdown.map(e => {
              const total = expenseBreakdown.reduce((s, x) => s + num(x.amount), 0) || 1;
              const pct = ((num(e.amount) / total) * 100).toFixed(1);
              return (
                <div key={e.category} className="flex items-center gap-3">
                  <span className="text-sm text-gray-600 w-20 truncate">{e.category}</span>
                  <div className="flex-1 bg-gray-100 rounded-full h-5 overflow-hidden">
                    <div className="bg-orange-400 h-full rounded-full" style={{ width: `${pct}%` }} />
                  </div>
                  <span className="text-xs text-gray-500 w-16 text-right">{pct}%</span>
                </div>
              );
            }) : <div className="text-center text-gray-400 py-6 text-sm">暂无数据</div>}
          </div>
        </div>

        {/* Daily Detail */}
        <div className="bg-white rounded-xl p-4 shadow-sm border">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">当日明细</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b text-gray-500 text-xs">
                <th className="py-2 px-2 text-left">食堂</th><th className="py-2 px-2 text-right">营收</th><th className="py-2 px-2 text-right">支出</th><th className="py-2 px-2 text-right">毛利</th><th className="py-2 px-2 text-right">毛利率</th>
              </tr></thead>
              <tbody>
                {dailyDetail.map((r, i) => (
                  <tr key={i} className="border-b last:border-0">
                    <td className="py-2 px-2">{(r.canteen_name as string) || '-'}</td>
                    <td className="py-2 px-2 text-right">¥{num(r.revenue).toFixed(2)}</td>
                    <td className="py-2 px-2 text-right">¥{num(r.expense).toFixed(2)}</td>
                    <td className="py-2 px-2 text-right">¥{num(r.gross_profit).toFixed(2)}</td>
                    <td className="py-2 px-2 text-right">{num(r.gross_margin).toFixed(1)}%</td>
                  </tr>
                ))}
                {dailyDetail.length === 0 && <tr><td colSpan={5} className="py-6 text-center text-gray-400">暂无数据</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════
   REVENUE PAGE (modified: no revenue_type, meal_type required, edit/delete)
   ═══════════════════════════════════════════ */
function RevenuePage({ user }: { user: UserInfo }) {
  const [canteens, setCanteens] = useState<{ id: string; name: string }[]>([]);
  const [stalls, setStalls] = useState<{ id: string; name: string }[]>([]);
  const [mealTypes, setMealTypes] = useState<{ id: string; name: string }[]>([]);
  const [records, setRecords] = useState<Record<string, unknown>[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [editingId, setEditingId] = useState<string | null>(null);

  const emptyForm = { canteen_id: '', stall_id: '', meal_type_id: '', record_date: getLocalDate(), order_count: '', amount: '', note: '' };
  const [form, setForm] = useState(emptyForm);

  const isStallMgr = user.role_code === 'STALL_MANAGER';
  const isCanteenMgr = user.role_code === 'CANTEEN_MANAGER';

  useEffect(() => {
    api<{ id: string; name: string }[]>('/api/dropdown/canteens').then(r => {
      if (r.success && r.data) {
        setCanteens(r.data);
        if (r.data.length === 1) setForm(f => ({ ...f, canteen_id: r.data![0].id }));
        else if (isCanteenMgr && user.org_id) {
          const match = r.data.find(c => c.id === user.org_id);
          if (match) setForm(f => ({ ...f, canteen_id: match.id }));
        }
      }
    });
  }, [user, isCanteenMgr]);

  useEffect(() => {
    if (!form.canteen_id) { setStalls([]); return; }
    api<{ id: string; name: string }[]>(`/api/dropdown/stalls?canteen_id=${form.canteen_id}`).then(r => {
      if (r.success && r.data) {
        setStalls(r.data);
        if (isStallMgr && user.org_id) {
          const match = r.data.find(s => s.id === user.org_id);
          if (match) setForm(f => ({ ...f, stall_id: match.id }));
        } else if (r.data.length === 1) setForm(f => ({ ...f, stall_id: r.data![0].id }));
      }
    });
    api<{ id: string; name: string }[]>(`/api/meal-types?canteen_id=${form.canteen_id}`).then(r => {
      if (r.success && r.data) setMealTypes(r.data);
    });
  }, [form.canteen_id, user, isStallMgr]);

  const loadRecords = useCallback(async () => {
    const params = new URLSearchParams({ page: String(page), page_size: '10' });
    if (form.canteen_id) params.set('canteen_id', form.canteen_id);
    const r = await api<{ records: Record<string, unknown>[]; total: number }>(`/api/revenue-records?${params}`);
    if (r.success && r.data) { setRecords(r.data.records); setTotal(r.data.total || 0); }
  }, [page, form.canteen_id]);

  useEffect(() => { loadRecords(); }, [loadRecords]);

  const handleSubmit = async () => {
    if (!form.canteen_id || !form.stall_id || !form.meal_type_id || !form.amount) { alert('食堂、档口、餐别、金额为必填'); return; }
    const body = {
      canteen_id: form.canteen_id, stall_id: form.stall_id, meal_type_id: form.meal_type_id,
      record_date: form.record_date, order_count: parseInt(form.order_count) || 0,
      amount: parseFloat(form.amount), note: form.note || null,
    };
    const r = editingId
      ? await api(`/api/revenue-records/${editingId}`, { method: 'PUT', body: JSON.stringify(body) })
      : await api('/api/revenue-records', { method: 'POST', body: JSON.stringify(body) });
    if (r.success) {
      alert(r.message || (editingId ? '修改成功' : '录入成功'));
      setForm(emptyForm); setEditingId(null); loadRecords();
    } else { alert(r.error || '操作失败'); }
  };

  const handleEdit = (r: Record<string, unknown>) => {
    setEditingId(r.id as string);
    setForm({
      canteen_id: (r.canteen_id as string) || '', stall_id: (r.stall_id as string) || '',
      meal_type_id: (r.meal_type_id as string) || '', record_date: (r.record_date as string) || getLocalDate(),
      order_count: String(r.order_count ?? ''), amount: String(r.amount ?? ''),
      note: (r.note as string) || '',
    });
  };

  const handleDelete = async (id: string) => {
    if (!confirm('确认删除此记录？')) return;
    const r = await api(`/api/revenue-records/${id}`, { method: 'DELETE' });
    if (r.success) loadRecords();
    else alert(r.error);
  };

  const handleExport = () => {
    const params = new URLSearchParams({ type: 'revenue' });
    if (form.canteen_id) params.set('canteen_id', form.canteen_id);
    const token = localStorage.getItem('token');
    window.open(`/api/export?${params.toString()}&token=${token}`, '_blank');
  };

  const cancelEdit = () => { setEditingId(null); setForm(emptyForm); };

  return (
    <div className="space-y-4 max-w-5xl mx-auto">
      <div className="bg-white rounded-xl p-4 md:p-6 shadow-sm border">
        <h3 className="text-sm font-semibold text-gray-700 mb-4">{editingId ? '编辑营收记录' : '营收录入'}</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">食堂 *</label>
            <select value={form.canteen_id} onChange={e => setForm(f => ({ ...f, canteen_id: e.target.value, stall_id: '', meal_type_id: '' }))} disabled={isCanteenMgr || isStallMgr} className="w-full px-3 py-2 border rounded-lg text-sm disabled:bg-gray-100">
              <option value="">选择食堂</option>
              {canteens.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">档口 *</label>
            <select value={form.stall_id} onChange={e => setForm(f => ({ ...f, stall_id: e.target.value }))} disabled={isStallMgr} className="w-full px-3 py-2 border rounded-lg text-sm disabled:bg-gray-100">
              <option value="">选择档口</option>
              {stalls.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">餐别 *</label>
            <select value={form.meal_type_id} onChange={e => setForm(f => ({ ...f, meal_type_id: e.target.value }))} className="w-full px-3 py-2 border rounded-lg text-sm">
              <option value="">选择餐别</option>
              {mealTypes.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">营业日期 *</label>
            <input type="date" value={form.record_date} onChange={e => setForm(f => ({ ...f, record_date: e.target.value }))} className="w-full px-3 py-2 border rounded-lg text-sm" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">订单数</label>
            <input type="number" value={form.order_count} onChange={e => setForm(f => ({ ...f, order_count: e.target.value }))} className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="0" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">金额(元) *</label>
            <input type="number" step="0.01" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="0.00" />
          </div>
          <div className="sm:col-span-2 lg:col-span-3">
            <label className="block text-xs font-medium text-gray-600 mb-1">备注</label>
            <input value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))} className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="可选" />
          </div>
        </div>
        <div className="mt-4 flex gap-3">
          <button onClick={handleSubmit} className="px-6 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">{editingId ? '保存修改' : '提交'}</button>
          {editingId && <button onClick={cancelEdit} className="px-4 py-2 border rounded-lg text-sm text-gray-600">取消</button>}
          {!isStallMgr && (
            <button onClick={handleExport} className="px-4 py-2 border rounded-lg text-sm text-gray-600 hover:bg-gray-50 flex items-center gap-2">
              {Icons.download}导出Excel
            </button>
          )}
        </div>
      </div>

      <div className="bg-white rounded-xl p-4 md:p-6 shadow-sm border">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">已录入记录</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b text-gray-500 text-xs">
              <th className="py-2 px-3 text-left">日期</th><th className="py-2 px-3 text-left">食堂</th><th className="py-2 px-3 text-left">档口</th><th className="py-2 px-3 text-left">餐别</th><th className="py-2 px-3 text-right">订单数</th><th className="py-2 px-3 text-right">金额</th><th className="py-2 px-3 text-left">备注</th><th className="py-2 px-3">操作</th>
            </tr></thead>
            <tbody>
              {records.map((r, i) => (
                <tr key={i} className="border-b last:border-0 hover:bg-gray-50">
                  <td className="py-2 px-3">{r.record_date as string}</td>
                  <td className="py-2 px-3">{(r.canteen_name as string) || '-'}</td>
                  <td className="py-2 px-3">{(r.stall_name as string) || '-'}</td>
                  <td className="py-2 px-3">{(r.meal_type_name as string) || '-'}</td>
                  <td className="py-2 px-3 text-right">{r.order_count as number}</td>
                  <td className="py-2 px-3 text-right">¥{r.amount as string}</td>
                  <td className="py-2 px-3 text-gray-500 max-w-[120px] truncate">{(r.note as string) || '-'}</td>
                  <td className="py-2 px-3">
                    <div className="flex gap-2">
                      <button onClick={() => handleEdit(r)} className="text-blue-600 hover:underline">{Icons.edit}</button>
                      <button onClick={() => handleDelete(r.id as string)} className="text-red-600 hover:underline">{Icons.trash}</button>
                    </div>
                  </td>
                </tr>
              ))}
              {records.length === 0 && <tr><td colSpan={8} className="py-6 text-center text-gray-400">暂无记录</td></tr>}
            </tbody>
          </table>
        </div>
        {total > 10 && (
          <div className="mt-3 flex gap-2 justify-center">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="px-3 py-1 border rounded text-sm disabled:opacity-50">上一页</button>
            <span className="px-3 py-1 text-sm text-gray-600">{page} / {Math.ceil(total / 10)}</span>
            <button onClick={() => setPage(p => p + 1)} disabled={page >= Math.ceil(total / 10)} className="px-3 py-1 border rounded text-sm disabled:opacity-50">下一页</button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════
   EXPENSE PAGE (modified: food procurement fields, edit/delete)
   ═══════════════════════════════════════════ */
function ExpensePage({ user }: { user: UserInfo }) {
  const [canteens, setCanteens] = useState<{ id: string; name: string }[]>([]);
  const [records, setRecords] = useState<Record<string, unknown>[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Product dropdowns for food procurement
  const [productCategories, setProductCategories] = useState<{ id: string; name: string }[]>([]);
  const [products, setProducts] = useState<{ id: string; name: string }[]>([]);
  const [productSpecs, setProductSpecs] = useState<{ id: string; name: string }[]>([]);

  const emptyForm = {
    canteen_id: '', expense_date: getLocalDate(), category: '', amount: '', note: '',
    product_category_id: '', product_id: '', quantity: '', unit_price: '', product_spec_id: '',
  };
  const [form, setForm] = useState(emptyForm);

  const isFoodProcurement = form.category === '食材采购';

  useEffect(() => {
    api<{ id: string; name: string }[]>('/api/dropdown/canteens').then(r => {
      if (r.success && r.data) {
        setCanteens(r.data);
        if (user.role_code === 'CANTEEN_MANAGER' && user.org_id) {
          const match = r.data.find(c => c.id === user.org_id);
          if (match) setForm(f => ({ ...f, canteen_id: match.id }));
        } else if (r.data.length === 1) setForm(f => ({ ...f, canteen_id: r.data![0].id }));
      }
    });
  }, [user]);

  // Load product categories
  useEffect(() => {
    api<{ id: string; name: string }[]>('/api/settings/products/categories').then(r => {
      if (r.success && r.data) setProductCategories(r.data);
    });
  }, []);

  // Load products when category changes
  useEffect(() => {
    if (!form.product_category_id) { setProducts([]); return; }
    api<{ id: string; name: string }[]>(`/api/settings/products?category_id=${form.product_category_id}`).then(r => {
      if (r.success && r.data) setProducts(r.data);
    });
  }, [form.product_category_id]);

  // Load specs when product changes
  useEffect(() => {
    if (!form.product_id) { setProductSpecs([]); return; }
    api<{ id: string; name: string }[]>(`/api/settings/products/specs?product_id=${form.product_id}`).then(r => {
      if (r.success && r.data) setProductSpecs(r.data);
    });
  }, [form.product_id]);

  const loadRecords = useCallback(async () => {
    const params = new URLSearchParams({ page: String(page), page_size: '10' });
    if (form.canteen_id) params.set('canteen_id', form.canteen_id);
    const r = await api<{ records: Record<string, unknown>[]; total: number }>(`/api/expense-records?${params}`);
    if (r.success && r.data) { setRecords(r.data.records); setTotal(r.data.total || 0); }
  }, [page, form.canteen_id]);

  useEffect(() => { loadRecords(); }, [loadRecords]);

  const handleSubmit = async () => {
    if (!form.canteen_id || !form.category || !form.amount) { alert('请填写必填字段'); return; }
    const body: Record<string, unknown> = {
      canteen_id: form.canteen_id, expense_date: form.expense_date,
      category: form.category, amount: parseFloat(form.amount), note: form.note || null,
    };
    if (isFoodProcurement) {
      body.product_category_id = form.product_category_id || null;
      body.product_id = form.product_id || null;
      body.quantity = form.quantity ? parseFloat(form.quantity) : null;
      body.unit_price = form.unit_price ? parseFloat(form.unit_price) : null;
      body.product_spec_id = form.product_spec_id || null;
    }
    const r = editingId
      ? await api(`/api/expense-records/${editingId}`, { method: 'PUT', body: JSON.stringify(body) })
      : await api('/api/expense-records', { method: 'POST', body: JSON.stringify(body) });
    if (r.success) {
      alert(editingId ? '修改成功' : '录入成功');
      setForm(emptyForm); setEditingId(null); loadRecords();
    } else { alert(r.error || '操作失败'); }
  };

  const handleEdit = (r: Record<string, unknown>) => {
    setEditingId(r.id as string);
    setForm({
      canteen_id: (r.canteen_id as string) || '', expense_date: (r.expense_date as string) || getLocalDate(),
      category: (r.category as string) || '', amount: String(r.amount ?? ''), note: (r.note as string) || '',
      product_category_id: (r.product_category_id as string) || '', product_id: (r.product_id as string) || '',
      quantity: r.quantity ? String(r.quantity) : '', unit_price: r.unit_price ? String(r.unit_price) : '',
      product_spec_id: (r.product_spec_id as string) || '',
    });
  };

  const handleDelete = async (id: string) => {
    if (!confirm('确认删除此记录？')) return;
    const r = await api(`/api/expense-records/${id}`, { method: 'DELETE' });
    if (r.success) loadRecords();
    else alert(r.error);
  };

  const cancelEdit = () => { setEditingId(null); setForm(emptyForm); };

  return (
    <div className="space-y-4 max-w-5xl mx-auto">
      <div className="bg-white rounded-xl p-4 md:p-6 shadow-sm border">
        <h3 className="text-sm font-semibold text-gray-700 mb-4">{editingId ? '编辑支出记录' : '支出录入'}</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">食堂 *</label>
            <select value={form.canteen_id} onChange={e => setForm(f => ({ ...f, canteen_id: e.target.value }))} disabled={user.role_code === 'CANTEEN_MANAGER'} className="w-full px-3 py-2 border rounded-lg text-sm disabled:bg-gray-100">
              <option value="">选择食堂</option>
              {canteens.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">支出日期 *</label>
            <input type="date" value={form.expense_date} onChange={e => setForm(f => ({ ...f, expense_date: e.target.value }))} className="w-full px-3 py-2 border rounded-lg text-sm" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">支出类别 *</label>
            <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value, product_category_id: '', product_id: '', product_spec_id: '' }))} className="w-full px-3 py-2 border rounded-lg text-sm">
              <option value="">选择类别</option>
              {EXPENSE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">金额(元) *</label>
            <input type="number" step="0.01" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="0.00" />
          </div>
          <div className="sm:col-span-2 lg:col-span-3">
            <label className="block text-xs font-medium text-gray-600 mb-1">备注</label>
            <input value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))} className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="可选" />
          </div>

          {/* Food procurement additional fields */}
          {isFoodProcurement && (
            <>
              <div className="sm:col-span-2 lg:col-span-3 pt-2 border-t mt-1">
                <p className="text-xs text-gray-500 mb-3">食材采购信息（选填）</p>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">食材品类</label>
                <select value={form.product_category_id} onChange={e => setForm(f => ({ ...f, product_category_id: e.target.value, product_id: '', product_spec_id: '' }))} className="w-full px-3 py-2 border rounded-lg text-sm">
                  <option value="">选择品类</option>
                  {productCategories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">食材名称</label>
                <select value={form.product_id} onChange={e => setForm(f => ({ ...f, product_id: e.target.value, product_spec_id: '' }))} className="w-full px-3 py-2 border rounded-lg text-sm">
                  <option value="">选择食材</option>
                  {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">规格</label>
                <select value={form.product_spec_id} onChange={e => setForm(f => ({ ...f, product_spec_id: e.target.value }))} className="w-full px-3 py-2 border rounded-lg text-sm">
                  <option value="">选择规格</option>
                  {productSpecs.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">数量</label>
                <input type="number" step="0.01" value={form.quantity} onChange={e => setForm(f => ({ ...f, quantity: e.target.value }))} className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="0" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">单价(元)</label>
                <input type="number" step="0.01" value={form.unit_price} onChange={e => setForm(f => ({ ...f, unit_price: e.target.value }))} className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="0.00" />
              </div>
            </>
          )}
        </div>
        <div className="mt-4 flex gap-3">
          <button onClick={handleSubmit} className="px-6 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">{editingId ? '保存修改' : '提交'}</button>
          {editingId && <button onClick={cancelEdit} className="px-4 py-2 border rounded-lg text-sm text-gray-600">取消</button>}
          <button onClick={() => { const params = new URLSearchParams({ type: 'expense' }); if (form.canteen_id) params.set('canteen_id', form.canteen_id); window.open(`/api/export?${params.toString()}&token=${localStorage.getItem('token')}`, '_blank'); }} className="px-4 py-2 border rounded-lg text-sm text-gray-600 hover:bg-gray-50 flex items-center gap-2">{Icons.download}导出Excel</button>
        </div>
      </div>

      <div className="bg-white rounded-xl p-4 md:p-6 shadow-sm border">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">已录入记录</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b text-gray-500 text-xs">
              <th className="py-2 px-3 text-left">日期</th><th className="py-2 px-3 text-left">食堂</th><th className="py-2 px-3 text-left">类别</th><th className="py-2 px-3 text-right">金额</th><th className="py-2 px-3 text-left">食材信息</th><th className="py-2 px-3 text-left">备注</th><th className="py-2 px-3">操作</th>
            </tr></thead>
            <tbody>
              {records.map((r, i) => {
                const foodInfo = r.category === '食材采购' ? [
                  (r.product_category_name as string),
                  (r.product_name as string),
                  r.quantity ? `${r.quantity}${(r.product_spec_name as string) || ''}` : '',
                  r.unit_price ? `@${r.unit_price}` : '',
                ].filter(Boolean).join(' / ') : '';
                return (
                  <tr key={i} className="border-b last:border-0 hover:bg-gray-50">
                    <td className="py-2 px-3">{r.expense_date as string}</td>
                    <td className="py-2 px-3">{(r.canteen_name as string) || '-'}</td>
                    <td className="py-2 px-3">{r.category as string}</td>
                    <td className="py-2 px-3 text-right">¥{r.amount as string}</td>
                    <td className="py-2 px-3 text-gray-500 text-xs">{foodInfo || '-'}</td>
                    <td className="py-2 px-3 text-gray-500">{(r.note as string) || '-'}</td>
                    <td className="py-2 px-3">
                      <div className="flex gap-2">
                        <button onClick={() => handleEdit(r)} className="text-blue-600 hover:underline">{Icons.edit}</button>
                        <button onClick={() => handleDelete(r.id as string)} className="text-red-600 hover:underline">{Icons.trash}</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {records.length === 0 && <tr><td colSpan={7} className="py-6 text-center text-gray-400">暂无记录</td></tr>}
            </tbody>
          </table>
        </div>
        {total > 10 && (
          <div className="mt-3 flex gap-2 justify-center">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="px-3 py-1 border rounded text-sm disabled:opacity-50">上一页</button>
            <span className="px-3 py-1 text-sm text-gray-600">{page} / {Math.ceil(total / 10)}</span>
            <button onClick={() => setPage(p => p + 1)} disabled={page >= Math.ceil(total / 10)} className="px-3 py-1 border rounded text-sm disabled:opacity-50">下一页</button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════
   SETTINGS PAGE (7 sub-tabs)
   ═══════════════════════════════════════════ */
function SettingsPage({ user }: { user: UserInfo }) {
  const [subTab, setSubTab] = useState('canteen');
  const subTabs = [
    { key: 'canteen', label: '食堂管理', roles: ['SYSTEM_DEVELOPER', 'COMPANY_MANAGER'] },
    { key: 'stall', label: '档口管理', roles: ['SYSTEM_DEVELOPER', 'COMPANY_MANAGER', 'CANTEEN_MANAGER'] },
    { key: 'fixed', label: '固定支出', roles: ['SYSTEM_DEVELOPER', 'COMPANY_MANAGER'] },
    { key: 'mealtype', label: '餐别管理', roles: ['SYSTEM_DEVELOPER', 'COMPANY_MANAGER', 'CANTEEN_MANAGER'] },
    { key: 'account', label: '账号管理', roles: ['SYSTEM_DEVELOPER', 'COMPANY_MANAGER', 'CANTEEN_MANAGER'] },
    { key: 'product', label: '商品管理', roles: ['SYSTEM_DEVELOPER', 'COMPANY_MANAGER'] },
    { key: 'logs', label: '操作日志', roles: ['SYSTEM_DEVELOPER', 'COMPANY_MANAGER'] },
  ];

  const visibleTabs = subTabs.filter(t => t.roles.includes(user.role_code));

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex gap-2 mb-4 overflow-x-auto pb-2">
        {visibleTabs.map(t => (
          <button key={t.key} onClick={() => setSubTab(t.key)} className={`px-4 py-2 rounded-lg text-sm whitespace-nowrap ${subTab === t.key ? 'bg-blue-600 text-white' : 'bg-white border text-gray-600 hover:bg-gray-50'}`}>
            {t.label}
          </button>
        ))}
      </div>
      {subTab === 'canteen' && <CanteenManager user={user} />}
      {subTab === 'stall' && <StallManager user={user} />}
      {subTab === 'fixed' && <FixedExpenses user={user} />}
      {subTab === 'mealtype' && <MealTypeManager user={user} />}
      {subTab === 'account' && <AccountManager user={user} />}
      {subTab === 'product' && <ProductManager user={user} />}
      {subTab === 'logs' && <OperationLogs />}
    </div>
  );
}

/* ═══════════════════════════════════════════
   CANTEEN MANAGER
   ═══════════════════════════════════════════ */
function CanteenManager({ user }: { user: UserInfo }) {
  const [canteens, setCanteens] = useState<Record<string, unknown>[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', address: '', contact_name: '', contact_phone: '', manager_id: '' });
  const [users, setUsers] = useState<Record<string, unknown>[]>([]);
  const [companyId, setCompanyId] = useState('');

  useEffect(() => {
    api<{ id: string; name: string }[]>('/api/companies').then(r => {
      if (r.success && r.data && r.data.length) {
        if (user.role_code === 'COMPANY_MANAGER' && user.org_id) setCompanyId(user.org_id);
        else setCompanyId(r.data[0].id);
      }
    });
  }, [user]);

  const loadCanteens = useCallback(async () => {
    if (!companyId) return;
    const r = await api<Record<string, unknown>[]>(`/api/companies/${companyId}/canteens`);
    if (r.success && r.data) setCanteens(r.data);
  }, [companyId]);

  useEffect(() => { loadCanteens(); }, [loadCanteens]);

  useEffect(() => {
    api<Record<string, unknown>[]>('/api/users').then(r => {
      if (r.success && r.data) setUsers(r.data.filter((u: Record<string, unknown>) => u.role_code === 'CANTEEN_MANAGER'));
    });
  }, []);

  const handleSubmit = async () => {
    if (!form.name) { alert('食堂名称必填'); return; }
    const body = { name: form.name, address: form.address || null, contact_name: form.contact_name || null, contact_phone: form.contact_phone || null, manager_id: form.manager_id || null };
    const r = editId
      ? await api(`/api/canteens/${editId}`, { method: 'PUT', body: JSON.stringify(body) })
      : await api(`/api/companies/${companyId}/canteens`, { method: 'POST', body: JSON.stringify(body) });
    if (r.success) { setShowForm(false); setEditId(null); setForm({ name: '', address: '', contact_name: '', contact_phone: '', manager_id: '' }); loadCanteens(); }
    else alert(r.error);
  };

  const handleEdit = (c: Record<string, unknown>) => {
    setEditId(c.id as string);
    setForm({ name: (c.name as string) || '', address: (c.address as string) || '', contact_name: (c.contact_name as string) || '', contact_phone: (c.contact_phone as string) || '', manager_id: (c.manager_id as string) || '' });
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('确认删除此食堂？')) return;
    const r = await api(`/api/canteens/${id}`, { method: 'DELETE' });
    if (r.success) loadCanteens();
    else alert(r.error);
  };

  return (
    <div className="bg-white rounded-xl p-4 md:p-6 shadow-sm border">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-gray-700">食堂管理</h3>
        <button onClick={() => { setShowForm(!showForm); setEditId(null); setForm({ name: '', address: '', contact_name: '', contact_phone: '', manager_id: '' }); }} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 flex items-center gap-1">{Icons.plus}新增</button>
      </div>
      {showForm && (
        <div className="bg-gray-50 rounded-lg p-4 mb-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
          <input placeholder="食堂名称 *" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="px-3 py-2 border rounded-lg text-sm" />
          <input placeholder="地址" value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} className="px-3 py-2 border rounded-lg text-sm" />
          <input placeholder="联系人" value={form.contact_name} onChange={e => setForm(f => ({ ...f, contact_name: e.target.value }))} className="px-3 py-2 border rounded-lg text-sm" />
          <input placeholder="联系电话" value={form.contact_phone} onChange={e => setForm(f => ({ ...f, contact_phone: e.target.value }))} className="px-3 py-2 border rounded-lg text-sm" />
          <select value={form.manager_id} onChange={e => setForm(f => ({ ...f, manager_id: e.target.value }))} className="px-3 py-2 border rounded-lg text-sm">
            <option value="">指定食堂负责人</option>
            {users.map(u => <option key={u.id as string} value={u.id as string}>{u.real_name as string} ({u.username as string})</option>)}
          </select>
          <div className="flex gap-2 items-end">
            <button onClick={handleSubmit} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm">{editId ? '保存' : '创建'}</button>
            <button onClick={() => { setShowForm(false); setEditId(null); }} className="px-4 py-2 border rounded-lg text-sm text-gray-600">取消</button>
          </div>
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr className="border-b text-gray-500 text-xs">
            <th className="py-2 px-3 text-left">名称</th><th className="py-2 px-3 text-left">地址</th><th className="py-2 px-3 text-left">联系人</th><th className="py-2 px-3 text-left">负责人</th><th className="py-2 px-3">操作</th>
          </tr></thead>
          <tbody>
            {canteens.map((c, i) => (
              <tr key={i} className="border-b last:border-0 hover:bg-gray-50">
                <td className="py-2 px-3">{c.name as string}</td>
                <td className="py-2 px-3 text-gray-500">{(c.address as string) || '-'}</td>
                <td className="py-2 px-3 text-gray-500">{(c.contact_name as string) || '-'} {(c.contact_phone as string) || ''}</td>
                <td className="py-2 px-3">{String(users.find(u => u.id === (c.manager_id as string))?.real_name || '-')}</td>
                <td className="py-2 px-3">
                  <div className="flex gap-2">
                    <button onClick={() => handleEdit(c)} className="text-xs text-blue-600 hover:underline">编辑</button>
                    <button onClick={() => handleDelete(c.id as string)} className="text-xs text-red-600 hover:underline">删除</button>
                  </div>
                </td>
              </tr>
            ))}
            {canteens.length === 0 && <tr><td colSpan={5} className="py-6 text-center text-gray-400">暂无食堂</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════
   STALL MANAGER
   ═══════════════════════════════════════════ */
function StallManager({ user }: { user: UserInfo }) {
  const [canteens, setCanteens] = useState<{ id: string; name: string }[]>([]);
  const [selectedCanteen, setSelectedCanteen] = useState('');
  const [stalls, setStalls] = useState<Record<string, unknown>[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', has_delivery: false, has_takeout: false, contact_name: '', contact_phone: '' });

  useEffect(() => {
    api<{ id: string; name: string }[]>('/api/dropdown/canteens').then(r => {
      if (r.success && r.data) {
        setCanteens(r.data);
        if (r.data.length === 1 || (user.role_code === 'CANTEEN_MANAGER' && user.org_id)) {
          const match = r.data.find(c => c.id === (user.org_id || r.data![0].id));
          if (match) setSelectedCanteen(match.id);
        } else if (r.data.length) setSelectedCanteen(r.data[0].id);
      }
    });
  }, [user]);

  const loadStalls = useCallback(async () => {
    if (!selectedCanteen) return;
    const r = await api<Record<string, unknown>[]>(`/api/canteens/${selectedCanteen}/stalls`);
    if (r.success && r.data) setStalls(r.data);
  }, [selectedCanteen]);

  useEffect(() => { loadStalls(); }, [loadStalls]);

  const handleSubmit = async () => {
    if (!form.name) { alert('档口名称必填'); return; }
    const body = { name: form.name, has_delivery: form.has_delivery, has_takeout: form.has_takeout, contact_name: form.contact_name || null, contact_phone: form.contact_phone || null };
    const r = editId
      ? await api(`/api/stalls/${editId}`, { method: 'PUT', body: JSON.stringify(body) })
      : await api(`/api/canteens/${selectedCanteen}/stalls`, { method: 'POST', body: JSON.stringify(body) });
    if (r.success) { setShowForm(false); setEditId(null); setForm({ name: '', has_delivery: false, has_takeout: false, contact_name: '', contact_phone: '' }); loadStalls(); }
    else alert(r.error);
  };

  const handleEdit = (s: Record<string, unknown>) => {
    setEditId(s.id as string);
    setForm({ name: (s.name as string) || '', has_delivery: !!s.has_delivery, has_takeout: !!s.has_takeout, contact_name: (s.contact_name as string) || '', contact_phone: (s.contact_phone as string) || '' });
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('确认删除此档口？')) return;
    const r = await api(`/api/stalls/${id}`, { method: 'DELETE' });
    if (r.success) loadStalls();
    else alert(r.error);
  };

  return (
    <div className="bg-white rounded-xl p-4 md:p-6 shadow-sm border">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-gray-700">档口管理</h3>
        <button onClick={() => { setShowForm(!showForm); setEditId(null); setForm({ name: '', has_delivery: false, has_takeout: false, contact_name: '', contact_phone: '' }); }} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 flex items-center gap-1">{Icons.plus}新增</button>
      </div>
      <div className="mb-4">
        <select value={selectedCanteen} onChange={e => setSelectedCanteen(e.target.value)} disabled={user.role_code === 'CANTEEN_MANAGER'} className="px-3 py-2 border rounded-lg text-sm disabled:bg-gray-100">
          {canteens.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>
      {showForm && (
        <div className="bg-gray-50 rounded-lg p-4 mb-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
          <input placeholder="档口名称 *" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="px-3 py-2 border rounded-lg text-sm" />
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.has_delivery} onChange={e => setForm(f => ({ ...f, has_delivery: e.target.checked }))} />外送</label>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.has_takeout} onChange={e => setForm(f => ({ ...f, has_takeout: e.target.checked }))} />外卖</label>
          </div>
          <input placeholder="联系人" value={form.contact_name} onChange={e => setForm(f => ({ ...f, contact_name: e.target.value }))} className="px-3 py-2 border rounded-lg text-sm" />
          <input placeholder="联系电话" value={form.contact_phone} onChange={e => setForm(f => ({ ...f, contact_phone: e.target.value }))} className="px-3 py-2 border rounded-lg text-sm" />
          <div className="flex gap-2">
            <button onClick={handleSubmit} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm">{editId ? '保存' : '创建'}</button>
            <button onClick={() => { setShowForm(false); setEditId(null); }} className="px-4 py-2 border rounded-lg text-sm text-gray-600">取消</button>
          </div>
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr className="border-b text-gray-500 text-xs">
            <th className="py-2 px-3 text-left">名称</th><th className="py-2 px-3 text-center">外送</th><th className="py-2 px-3 text-center">外卖</th><th className="py-2 px-3 text-left">联系人</th><th className="py-2 px-3">操作</th>
          </tr></thead>
          <tbody>
            {stalls.map((s, i) => (
              <tr key={i} className="border-b last:border-0 hover:bg-gray-50">
                <td className="py-2 px-3">{s.name as string}</td>
                <td className="py-2 px-3 text-center">{s.has_delivery ? '✓' : '-'}</td>
                <td className="py-2 px-3 text-center">{s.has_takeout ? '✓' : '-'}</td>
                <td className="py-2 px-3 text-gray-500">{(s.contact_name as string) || '-'}</td>
                <td className="py-2 px-3">
                  <div className="flex gap-2">
                    <button onClick={() => handleEdit(s)} className="text-xs text-blue-600 hover:underline">编辑</button>
                    <button onClick={() => handleDelete(s.id as string)} className="text-xs text-red-600 hover:underline">删除</button>
                  </div>
                </td>
              </tr>
            ))}
            {stalls.length === 0 && <tr><td colSpan={5} className="py-6 text-center text-gray-400">暂无档口</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════
   MEAL TYPE MANAGER
   ═══════════════════════════════════════════ */
function MealTypeManager({ user }: { user: UserInfo }) {
  const [canteens, setCanteens] = useState<{ id: string; name: string }[]>([]);
  const [selectedCanteen, setSelectedCanteen] = useState('');
  const [records, setRecords] = useState<Record<string, unknown>[]>([]);
  const [form, setForm] = useState({ name: '' });

  useEffect(() => {
    api<{ id: string; name: string }[]>('/api/dropdown/canteens').then(r => {
      if (r.success && r.data) {
        setCanteens(r.data);
        if (r.data.length) setSelectedCanteen(user.role_code === 'CANTEEN_MANAGER' && user.org_id ? user.org_id : r.data[0].id);
      }
    });
  }, [user]);

  const load = useCallback(async () => {
    if (!selectedCanteen) return;
    const r = await api<Record<string, unknown>[]>(`/api/meal-types?canteen_id=${selectedCanteen}`);
    if (r.success && r.data) setRecords(r.data);
  }, [selectedCanteen]);

  useEffect(() => { load(); }, [load]);

  const handleAdd = async () => {
    if (!form.name) { alert('餐别名称必填'); return; }
    const r = await api('/api/meal-types', { method: 'POST', body: JSON.stringify({ canteen_id: selectedCanteen, name: form.name }) });
    if (r.success) { setForm({ name: '' }); load(); }
    else alert(r.error);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('确认删除？')) return;
    const r = await api(`/api/meal-types/${id}`, { method: 'DELETE' });
    if (r.success) load();
    else alert(r.error);
  };

  return (
    <div className="bg-white rounded-xl p-4 md:p-6 shadow-sm border">
      <h3 className="text-sm font-semibold text-gray-700 mb-4">餐别管理</h3>
      <div className="mb-4">
        <select value={selectedCanteen} onChange={e => setSelectedCanteen(e.target.value)} disabled={user.role_code === 'CANTEEN_MANAGER'} className="px-3 py-2 border rounded-lg text-sm disabled:bg-gray-100">
          {canteens.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>
      <div className="flex gap-2 mb-4">
        <input placeholder="餐别名称 *" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="px-3 py-2 border rounded-lg text-sm flex-1" />
        <button onClick={handleAdd} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm">添加</button>
      </div>
      <div className="space-y-2">
        {records.map(r => (
          <div key={r.id as string} className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-lg">
            <span className="text-sm">{r.name as string}</span>
            <button onClick={() => handleDelete(r.id as string)} className="text-xs text-red-600 hover:underline">删除</button>
          </div>
        ))}
        {records.length === 0 && <div className="text-center text-gray-400 py-6 text-sm">暂无餐别</div>}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════
   ACCOUNT MANAGER (with self password edit)
   ═══════════════════════════════════════════ */
function AccountManager({ user }: { user: UserInfo }) {
  const [users, setUsers] = useState<Record<string, unknown>[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [newUser, setNewUser] = useState({ username: '', real_name: '', password: '', role_code: 'CANTEEN_MANAGER', org_id: '' });
  const [canteens, setCanteens] = useState<{ id: string; name: string }[]>([]);
  const [companies, setCompanies] = useState<{ id: string; name: string }[]>([]);
  const [selfPwd, setSelfPwd] = useState({ old: '', new: '', confirm: '' });
  const [showPwdForm, setShowPwdForm] = useState(false);

  const loadUsers = useCallback(async () => {
    const r = await api<Record<string, unknown>[]>('/api/users');
    if (r.success && r.data) setUsers(r.data);
  }, []);

  useEffect(() => {
    loadUsers();
    api<{ id: string; name: string }[]>('/api/dropdown/canteens').then(r => { if (r.success && r.data) setCanteens(r.data); });
    api<{ id: string; name: string }[]>('/api/companies').then(r => { if (r.success && r.data) setCompanies(r.data); });
  }, [loadUsers]);

  const handleCreate = async () => {
    const r = await api('/api/users', { method: 'POST', body: JSON.stringify(newUser) });
    if (r.success) { alert('创建成功'); setShowCreate(false); loadUsers(); }
    else alert(r.error);
  };

  const handleDisable = async (userId: string, disabled: boolean) => {
    const r = await api(`/api/settings/users/${userId}/disable`, { method: 'PUT', body: JSON.stringify({ is_disabled: disabled }) });
    if (r.success) loadUsers();
    else alert(r.error);
  };

  const handleResetPwd = async (userId: string) => {
    const r = await api<{ new_password: string }>(`/api/settings/users/${userId}/reset-password`, { method: 'PUT' });
    if (r.success) alert(`密码已重置为: ${r.data!.new_password}`);
    else alert(r.error);
  };

  const handleSelfPwd = async () => {
    if (selfPwd.new !== selfPwd.confirm) { alert('两次密码不一致'); return; }
    const r = await api('/api/settings/users/self/password', { method: 'PUT', body: JSON.stringify({ old_password: selfPwd.old, new_password: selfPwd.new }) });
    if (r.success) { alert('密码修改成功'); setShowPwdForm(false); setSelfPwd({ old: '', new: '', confirm: '' }); }
    else alert(r.error);
  };

  const canCreate = user.role_code === 'SYSTEM_DEVELOPER' || user.role_code === 'COMPANY_MANAGER';

  return (
    <div className="space-y-4">
      {/* Self password change */}
      <div className="bg-white rounded-xl p-4 md:p-6 shadow-sm border">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-gray-700">我的账号</h3>
          <button onClick={() => setShowPwdForm(!showPwdForm)} className="text-sm text-blue-600 hover:underline">修改密码</button>
        </div>
        {user.account_expires_at && (
          <p className="text-xs text-gray-500">账号有效期至: {user.account_expires_at.slice(0, 10)}</p>
        )}
        {showPwdForm && (
          <div className="mt-3 space-y-2 max-w-sm">
            <input type="password" placeholder="旧密码" value={selfPwd.old} onChange={e => setSelfPwd(f => ({ ...f, old: e.target.value }))} className="w-full px-3 py-2 border rounded-lg text-sm" />
            <input type="password" placeholder="新密码" value={selfPwd.new} onChange={e => setSelfPwd(f => ({ ...f, new: e.target.value }))} className="w-full px-3 py-2 border rounded-lg text-sm" />
            <input type="password" placeholder="确认新密码" value={selfPwd.confirm} onChange={e => setSelfPwd(f => ({ ...f, confirm: e.target.value }))} className="w-full px-3 py-2 border rounded-lg text-sm" />
            <button onClick={handleSelfPwd} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm">确认修改</button>
          </div>
        )}
      </div>

      {/* User list (only for managers) */}
      {canCreate && (
        <div className="bg-white rounded-xl p-4 md:p-6 shadow-sm border">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-gray-700">用户管理</h3>
            <button onClick={() => setShowCreate(!showCreate)} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 flex items-center gap-1">{Icons.plus}新建账号</button>
          </div>
          {showCreate && (
            <div className="bg-gray-50 rounded-lg p-4 mb-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
              <input placeholder="用户名 *" value={newUser.username} onChange={e => setNewUser(f => ({ ...f, username: e.target.value }))} className="px-3 py-2 border rounded-lg text-sm" />
              <input placeholder="姓名 *" value={newUser.real_name} onChange={e => setNewUser(f => ({ ...f, real_name: e.target.value }))} className="px-3 py-2 border rounded-lg text-sm" />
              <input type="password" placeholder="密码 *" value={newUser.password} onChange={e => setNewUser(f => ({ ...f, password: e.target.value }))} className="px-3 py-2 border rounded-lg text-sm" />
              <select value={newUser.role_code} onChange={e => setNewUser(f => ({ ...f, role_code: e.target.value, org_id: '' }))} className="px-3 py-2 border rounded-lg text-sm">
                {user.role_code === 'SYSTEM_DEVELOPER' && <option value="COMPANY_MANAGER">公司负责人</option>}
                <option value="CANTEEN_MANAGER">食堂负责人</option>
                <option value="STALL_MANAGER">档口负责人</option>
              </select>
              {newUser.role_code === 'CANTEEN_MANAGER' && (
                <select value={newUser.org_id} onChange={e => setNewUser(f => ({ ...f, org_id: e.target.value }))} className="px-3 py-2 border rounded-lg text-sm">
                  <option value="">选择食堂</option>
                  {canteens.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              )}
              {newUser.role_code === 'STALL_MANAGER' && (
                <select value={newUser.org_id} onChange={e => setNewUser(f => ({ ...f, org_id: e.target.value }))} className="px-3 py-2 border rounded-lg text-sm">
                  <option value="">选择档口</option>
                </select>
              )}
              {newUser.role_code === 'COMPANY_MANAGER' && (
                <select value={newUser.org_id} onChange={e => setNewUser(f => ({ ...f, org_id: e.target.value }))} className="px-3 py-2 border rounded-lg text-sm">
                  <option value="">选择公司</option>
                  {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              )}
              <div className="flex gap-2">
                <button onClick={handleCreate} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm">确认创建</button>
                <button onClick={() => setShowCreate(false)} className="px-4 py-2 border rounded-lg text-sm text-gray-600">取消</button>
              </div>
            </div>
          )}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b text-gray-500 text-xs">
                <th className="py-2 px-3 text-left">用户名</th><th className="py-2 px-3 text-left">姓名</th><th className="py-2 px-3 text-left">角色</th><th className="py-2 px-3 text-left">状态</th><th className="py-2 px-3 text-left">有效期</th><th className="py-2 px-3 text-left">操作</th>
              </tr></thead>
              <tbody>
                {users.map((u, i) => (
                  <tr key={i} className="border-b last:border-0 hover:bg-gray-50">
                    <td className="py-2 px-3">{u.username as string}</td>
                    <td className="py-2 px-3">{u.real_name as string}</td>
                    <td className="py-2 px-3">{ROLE_LABELS[u.role_code as string] || (u.role_code as string)}</td>
                    <td className="py-2 px-3"><span className={`px-2 py-0.5 rounded text-xs ${u.is_disabled ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>{u.is_disabled ? '已禁用' : '正常'}</span></td>
                    <td className="py-2 px-3 text-xs">{(u.account_expires_at as string)?.slice(0, 10) || '-'}</td>
                    <td className="py-2 px-3">
                      <div className="flex gap-2">
                        <button onClick={() => handleDisable(u.id as string, !u.is_disabled)} className="text-xs text-amber-600 hover:underline">{u.is_disabled ? '启用' : '禁用'}</button>
                        <button onClick={() => handleResetPwd(u.id as string)} className="text-xs text-blue-600 hover:underline">重置密码</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════
   FIXED EXPENSES (with start/end dates & custom category)
   ═══════════════════════════════════════════ */
function FixedExpenses({ user }: { user: UserInfo }) {
  const [canteens, setCanteens] = useState<{ id: string; name: string }[]>([]);
  const [records, setRecords] = useState<Record<string, unknown>[]>([]);
  const [selectedCanteen, setSelectedCanteen] = useState('');
  const [form, setForm] = useState({ category: '', custom_category: '', amount: '', note: '', start_date: getLocalDate(), end_date: '' });

  useEffect(() => {
    api<{ id: string; name: string }[]>('/api/dropdown/canteens').then(r => {
      if (r.success && r.data) { setCanteens(r.data); if (r.data.length) setSelectedCanteen(r.data[0].id); }
    });
  }, []);

  const loadFixed = useCallback(async () => {
    if (!selectedCanteen) return;
    const r = await api<Record<string, unknown>[]>(`/api/settings/fixed-expenses?canteen_id=${selectedCanteen}`);
    if (r.success && r.data) setRecords(r.data);
  }, [selectedCanteen]);

  useEffect(() => { loadFixed(); }, [loadFixed]);

  const handleAdd = async () => {
    const categoryName = form.category === '自定义' ? form.custom_category : form.category;
    if (!selectedCanteen || !categoryName || !form.amount) { alert('请填写必填字段'); return; }
    const r = await api('/api/settings/fixed-expenses', {
      method: 'POST',
      body: JSON.stringify({ canteen_id: selectedCanteen, category: categoryName, amount: parseFloat(form.amount), note: form.note || null, start_date: form.start_date || null, end_date: form.end_date || null }),
    });
    if (r.success) { setForm({ category: '', custom_category: '', amount: '', note: '', start_date: getLocalDate(), end_date: '' }); loadFixed(); }
    else alert(r.error);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('确认删除？')) return;
    const r = await api(`/api/settings/fixed-expenses/${id}`, { method: 'DELETE' });
    if (r.success) loadFixed();
    else alert(r.error);
  };

  return (
    <div className="bg-white rounded-xl p-4 md:p-6 shadow-sm border">
      <h3 className="text-sm font-semibold text-gray-700 mb-4">固定支出配置</h3>
      <div className="mb-4">
        <select value={selectedCanteen} onChange={e => setSelectedCanteen(e.target.value)} className="px-3 py-2 border rounded-lg text-sm">
          {canteens.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-4">
        <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} className="px-3 py-2 border rounded-lg text-sm">
          <option value="">选择费用类型</option>
          {EXPENSE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          <option value="自定义">自定义...</option>
        </select>
        {form.category === '自定义' && (
          <input placeholder="自定义类型名称 *" value={form.custom_category} onChange={e => setForm(f => ({ ...f, custom_category: e.target.value }))} className="px-3 py-2 border rounded-lg text-sm" />
        )}
        <input type="number" step="0.01" placeholder="金额 *" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} className="px-3 py-2 border rounded-lg text-sm" />
        <input type="date" value={form.start_date} onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))} className="px-3 py-2 border rounded-lg text-sm" title="起始时间" />
        <input type="date" value={form.end_date} onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))} className="px-3 py-2 border rounded-lg text-sm" title="结束时间（可选）" />
        <input placeholder="备注" value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))} className="px-3 py-2 border rounded-lg text-sm" />
        <button onClick={handleAdd} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm">添加</button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr className="border-b text-gray-500 text-xs">
            <th className="py-2 px-3 text-left">费用类型</th><th className="py-2 px-3 text-right">金额</th><th className="py-2 px-3 text-left">起始时间</th><th className="py-2 px-3 text-left">结束时间</th><th className="py-2 px-3 text-left">备注</th><th className="py-2 px-3">操作</th>
          </tr></thead>
          <tbody>
            {records.map((r, i) => (
              <tr key={i} className="border-b last:border-0">
                <td className="py-2 px-3">{r.category as string}</td>
                <td className="py-2 px-3 text-right">¥{r.amount as string}</td>
                <td className="py-2 px-3">{(r.start_date as string)?.slice(0, 10) || '-'}</td>
                <td className="py-2 px-3">{(r.end_date as string)?.slice(0, 10) || '-'}</td>
                <td className="py-2 px-3 text-gray-500">{(r.note as string) || '-'}</td>
                <td className="py-2 px-3 text-center"><button onClick={() => handleDelete(r.id as string)} className="text-xs text-red-600 hover:underline">删除</button></td>
              </tr>
            ))}
            {records.length === 0 && <tr><td colSpan={6} className="py-6 text-center text-gray-400">暂无固定支出</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════
   PRODUCT MANAGER (categories -> products -> specs)
   ═══════════════════════════════════════════ */
function ProductManager({ user }: { user: UserInfo }) {
  const [categories, setCategories] = useState<Record<string, unknown>[]>([]);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [products, setProducts] = useState<Record<string, unknown>[]>([]);
  const [selectedProduct, setSelectedProduct] = useState('');
  const [specs, setSpecs] = useState<Record<string, unknown>[]>([]);

  const [newCat, setNewCat] = useState('');
  const [newProd, setNewProd] = useState('');
  const [newSpec, setNewSpec] = useState('');

  const loadCategories = useCallback(async () => {
    const r = await api<Record<string, unknown>[]>('/api/settings/products/categories');
    if (r.success && r.data) setCategories(r.data);
  }, []);

  useEffect(() => { loadCategories(); }, [loadCategories]);

  useEffect(() => {
    if (!selectedCategory) { setProducts([]); return; }
    api<Record<string, unknown>[]>(`/api/settings/products?category_id=${selectedCategory}`).then(r => {
      if (r.success && r.data) setProducts(r.data);
    });
  }, [selectedCategory]);

  useEffect(() => {
    if (!selectedProduct) { setSpecs([]); return; }
    api<Record<string, unknown>[]>(`/api/settings/products/specs?product_id=${selectedProduct}`).then(r => {
      if (r.success && r.data) setSpecs(r.data);
    });
  }, [selectedProduct]);

  const handleAddCat = async () => {
    if (!newCat) return;
    const r = await api('/api/settings/products/categories', { method: 'POST', body: JSON.stringify({ name: newCat }) });
    if (r.success) { setNewCat(''); loadCategories(); }
    else alert(r.error);
  };

  const handleAddProd = async () => {
    if (!newProd || !selectedCategory) return;
    const r = await api('/api/settings/products', { method: 'POST', body: JSON.stringify({ category_id: selectedCategory, name: newProd }) });
    if (r.success) { setNewProd(''); }
    else alert(r.error);
    // reload
    const r2 = await api<Record<string, unknown>[]>(`/api/settings/products?category_id=${selectedCategory}`);
    if (r2.success && r2.data) setProducts(r2.data);
  };

  const handleAddSpec = async () => {
    if (!newSpec || !selectedProduct) return;
    const r = await api('/api/settings/products/specs', { method: 'POST', body: JSON.stringify({ product_id: selectedProduct, name: newSpec }) });
    if (r.success) { setNewSpec(''); }
    else alert(r.error);
    const r2 = await api<Record<string, unknown>[]>(`/api/settings/products/specs?product_id=${selectedProduct}`);
    if (r2.success && r2.data) setSpecs(r2.data);
  };

  const handleDeleteCat = async (id: string) => { if (!confirm('删除品类将同时删除其下所有商品和规格，确认？')) return; const r = await api(`/api/settings/products/categories/${id}`, { method: 'DELETE' }); if (r.success) { loadCategories(); setSelectedCategory(''); } else alert(r.error); };
  const handleDeleteProd = async (id: string) => { if (!confirm('确认删除？')) return; const r = await api(`/api/settings/products/${id}`, { method: 'DELETE' }); if (r.success) { const r2 = await api<Record<string, unknown>[]>(`/api/settings/products?category_id=${selectedCategory}`); if (r2.success && r2.data) setProducts(r2.data); } else alert(r.error); };
  const handleDeleteSpec = async (id: string) => { if (!confirm('确认删除？')) return; const r = await api(`/api/settings/products/specs/${id}`, { method: 'DELETE' }); if (r.success) { const r2 = await api<Record<string, unknown>[]>(`/api/settings/products/specs?product_id=${selectedProduct}`); if (r2.success && r2.data) setSpecs(r2.data); } else alert(r.error); };

  return (
    <div className="space-y-4">
      {/* Categories */}
      <div className="bg-white rounded-xl p-4 md:p-6 shadow-sm border">
        <h3 className="text-sm font-semibold text-gray-700 mb-4">商品大类</h3>
        <div className="flex gap-2 mb-3">
          <input placeholder="大类名称 *" value={newCat} onChange={e => setNewCat(e.target.value)} className="px-3 py-2 border rounded-lg text-sm flex-1" />
          <button onClick={handleAddCat} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm">添加</button>
        </div>
        <div className="space-y-2">
          {categories.map(c => (
            <div key={c.id as string} className={`flex items-center justify-between py-2 px-3 rounded-lg cursor-pointer ${selectedCategory === c.id ? 'bg-blue-50 border border-blue-200' : 'bg-gray-50 hover:bg-gray-100'}`} onClick={() => { setSelectedCategory(c.id as string); setSelectedProduct(''); }}>
              <span className="text-sm font-medium">{c.name as string}</span>
              <button onClick={e => { e.stopPropagation(); handleDeleteCat(c.id as string); }} className="text-xs text-red-600 hover:underline">删除</button>
            </div>
          ))}
          {categories.length === 0 && <div className="text-center text-gray-400 py-4 text-sm">暂无大类</div>}
        </div>
      </div>

      {/* Products */}
      {selectedCategory && (
        <div className="bg-white rounded-xl p-4 md:p-6 shadow-sm border">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">商品名称</h3>
          <div className="flex gap-2 mb-3">
            <input placeholder="商品名称 *" value={newProd} onChange={e => setNewProd(e.target.value)} className="px-3 py-2 border rounded-lg text-sm flex-1" />
            <button onClick={handleAddProd} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm">添加</button>
          </div>
          <div className="space-y-2">
            {products.map(p => (
              <div key={p.id as string} className={`flex items-center justify-between py-2 px-3 rounded-lg cursor-pointer ${selectedProduct === p.id ? 'bg-blue-50 border border-blue-200' : 'bg-gray-50 hover:bg-gray-100'}`} onClick={() => setSelectedProduct(p.id as string)}>
                <span className="text-sm">{p.name as string}</span>
                <button onClick={e => { e.stopPropagation(); handleDeleteProd(p.id as string); }} className="text-xs text-red-600 hover:underline">删除</button>
              </div>
            ))}
            {products.length === 0 && <div className="text-center text-gray-400 py-4 text-sm">暂无商品</div>}
          </div>
        </div>
      )}

      {/* Specs */}
      {selectedProduct && (
        <div className="bg-white rounded-xl p-4 md:p-6 shadow-sm border">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">商品规格</h3>
          <div className="flex gap-2 mb-3">
            <input placeholder="规格名称（如：斤、千克、箱、包）*" value={newSpec} onChange={e => setNewSpec(e.target.value)} className="px-3 py-2 border rounded-lg text-sm flex-1" />
            <button onClick={handleAddSpec} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm">添加</button>
          </div>
          <div className="flex flex-wrap gap-2">
            {specs.map(s => (
              <div key={s.id as string} className="flex items-center gap-2 px-3 py-1.5 bg-gray-50 rounded-full">
                <span className="text-sm">{s.name as string}</span>
                <button onClick={() => handleDeleteSpec(s.id as string)} className="text-red-400 hover:text-red-600">{Icons.trash}</button>
              </div>
            ))}
            {specs.length === 0 && <div className="text-gray-400 text-sm">暂无规格</div>}
          </div>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════
   OPERATION LOGS
   ═══════════════════════════════════════════ */
function OperationLogs() {
  const [logs, setLogs] = useState<Record<string, unknown>[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);

  useEffect(() => {
    api<{ records: Record<string, unknown>[]; total: number }>(`/api/settings/operation-logs?page=${page}&page_size=20`).then(r => {
      if (r.success && r.data) { setLogs(r.data.records); setTotal(r.data.total); }
    });
  }, [page]);

  return (
    <div className="bg-white rounded-xl p-4 md:p-6 shadow-sm border">
      <h3 className="text-sm font-semibold text-gray-700 mb-3">操作日志</h3>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr className="border-b text-gray-500 text-xs">
            <th className="py-2 px-3 text-left">时间</th><th className="py-2 px-3 text-left">用户</th><th className="py-2 px-3 text-left">操作</th><th className="py-2 px-3 text-left">详情</th>
          </tr></thead>
          <tbody>
            {logs.map((l, i) => (
              <tr key={i} className="border-b last:border-0 hover:bg-gray-50">
                <td className="py-2 px-3 text-xs">{(l.created_at as string)?.slice(0, 19)}</td>
                <td className="py-2 px-3">{l.username as string}</td>
                <td className="py-2 px-3">{l.action as string}</td>
                <td className="py-2 px-3 text-gray-500 max-w-xs truncate">{(l.details as string) || '-'}</td>
              </tr>
            ))}
            {logs.length === 0 && <tr><td colSpan={4} className="py-6 text-center text-gray-400">暂无日志</td></tr>}
          </tbody>
        </table>
      </div>
      {total > 20 && (
        <div className="mt-3 flex gap-2 justify-center">
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="px-3 py-1 border rounded text-sm disabled:opacity-50">上一页</button>
          <span className="px-3 py-1 text-sm text-gray-600">{page} / {Math.ceil(total / 20)}</span>
          <button onClick={() => setPage(p => p + 1)} disabled={page >= Math.ceil(total / 20)} className="px-3 py-1 border rounded text-sm disabled:opacity-50">下一页</button>
        </div>
      )}
    </div>
  );
}
