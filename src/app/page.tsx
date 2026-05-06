'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, Legend,
} from 'recharts';

/* ─── Types ─── */
interface UserInfo {
  id: string;
  username: string;
  real_name: string;
  role_code: string;
  role_label: string;
  org_id: string | null;
  account_expires_at?: string | null;
}
interface ApiResp<T> { success: boolean; data?: T; error?: string; message?: string }

const ROLE_LABELS: Record<string, string> = {
  SYSTEM_DEVELOPER: '网站开发者',
  COMPANY_MANAGER: '公司负责人',
  CANTEEN_MANAGER: '食堂负责人',
  STALL_MANAGER: '档口负责人',
  REGULAR_USER: '普通用户',
};
const EXPENSE_CATEGORIES = ['食材采购', '电费', '水费', '人工', '房租', '折旧', '其他'];
const MEAL_PRESETS = ['早餐', '午餐', '晚餐', '夜宵'];
const REVENUE_PRESETS = ['堂食', '外送', '外卖', '其他'];

const CHART_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4'];

/* ─── API Helper ─── */
const API_BASE = '';
async function api<T>(path: string, opts?: RequestInit): Promise<ApiResp<T>> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : '';
  const res = await fetch(`${API_BASE}${path}`, {
    ...opts,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...opts?.headers },
  });
  return res.json();
}

/* ─── Icons (inline SVG) ─── */
const Icons = {
  dashboard: <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>,
  revenue: <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>,
  expense: <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12V7H5a2 2 0 0 1 0-4h14v4"/><path d="M3 5v14a2 2 0 0 0 2 2h16v-5"/><path d="M18 12a2 2 0 0 0 0 4h4v-4Z"/></svg>,
  settings: <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>,
  logout: <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>,
  menu: <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="4" x2="20" y1="12" y2="12"/><line x1="4" x2="20" y1="6" y2="6"/><line x1="4" x2="20" y1="18" y2="18"/></svg>,
  download: <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/></svg>,
};

type Tab = 'dashboard' | 'revenue' | 'expense' | 'settings';

/* ═══════════════════════════════════════════
   MAIN APP COMPONENT
   ═══════════════════════════════════════════ */
export default function CanteenApp() {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<UserInfo | null>(null);
  const [tab, setTab] = useState<Tab>('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    const saved = localStorage.getItem('token');
    if (saved) {
      setToken(saved);
      api<UserInfo>('/api/auth/me').then(r => {
        if (r.success && r.data) setUser(r.data);
        else { localStorage.removeItem('token'); setToken(null); }
      });
    }
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('token');
    setToken(null);
    setUser(null);
  }, []);

  if (!mounted) return null;

  if (!token || !user) return <LoginPage onLogin={(t, u) => { setToken(t); setUser(u); }} />;

  const navItems: { key: Tab; label: string; icon: React.ReactNode; roles: string[] }[] = [
    { key: 'dashboard', label: '仪表盘', icon: Icons.dashboard, roles: ['SYSTEM_DEVELOPER', 'COMPANY_MANAGER', 'CANTEEN_MANAGER', 'STALL_MANAGER'] },
    { key: 'revenue', label: '营收录入', icon: Icons.revenue, roles: ['SYSTEM_DEVELOPER', 'COMPANY_MANAGER', 'CANTEEN_MANAGER', 'STALL_MANAGER'] },
    { key: 'expense', label: '支出录入', icon: Icons.expense, roles: ['SYSTEM_DEVELOPER', 'COMPANY_MANAGER', 'CANTEEN_MANAGER'] },
    { key: 'settings', label: '基础设置', icon: Icons.settings, roles: ['SYSTEM_DEVELOPER', 'COMPANY_MANAGER'] },
  ];

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Mobile overlay */}
      {sidebarOpen && <div className="fixed inset-0 bg-black/30 z-30 lg:hidden" onClick={() => setSidebarOpen(false)} />}

      {/* Sidebar */}
      <aside className={`fixed lg:static inset-y-0 left-0 z-40 w-60 bg-white border-r shadow-sm transition-transform duration-200 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'} flex flex-col`}>
        <div className="p-4 border-b">
          <h1 className="text-lg font-bold text-gray-800">食堂管理系统</h1>
          <p className="text-xs text-gray-500 mt-1">{ROLE_LABELS[user.role_code] || user.role_code}</p>
        </div>
        <nav className="flex-1 p-2 space-y-1">
          {navItems.filter(n => n.roles.includes(user.role_code)).map(n => (
            <button key={n.key} onClick={() => { setTab(n.key); setSidebarOpen(false); }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${tab === n.key ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-600 hover:bg-gray-100'}`}>
              {n.icon}{n.label}
            </button>
          ))}
        </nav>
        <div className="p-3 border-t">
          <div className="text-xs text-gray-500 mb-2 truncate">{user.real_name} ({user.username})</div>
          {user.account_expires_at && (
            <div className="text-xs text-amber-600 mb-2">有效期至: {user.account_expires_at.slice(0, 10)}</div>
          )}
          <button onClick={logout} className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-red-600 hover:bg-red-50 transition-colors">
            {Icons.logout}退出登录
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0">
        {/* Top Bar */}
        <header className="h-14 bg-white border-b flex items-center px-4 gap-3 shrink-0">
          <button onClick={() => setSidebarOpen(true)} className="lg:hidden">{Icons.menu}</button>
          <h2 className="text-base font-semibold text-gray-800">
            {navItems.find(n => n.key === tab)?.label || '仪表盘'}
          </h2>
        </header>

        {/* Page Content */}
        <div className="flex-1 overflow-y-auto p-3 md:p-6">
          {tab === 'dashboard' && <DashboardPage user={user} />}
          {tab === 'revenue' && <RevenuePage user={user} />}
          {tab === 'expense' && <ExpensePage user={user} />}
          {tab === 'settings' && <SettingsPage user={user} />}
        </div>
      </main>
    </div>
  );
}

/* ═══════════════════════════════════════════
   LOGIN PAGE
   ═══════════════════════════════════════════ */
function LoginPage({ onLogin }: { onLogin: (token: string, user: UserInfo) => void }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const quickLogins = [
    { label: '开发者', u: 'dev', p: 'dev123456' },
    { label: '公司负责人', u: 'company_mgr', p: 'company123456' },
    { label: '食堂负责人', u: 'canteen_mgr', p: 'canteen123456' },
    { label: '档口负责人', u: 'stall_mgr', p: 'stall123456' },
  ];

  const handleLogin = async (u?: string, p?: string) => {
    const un = u || username;
    const pw = p || password;
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: un, password: pw }),
      });
      const data = await res.json();
      if (data.success) {
        localStorage.setItem('token', data.data.token);
        onLogin(data.data.token, data.data.user);
      } else {
        setError(data.error || '登录失败');
      }
    } catch { setError('网络错误'); }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="w-full max-w-sm">
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <h1 className="text-2xl font-bold text-center text-gray-800 mb-1">食堂管理系统</h1>
          <p className="text-sm text-gray-500 text-center mb-6">请使用您的账号登录系统</p>
          {error && <div className="bg-red-50 text-red-600 text-sm p-3 rounded-lg mb-4">{error}</div>}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">用户名</label>
              <input value={username} onChange={e => setUsername(e.target.value)} className="w-full px-4 py-2.5 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500" placeholder="请输入用户名" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">密码</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} className="w-full px-4 py-2.5 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500" placeholder="请输入密码" />
            </div>
            <button onClick={() => handleLogin()} disabled={loading} className="w-full py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
              {loading ? '登录中...' : '登录'}
            </button>
          </div>
          <div className="mt-6 pt-4 border-t">
            <p className="text-xs text-gray-500 mb-2">快速登录（测试账号）：</p>
            <div className="grid grid-cols-2 gap-2">
              {quickLogins.map(q => (
                <button key={q.u} onClick={() => handleLogin(q.u, q.p)} className="px-3 py-2 text-xs border rounded-lg hover:bg-gray-50 text-gray-600">
                  {q.label}
                </button>
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
  const [trendDays, setTrendDays] = useState(7);
  const [canteenFilter, setCanteenFilter] = useState('');
  const [canteens, setCanteens] = useState<{ id: string; name: string }[]>([]);

  const loadDashboard = useCallback(async () => {
    const r = await api<Record<string, unknown>>(`/api/dashboard?trend_days=${trendDays}${canteenFilter ? `&canteen_id=${canteenFilter}` : ''}`);
    if (r.success && r.data) setData(r.data);
  }, [trendDays, canteenFilter]);

  useEffect(() => { loadDashboard(); }, [loadDashboard]);

  useEffect(() => {
    api<{ id: string; name: string }[]>('/api/dropdown/canteens').then(r => {
      if (r.success && r.data) setCanteens(r.data);
    });
  }, []);

  if (!data) return <div className="text-center py-20 text-gray-400">加载中...</div>;

  const kpi = data.kpi as { total_revenue: string; total_expense: string; gross_profit: string; gross_margin: string };
  const canteenRevenue = (data.canteen_revenue as { name: string; amount: number }[]) || [];
  const stallRanking = (data.stall_ranking as { name: string; amount: number }[]) || [];
  const revenueTrend = (data.revenue_trend as { date: string; amount: string }[]) || [];
  const expenseComp = (data.expense_composition as { category: string; amount: string }[]) || [];
  const dailyDetail = (data.daily_detail as Record<string, string>[]) || [];
  const profitTrend = (data.profit_trend as { date: string; revenue: string; expense: string; profit: string }[]) || [];

  return (
    <div className="space-y-4 md:space-y-6 max-w-7xl mx-auto">
      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <select value={canteenFilter} onChange={e => setCanteenFilter(e.target.value)} className="px-3 py-2 border rounded-lg text-sm">
          <option value="">全部食堂</option>
          {canteens.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <div className="flex gap-1">
          {[7, 30].map(d => (
            <button key={d} onClick={() => setTrendDays(d)} className={`px-3 py-1.5 text-xs rounded-lg ${trendDays === d ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600'}`}>
              近{d}天
            </button>
          ))}
        </div>
        <button onClick={loadDashboard} className="ml-auto px-3 py-1.5 text-xs bg-gray-100 rounded-lg hover:bg-gray-200">刷新</button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        {[
          { label: '今日总营收', value: `¥${kpi.total_revenue}`, color: 'text-blue-600' },
          { label: '今日总支出', value: `¥${kpi.total_expense}`, color: 'text-red-600' },
          { label: '今日毛利', value: `¥${kpi.gross_profit}`, color: parseFloat(kpi.gross_profit) >= 0 ? 'text-green-600' : 'text-red-600' },
          { label: '毛利率', value: `${kpi.gross_margin}%`, color: 'text-purple-600' },
        ].map(k => (
          <div key={k.label} className="bg-white rounded-xl p-4 shadow-sm border">
            <div className="text-xs text-gray-500 mb-1">{k.label}</div>
            <div className={`text-xl md:text-2xl font-bold ${k.color}`}>{k.value}</div>
          </div>
        ))}
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* 食堂营收对比 */}
        <div className="bg-white rounded-xl p-4 shadow-sm border">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">食堂营收对比</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={canteenRevenue}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v: number) => `¥${v.toFixed(2)}`} />
              <Bar dataKey="amount" fill="#3b82f6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* 档口营收排行 */}
        <div className="bg-white rounded-xl p-4 shadow-sm border">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">档口营收排行 Top5</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={stallRanking} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" tick={{ fontSize: 11 }} />
              <YAxis dataKey="name" type="category" tick={{ fontSize: 11 }} width={80} />
              <Tooltip formatter={(v: number) => `¥${v.toFixed(2)}`} />
              <Bar dataKey="amount" fill="#10b981" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* 营收趋势 */}
        <div className="bg-white rounded-xl p-4 shadow-sm border">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">营收趋势</h3>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={revenueTrend}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v: string) => `¥${parseFloat(v).toFixed(2)}`} />
              <Line type="monotone" dataKey="amount" stroke="#3b82f6" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* 支出构成 */}
        <div className="bg-white rounded-xl p-4 shadow-sm border">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">支出构成</h3>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={expenseComp} dataKey="amount" nameKey="category" cx="50%" cy="50%" outerRadius={80} label={({ category, percent }: { category: string; percent: number }) => `${category} ${(percent * 100).toFixed(0)}%`}>
                {expenseComp.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
              </Pie>
              <Tooltip formatter={(v: string) => `¥${parseFloat(v).toFixed(2)}`} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 毛利趋势 */}
      <div className="bg-white rounded-xl p-4 shadow-sm border">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">毛利趋势</h3>
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={profitTrend}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" tick={{ fontSize: 10 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip />
            <Legend />
            <Line type="monotone" dataKey="revenue" stroke="#3b82f6" name="营收" dot={false} />
            <Line type="monotone" dataKey="expense" stroke="#ef4444" name="支出" dot={false} />
            <Line type="monotone" dataKey="profit" stroke="#10b981" name="毛利" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* 当日明细 */}
      <div className="bg-white rounded-xl p-4 shadow-sm border">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">当日明细</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b text-gray-500 text-xs">
              <th className="py-2 px-3 text-left">食堂</th><th className="py-2 px-3 text-right">营收</th><th className="py-2 px-3 text-right">支出</th><th className="py-2 px-3 text-right">毛利</th><th className="py-2 px-3 text-right">毛利率</th>
            </tr></thead>
            <tbody>
              {dailyDetail.map((r, i) => (
                <tr key={i} className="border-b last:border-0 hover:bg-gray-50">
                  <td className="py-2 px-3">{r.canteen_name}</td>
                  <td className="py-2 px-3 text-right">¥{r.revenue}</td>
                  <td className="py-2 px-3 text-right">¥{r.expense}</td>
                  <td className="py-2 px-3 text-right">¥{r.gross_profit}</td>
                  <td className="py-2 px-3 text-right">{r.gross_margin}%</td>
                </tr>
              ))}
              {dailyDetail.length === 0 && <tr><td colSpan={5} className="py-6 text-center text-gray-400">暂无数据</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════
   REVENUE PAGE
   ═══════════════════════════════════════════ */
function RevenuePage({ user }: { user: UserInfo }) {
  const [canteens, setCanteens] = useState<{ id: string; name: string }[]>([]);
  const [stalls, setStalls] = useState<{ id: string; name: string }[]>([]);
  const [mealTypes, setMealTypes] = useState<{ id: string; name: string }[]>([]);
  const [revenueTypes, setRevenueTypes] = useState<{ id: string; name: string }[]>([]);
  const [records, setRecords] = useState<Record<string, unknown>[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);

  const [form, setForm] = useState({
    canteen_id: '', stall_id: '', meal_type_id: '', revenue_type_id: '',
    record_date: new Date().toISOString().slice(0, 10),
    order_count: '', amount: '', note: '',
  });

  const isStallMgr = user.role_code === 'STALL_MANAGER';
  const isCanteenMgr = user.role_code === 'CANTEEN_MANAGER';

  // Load canteens
  useEffect(() => {
    api<{ id: string; name: string }[]>('/api/dropdown/canteens').then(r => {
      if (r.success && r.data) {
        setCanteens(r.data);
        if (r.data.length === 1) {
          setForm(f => ({ ...f, canteen_id: r.data![0].id }));
        } else if (isCanteenMgr && user.org_id) {
          const match = r.data.find(c => c.id === user.org_id);
          if (match) setForm(f => ({ ...f, canteen_id: match.id }));
        }
      }
    });
  }, [user, isCanteenMgr]);

  // Load stalls when canteen changes
  useEffect(() => {
    if (!form.canteen_id) { setStalls([]); return; }
    api<{ id: string; name: string }[]>(`/api/dropdown/stalls?canteen_id=${form.canteen_id}`).then(r => {
      if (r.success && r.data) {
        setStalls(r.data);
        if (isStallMgr && user.org_id) {
          const match = r.data.find(s => s.id === user.org_id);
          if (match) setForm(f => ({ ...f, stall_id: match.id }));
        } else if (r.data.length === 1) {
          setForm(f => ({ ...f, stall_id: r.data![0].id }));
        }
      }
    });
    api<{ id: string; name: string }[]>(`/api/meal-types?canteen_id=${form.canteen_id}`).then(r => {
      if (r.success && r.data) setMealTypes(r.data);
    });
    api<{ id: string; name: string }[]>(`/api/revenue-types?canteen_id=${form.canteen_id}`).then(r => {
      if (r.success && r.data) setRevenueTypes(r.data);
    });
  }, [form.canteen_id, user, isStallMgr]);

  // Load records
  const loadRecords = useCallback(async () => {
    const params = new URLSearchParams({ page: String(page), page_size: '10' });
    if (form.canteen_id) params.set('canteen_id', form.canteen_id);
    const r = await api<{ records: Record<string, unknown>[]; total: number }>(`/api/revenue-records?${params}`);
    if (r.success && r.data) { setRecords(r.data.records); setTotal(r.data.total); }
  }, [page, form.canteen_id]);

  useEffect(() => { loadRecords(); }, [loadRecords]);

  const handleSubmit = async () => {
    if (!form.canteen_id || !form.stall_id || !form.amount) { alert('请填写必填字段'); return; }
    const r = await api('/api/revenue-records', {
      method: 'POST',
      body: JSON.stringify({
        canteen_id: form.canteen_id,
        stall_id: form.stall_id,
        meal_type_id: form.meal_type_id || null,
        revenue_type_id: form.revenue_type_id || null,
        record_date: form.record_date,
        order_count: parseInt(form.order_count) || 0,
        amount: parseFloat(form.amount),
        note: form.note || null,
      }),
    });
    if (r.success) {
      alert(r.message || '录入成功');
      setForm(f => ({ ...f, order_count: '', amount: '', note: '' }));
      loadRecords();
    } else {
      alert(r.error || '录入失败');
    }
  };

  const handleExport = () => {
    const token = localStorage.getItem('token');
    const params = new URLSearchParams({ type: 'revenue' });
    if (form.canteen_id) params.set('canteen_id', form.canteen_id);
    window.open(`/api/export?${params.toString()}`, '_blank');
  };

  return (
    <div className="space-y-4 max-w-5xl mx-auto">
      {/* Form */}
      <div className="bg-white rounded-xl p-4 md:p-6 shadow-sm border">
        <h3 className="text-sm font-semibold text-gray-700 mb-4">营收录入</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">食堂 *</label>
            <select value={form.canteen_id} onChange={e => setForm(f => ({ ...f, canteen_id: e.target.value, stall_id: '' }))} disabled={isCanteenMgr || isStallMgr} className="w-full px-3 py-2 border rounded-lg text-sm disabled:bg-gray-100">
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
            <label className="block text-xs font-medium text-gray-600 mb-1">餐别</label>
            <select value={form.meal_type_id} onChange={e => setForm(f => ({ ...f, meal_type_id: e.target.value }))} className="w-full px-3 py-2 border rounded-lg text-sm">
              <option value="">选择餐别</option>
              {mealTypes.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">营收类型</label>
            <select value={form.revenue_type_id} onChange={e => setForm(f => ({ ...f, revenue_type_id: e.target.value }))} className="w-full px-3 py-2 border rounded-lg text-sm">
              <option value="">选择类型</option>
              {revenueTypes.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
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
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">备注</label>
            <input value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))} className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="可选" />
          </div>
        </div>
        <div className="mt-4 flex gap-3">
          <button onClick={handleSubmit} className="px-6 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">提交</button>
          {user.role_code !== 'STALL_MANAGER' && (
            <button onClick={handleExport} className="px-4 py-2 border rounded-lg text-sm text-gray-600 hover:bg-gray-50 flex items-center gap-2">
              {Icons.download}导出Excel
            </button>
          )}
        </div>
      </div>

      {/* Records List */}
      <div className="bg-white rounded-xl p-4 md:p-6 shadow-sm border">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">已录入记录</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b text-gray-500 text-xs">
              <th className="py-2 px-3 text-left">日期</th><th className="py-2 px-3 text-left">食堂</th><th className="py-2 px-3 text-left">档口</th><th className="py-2 px-3 text-left">餐别</th><th className="py-2 px-3 text-left">类型</th><th className="py-2 px-3 text-right">订单数</th><th className="py-2 px-3 text-right">金额</th>
            </tr></thead>
            <tbody>
              {records.map((r, i) => (
                <tr key={i} className="border-b last:border-0 hover:bg-gray-50">
                  <td className="py-2 px-3">{r.record_date as string}</td>
                  <td className="py-2 px-3">{(r.canteens as { name: string } | null)?.name || '-'}</td>
                  <td className="py-2 px-3">{(r.stalls as { name: string } | null)?.name || '-'}</td>
                  <td className="py-2 px-3">{(r.meal_types as { name: string } | null)?.name || '-'}</td>
                  <td className="py-2 px-3">{(r.revenue_types as { name: string } | null)?.name || '-'}</td>
                  <td className="py-2 px-3 text-right">{r.order_count as number}</td>
                  <td className="py-2 px-3 text-right">¥{r.amount as string}</td>
                </tr>
              ))}
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
   EXPENSE PAGE
   ═══════════════════════════════════════════ */
function ExpensePage({ user }: { user: UserInfo }) {
  const [canteens, setCanteens] = useState<{ id: string; name: string }[]>([]);
  const [records, setRecords] = useState<Record<string, unknown>[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);

  const [form, setForm] = useState({
    canteen_id: '',
    expense_date: new Date().toISOString().slice(0, 10),
    category: '',
    amount: '',
    note: '',
  });

  useEffect(() => {
    api<{ id: string; name: string }[]>('/api/dropdown/canteens').then(r => {
      if (r.success && r.data) {
        setCanteens(r.data);
        if (user.role_code === 'CANTEEN_MANAGER' && user.org_id) {
          const match = r.data.find(c => c.id === user.org_id);
          if (match) setForm(f => ({ ...f, canteen_id: match.id }));
        } else if (r.data.length === 1) {
          setForm(f => ({ ...f, canteen_id: r.data![0].id }));
        }
      }
    });
  }, [user]);

  const loadRecords = useCallback(async () => {
    const params = new URLSearchParams({ page: String(page), page_size: '10' });
    if (form.canteen_id) params.set('canteen_id', form.canteen_id);
    const r = await api<{ records: Record<string, unknown>[]; total: number }>(`/api/expense-records?${params}`);
    if (r.success && r.data) { setRecords(r.data.records); setTotal(r.data.total); }
  }, [page, form.canteen_id]);

  useEffect(() => { loadRecords(); }, [loadRecords]);

  const handleSubmit = async () => {
    if (!form.canteen_id || !form.category || !form.amount) { alert('请填写必填字段'); return; }
    const r = await api('/api/expense-records', {
      method: 'POST',
      body: JSON.stringify({ ...form, amount: parseFloat(form.amount) }),
    });
    if (r.success) { alert('录入成功'); setForm(f => ({ ...f, amount: '', note: '' })); loadRecords(); }
    else alert(r.error || '录入失败');
  };

  const handleExport = () => {
    const params = new URLSearchParams({ type: 'expense' });
    if (form.canteen_id) params.set('canteen_id', form.canteen_id);
    window.open(`/api/export?${params.toString()}`, '_blank');
  };

  return (
    <div className="space-y-4 max-w-5xl mx-auto">
      <div className="bg-white rounded-xl p-4 md:p-6 shadow-sm border">
        <h3 className="text-sm font-semibold text-gray-700 mb-4">支出录入</h3>
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
            <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} className="w-full px-3 py-2 border rounded-lg text-sm">
              <option value="">选择类别</option>
              {EXPENSE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">金额(元) *</label>
            <input type="number" step="0.01" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="0.00" />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-gray-600 mb-1">备注</label>
            <input value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))} className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="可选" />
          </div>
        </div>
        <div className="mt-4 flex gap-3">
          <button onClick={handleSubmit} className="px-6 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">提交</button>
          <button onClick={handleExport} className="px-4 py-2 border rounded-lg text-sm text-gray-600 hover:bg-gray-50 flex items-center gap-2">
            {Icons.download}导出Excel
          </button>
        </div>
      </div>

      {/* Records */}
      <div className="bg-white rounded-xl p-4 md:p-6 shadow-sm border">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">已录入记录</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b text-gray-500 text-xs">
              <th className="py-2 px-3 text-left">日期</th><th className="py-2 px-3 text-left">食堂</th><th className="py-2 px-3 text-left">类别</th><th className="py-2 px-3 text-right">金额</th><th className="py-2 px-3 text-left">备注</th>
            </tr></thead>
            <tbody>
              {records.map((r, i) => (
                <tr key={i} className="border-b last:border-0 hover:bg-gray-50">
                  <td className="py-2 px-3">{r.expense_date as string}</td>
                  <td className="py-2 px-3">{(r.canteens as { name: string } | null)?.name || '-'}</td>
                  <td className="py-2 px-3">{r.category as string}</td>
                  <td className="py-2 px-3 text-right">¥{r.amount as string}</td>
                  <td className="py-2 px-3 text-gray-500">{(r.note as string) || '-'}</td>
                </tr>
              ))}
              {records.length === 0 && <tr><td colSpan={5} className="py-6 text-center text-gray-400">暂无记录</td></tr>}
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
   SETTINGS PAGE
   ═══════════════════════════════════════════ */
function SettingsPage({ user }: { user: UserInfo }) {
  const [subTab, setSubTab] = useState('account');
  const subTabs = [
    { key: 'account', label: '账号管理', roles: ['SYSTEM_DEVELOPER', 'COMPANY_MANAGER'] },
    { key: 'params', label: '系统参数', roles: ['SYSTEM_DEVELOPER'] },
    { key: 'fixed', label: '固定支出', roles: ['SYSTEM_DEVELOPER', 'COMPANY_MANAGER'] },
    { key: 'logs', label: '操作日志', roles: ['SYSTEM_DEVELOPER'] },
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
      {subTab === 'account' && <AccountManager user={user} />}
      {subTab === 'params' && <CompanyParams user={user} />}
      {subTab === 'fixed' && <FixedExpenses user={user} />}
      {subTab === 'logs' && <OperationLogs />}
    </div>
  );
}

/* Account Manager */
function AccountManager({ user }: { user: UserInfo }) {
  const [users, setUsers] = useState<Record<string, unknown>[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [newUser, setNewUser] = useState({ username: '', real_name: '', password: '', role_code: 'CANTEEN_MANAGER', org_id: '' });
  const [canteens, setCanteens] = useState<{ id: string; name: string }[]>([]);
  const [companies, setCompanies] = useState<{ id: string; name: string }[]>([]);

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
    const r = await api('/api/users', {
      method: 'POST',
      body: JSON.stringify(newUser),
    });
    if (r.success) { alert('创建成功'); setShowCreate(false); loadUsers(); }
    else alert(r.error);
  };

  const handleDisable = async (userId: string, disabled: boolean) => {
    const r = await api(`/api/settings/users/${userId}/disable`, {
      method: 'PUT',
      body: JSON.stringify({ is_disabled: disabled }),
    });
    if (r.success) loadUsers();
    else alert(r.error);
  };

  const handleResetPwd = async (userId: string) => {
    const r = await api<{ new_password: string }>(`/api/settings/users/${userId}/reset-password`, { method: 'PUT' });
    if (r.success) alert(`密码已重置为: ${r.data!.new_password}`);
    else alert(r.error);
  };

  return (
    <div className="bg-white rounded-xl p-4 md:p-6 shadow-sm border">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-gray-700">账号管理</h3>
        <button onClick={() => setShowCreate(!showCreate)} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700">
          新建账号
        </button>
      </div>

      {showCreate && (
        <div className="bg-gray-50 rounded-lg p-4 mb-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
          </div>
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
                <td className="py-2 px-3">
                  <span className={`px-2 py-0.5 rounded text-xs ${u.is_disabled ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                    {u.is_disabled ? '已禁用' : '正常'}
                  </span>
                </td>
                <td className="py-2 px-3 text-xs">{(u.account_expires_at as string)?.slice(0, 10) || '-'}</td>
                <td className="py-2 px-3">
                  <div className="flex gap-2">
                    <button onClick={() => handleDisable(u.id as string, !u.is_disabled)} className="text-xs text-amber-600 hover:underline">
                      {u.is_disabled ? '启用' : '禁用'}
                    </button>
                    <button onClick={() => handleResetPwd(u.id as string)} className="text-xs text-blue-600 hover:underline">重置密码</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* Company Params (Developer only) */
function CompanyParams({ user }: { user: UserInfo }) {
  const [companies, setCompanies] = useState<{ id: string; name: string }[]>([]);
  const [selected, setSelected] = useState('');
  const [params, setParams] = useState<{ max_canteens: number; account_expires_at: string | null }>({ max_canteens: 10, account_expires_at: null });

  useEffect(() => {
    api<{ id: string; name: string }[]>('/api/companies').then(r => {
      if (r.success && r.data) { setCompanies(r.data); if (r.data.length) setSelected(r.data[0].id); }
    });
  }, []);

  useEffect(() => {
    if (!selected) return;
    api<{ max_canteens: number; account_expires_at: string | null }>(`/api/settings/company-params/${selected}`).then(r => {
      if (r.success && r.data) setParams(r.data);
    });
  }, [selected]);

  const handleSave = async () => {
    const r = await api(`/api/settings/company-params/${selected}`, {
      method: 'PUT',
      body: JSON.stringify(params),
    });
    if (r.success) alert('保存成功');
    else alert(r.error);
  };

  return (
    <div className="bg-white rounded-xl p-4 md:p-6 shadow-sm border">
      <h3 className="text-sm font-semibold text-gray-700 mb-4">系统参数配置</h3>
      <div className="space-y-4 max-w-md">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">选择公司</label>
          <select value={selected} onChange={e => setSelected(e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm">
            {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">允许开设食堂总数</label>
          <input type="number" value={params.max_canteens} onChange={e => setParams(p => ({ ...p, max_canteens: parseInt(e.target.value) || 10 }))} className="w-full px-3 py-2 border rounded-lg text-sm" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">账号有效期</label>
          <input type="date" value={params.account_expires_at?.slice(0, 10) || ''} onChange={e => setParams(p => ({ ...p, account_expires_at: e.target.value || null }))} className="w-full px-3 py-2 border rounded-lg text-sm" />
          <p className="text-xs text-gray-400 mt-1">设置后，该公司下所有账号的有效期将同步</p>
        </div>
        <button onClick={handleSave} className="px-6 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700">保存</button>
      </div>
    </div>
  );
}

/* Fixed Expenses */
function FixedExpenses({ user }: { user: UserInfo }) {
  const [canteens, setCanteens] = useState<{ id: string; name: string }[]>([]);
  const [records, setRecords] = useState<Record<string, unknown>[]>([]);
  const [selectedCanteen, setSelectedCanteen] = useState('');
  const [form, setForm] = useState({ category: '房租', amount: '', note: '' });

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
    if (!selectedCanteen || !form.category || !form.amount) { alert('请填写必填字段'); return; }
    const r = await api('/api/settings/fixed-expenses', {
      method: 'POST',
      body: JSON.stringify({ canteen_id: selectedCanteen, ...form, amount: parseFloat(form.amount) }),
    });
    if (r.success) { setForm({ category: '房租', amount: '', note: '' }); loadFixed(); }
    else alert(r.error);
  };

  const handleDelete = async (id: string) => {
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
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 mb-4">
        <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} className="px-3 py-2 border rounded-lg text-sm">
          {EXPENSE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <input type="number" step="0.01" placeholder="金额 *" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} className="px-3 py-2 border rounded-lg text-sm" />
        <input placeholder="备注" value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))} className="px-3 py-2 border rounded-lg text-sm" />
        <button onClick={handleAdd} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm">添加</button>
      </div>
      <table className="w-full text-sm">
        <thead><tr className="border-b text-gray-500 text-xs">
          <th className="py-2 px-3 text-left">类别</th><th className="py-2 px-3 text-right">金额</th><th className="py-2 px-3 text-left">备注</th><th className="py-2 px-3">操作</th>
        </tr></thead>
        <tbody>
          {records.map((r, i) => (
            <tr key={i} className="border-b last:border-0">
              <td className="py-2 px-3">{r.category as string}</td>
              <td className="py-2 px-3 text-right">¥{r.amount as string}</td>
              <td className="py-2 px-3 text-gray-500">{(r.note as string) || '-'}</td>
              <td className="py-2 px-3 text-center"><button onClick={() => handleDelete(r.id as string)} className="text-xs text-red-600 hover:underline">删除</button></td>
            </tr>
          ))}
          {records.length === 0 && <tr><td colSpan={4} className="py-6 text-center text-gray-400">暂无固定支出</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

/* Operation Logs */
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
                <td className="py-2 px-3 text-gray-500 max-w-xs truncate">{l.details as string || '-'}</td>
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
