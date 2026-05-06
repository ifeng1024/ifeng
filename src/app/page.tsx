'use client';
import { useState, useEffect, useCallback } from 'react';

/* ─── TYPES & CONSTANTS ─── */
interface AuthUser { id: string; username: string; real_name: string; role_code: string; org_id: string | null; company_name: string | null; org_name: string | null; expires_at: string | null; is_disabled: boolean; }
interface ApiResp { success: boolean; data?: unknown; error?: string; }

const ROLE_LABEL: Record<string, string> = { SYSTEM_DEVELOPER: '系统开发者', COMPANY_MANAGER: '公司负责人', CANTEEN_MANAGER: '食堂负责人', STALL_MANAGER: '档口负责人', REGULAR_USER: '普通用户' };
const num = (v: unknown) => Number(v) || 0;
const fmt = (v: unknown) => num(v).toFixed(2);

async function apiFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(url, { ...init, headers: { ...headers, ...(init?.headers as Record<string, string> || {}) } });
  return res.json();
}

/* ─── LOGIN PAGE ─── */
function LoginPage({ onLogin }: { onLogin: (u: AuthUser) => void }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const login = async () => {
    setError('');
    const res = await apiFetch<ApiResp>('/api/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) });
    if (res.success && res.data) {
      const d = res.data as Record<string, unknown>;
      localStorage.setItem('token', d.token as string);
      onLogin(d.user as AuthUser);
    } else { setError(res.error || '登录失败'); }
  };

  const demoAccounts = [
    { label: '公司负责人', username: 'company_mgr', password: '123456' },
    { label: '食堂负责人', username: 'canteen_mgr', password: '123456' },
    { label: '档口负责人', username: 'stall_mgr', password: '123456' },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md">
        <h1 className="text-2xl font-bold text-center text-gray-800 mb-2">食堂管理系统</h1>
        <p className="text-center text-gray-400 text-sm mb-6">请登录您的账号</p>
        {error && <div className="bg-red-50 text-red-600 text-sm rounded-lg px-4 py-2 mb-4">{error}</div>}
        <div className="space-y-4">
          <div><label className="block text-sm font-medium text-gray-600 mb-1">用户名</label><input value={username} onChange={e => setUsername(e.target.value)} className="w-full border rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-300 outline-none" /></div>
          <div><label className="block text-sm font-medium text-gray-600 mb-1">密码</label><input type="password" value={password} onChange={e => setPassword(e.target.value)} onKeyDown={e => e.key === 'Enter' && login()} className="w-full border rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-300 outline-none" /></div>
          <button onClick={login} className="w-full bg-blue-600 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-blue-700 transition">登 录</button>
        </div>
        <div className="mt-6 pt-4 border-t">
          <p className="text-xs text-gray-400 mb-2">演示账号（点击快速填入）：</p>
          <div className="flex gap-2">
            {demoAccounts.map(d => (
              <button key={d.username} onClick={() => { setUsername(d.username); setPassword(d.password); }} className="flex-1 text-xs bg-gray-50 hover:bg-gray-100 rounded-lg px-2 py-2 text-gray-600 transition">{d.label}</button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── DEVELOPER VIEW ─── */
function DeveloperView({ user, onSwitchAccount }: { user: AuthUser; onSwitchAccount: (u: AuthUser, token: string) => void }) {
  const [companies, setCompanies] = useState<Record<string, unknown>[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ company_name: '', username: '', real_name: '', password: '', expires_at: '' });

  const load = useCallback(async () => {
    const res = await apiFetch<ApiResp>('/api/companies');
    if (res.success && res.data) setCompanies(res.data as Record<string, unknown>[]);
  }, []);
  useEffect(() => { load(); }, [load]);

  const createCompanyAccount = async () => {
    if (!form.company_name.trim() || !form.username.trim() || !form.password) { alert('请填写公司名称、用户名和密码'); return; }
    const res = await apiFetch<ApiResp>('/api/users', { method: 'POST', body: JSON.stringify({ username: form.username.trim(), real_name: form.real_name.trim() || form.username.trim(), role_code: 'COMPANY_MANAGER', company_name: form.company_name.trim(), password: form.password, expires_at: form.expires_at || null }) });
    if (res.success) { setShowForm(false); setForm({ company_name: '', username: '', real_name: '', password: '', expires_at: '' }); load(); } else alert(res.error);
  };

  const toggleDisable = async (u: Record<string, unknown>) => {
    const action = u.is_disabled ? '启用' : '禁用';
    if (!confirm(`确认${action}此账号？`)) return;
    const res = await apiFetch<ApiResp>(`/api/settings/users/${u.id}/disable`, { method: 'PUT', body: JSON.stringify({ is_disabled: !u.is_disabled }) });
    if (res.success) load(); else alert(res.error);
  };

  const resetPw = async (u: Record<string, unknown>) => {
    if (!confirm('确认重置密码为默认密码？')) return;
    const res = await apiFetch<ApiResp>(`/api/settings/users/${u.id}/reset-password`, { method: 'PUT' });
    if (res.success) alert('密码已重置'); else alert(res.error);
  };

  const editAccount = async (u: Record<string, unknown>) => {
    const newName = prompt('修改公司名称：', u.company_name as string || '');
    if (newName === null) return;
    const newExpiry = prompt('修改有效期（格式 YYYY-MM-DD，留空为永久）：', u.expires_at ? (u.expires_at as string).slice(0, 10) : '');
    if (newExpiry === null) return;
    const body: Record<string, unknown> = { company_name: newName.trim() };
    if (newExpiry) body.expires_at = newExpiry;
    else body.expires_at = null;
    const res = await apiFetch<ApiResp>(`/api/users/${u.id}`, { method: 'PUT', body: JSON.stringify(body) });
    if (res.success) load(); else alert(res.error);
  };

  const deleteAccount = async (u: Record<string, unknown>) => {
    if (!confirm(`确认删除此账号？此操作不可恢复！`)) return;
    const res = await apiFetch<ApiResp>(`/api/users/${u.id}`, { method: 'DELETE' });
    if (res.success) load(); else alert(res.error);
  };

  const impersonate = async (u: Record<string, unknown>) => {
    if (!confirm(`确认以 ${(u.real_name as string) || (u.username as string)} 身份进入系统？`)) return;
    const res = await apiFetch<ApiResp>('/api/auth/impersonate', { method: 'POST', body: JSON.stringify({ user_id: u.id }) });
    if (res.success && res.data) {
      const d = res.data as Record<string, unknown>;
      localStorage.setItem('token', d.token as string);
      onSwitchAccount(d.user as AuthUser, d.token as string);
    } else alert(res.error);
  };

  // Get company manager users
  const [users, setUsers] = useState<Record<string, unknown>[]>([]);
  useEffect(() => { apiFetch<ApiResp>('/api/users?role_code=COMPANY_MANAGER').then(res => { if (res.success && res.data) setUsers(res.data as Record<string, unknown>[]); }); }, [load]);

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl shadow p-5">
        <h3 className="font-semibold text-gray-700 mb-4">我的账号</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div><span className="text-gray-500">账号名称：</span><span className="font-medium">{user.real_name || user.username}</span></div>
          <div><span className="text-gray-500">角色：</span><span className="font-medium">{ROLE_LABEL[user.role_code]}</span></div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow p-5">
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-semibold text-gray-700">公司负责人账号管理</h3>
          <button onClick={() => setShowForm(!showForm)} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm">{showForm ? '取消' : '新建账号'}</button>
        </div>

        {showForm && (
          <div className="bg-blue-50 rounded-lg p-4 mb-4">
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
              <div><label className="block text-xs font-medium text-gray-600 mb-1">公司名称 *</label><input value={form.company_name} onChange={e => setForm(f => ({ ...f, company_name: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="如：XX科技有限公司" /></div>
              <div><label className="block text-xs font-medium text-gray-600 mb-1">用户名 *</label><input value={form.username} onChange={e => setForm(f => ({ ...f, username: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm" /></div>
              <div><label className="block text-xs font-medium text-gray-600 mb-1">姓名</label><input value={form.real_name} onChange={e => setForm(f => ({ ...f, real_name: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm" /></div>
              <div><label className="block text-xs font-medium text-gray-600 mb-1">密码 *</label><input type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm" /></div>
              <div><label className="block text-xs font-medium text-gray-600 mb-1">有效期</label><input type="date" value={form.expires_at} onChange={e => setForm(f => ({ ...f, expires_at: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="留空永久" /></div>
            </div>
            <button onClick={createCompanyAccount} className="mt-4 bg-blue-600 text-white px-6 py-2 rounded-lg text-sm">创建</button>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="bg-gray-50"><th className="px-3 py-2 text-left">公司名称</th><th className="px-3 py-2 text-left">用户名</th><th className="px-3 py-2 text-left">姓名</th><th className="px-3 py-2 text-left">有效期</th><th className="px-3 py-2 text-left">状态</th><th className="px-3 py-2 text-center">操作</th></tr></thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id as string} className="border-t hover:bg-gray-50">
                  <td className="px-3 py-2 font-medium">{u.company_name as string || '-'}</td>
                  <td className="px-3 py-2">{u.username as string}</td>
                  <td className="px-3 py-2">{u.real_name as string || ''}</td>
                  <td className="px-3 py-2">{u.expires_at ? new Date(u.expires_at as string).toLocaleDateString('zh-CN') : '永久'}</td>
                  <td className="px-3 py-2">{u.is_disabled ? <span className="text-red-500">已禁用</span> : <span className="text-green-600">正常</span>}</td>
                  <td className="px-3 py-2 text-center space-x-1 whitespace-nowrap">
                    <button onClick={() => editAccount(u)} className="text-blue-600 hover:underline text-xs">编辑</button>
                    <button onClick={() => toggleDisable(u)} className="text-orange-600 hover:underline text-xs">{u.is_disabled ? '启用' : '禁用'}</button>
                    <button onClick={() => resetPw(u)} className="text-gray-600 hover:underline text-xs">重置密码</button>
                    <button onClick={() => deleteAccount(u)} className="text-red-600 hover:underline text-xs">删除</button>
                    <button onClick={() => impersonate(u)} className="bg-blue-600 text-white px-2 py-0.5 rounded text-xs hover:bg-blue-700">进入</button>
                  </td>
                </tr>
              ))}
              {users.length === 0 && <tr><td colSpan={6} className="px-3 py-4 text-center text-gray-400">暂无公司负责人账号</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/* ─── DASHBOARD ─── */
function DashboardPage() {
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState('7d');

  useEffect(() => {
    const today = new Date().toLocaleDateString('sv-SE');
    apiFetch<ApiResp>(`/api/dashboard?date=${today}&range=${range}`).then(res => {
      if (res.success && res.data) setData(res.data as Record<string, unknown>);
    }).finally(() => setLoading(false));
  }, [range]);

  if (loading) return <div className="text-center py-10 text-gray-400">加载中...</div>;
  if (!data) return <div className="text-center py-10 text-red-400">加载失败</div>;

  const kpi = (data.kpi || {}) as Record<string, unknown>;
  const canteenComparison = (data.canteen_comparison || []) as Record<string, unknown>[];
  const stallRanking = (data.stall_ranking || []) as Record<string, unknown>[];
  const revenueTrend = (data.revenue_trend || []) as Record<string, unknown>[];
  const expenseBreakdown = (data.expense_breakdown || []) as Record<string, unknown>[];
  const profitTrend = (data.profit_trend || []) as Record<string, unknown>[];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-gray-800">数据概览</h2>
        <select value={range} onChange={e => setRange(e.target.value)} className="border rounded-lg px-3 py-1.5 text-sm">
          <option value="7d">近7天</option><option value="30d">近30天</option>
        </select>
      </div>

      {/* KPI Cards - Row 1: Today */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="今日营收" value={num(kpi.total_revenue).toFixed(2)} color="blue" />
        <KpiCard label="今日支出" value={num(kpi.total_expense).toFixed(2)} color="red" />
        <KpiCard label="今日毛利" value={num(kpi.gross_profit).toFixed(2)} color="green" />
        <KpiCard label="今日毛利率" value={`${num(kpi.gross_margin).toFixed(1)}%`} color="purple" />
      </div>

      {/* KPI Cards - Row 2: Week/Month */}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
        <KpiCard label="本周营收" value={num(kpi.week_revenue).toFixed(2)} color="blue" small />
        <KpiCard label="本月营收" value={num(kpi.month_revenue).toFixed(2)} color="blue" small />
        <KpiCard label="本周支出" value={num(kpi.week_expense).toFixed(2)} color="red" small />
        <KpiCard label="本月支出" value={num(kpi.month_expense).toFixed(2)} color="red" small />
        <KpiCard label="本周毛利" value={num(kpi.week_gross_profit).toFixed(2)} color="green" small />
        <KpiCard label="本月毛利" value={num(kpi.month_gross_profit).toFixed(2)} color="green" small />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue Trend */}
        <div className="bg-white rounded-xl shadow p-5">
          <h3 className="font-semibold text-gray-700 mb-4">营收趋势</h3>
          <SimpleBarChart data={revenueTrend} xKey="date" yKey="amount" />
        </div>
        {/* Profit Trend */}
        <div className="bg-white rounded-xl shadow p-5">
          <h3 className="font-semibold text-gray-700 mb-4">收支对比</h3>
          <GroupedBarChart data={profitTrend} xKey="date" bars={[{ key: 'revenue', label: '营收', color: '#3b82f6' }, { key: 'expense', label: '支出', color: '#ef4444' }]} />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Stall Ranking */}
        <div className="bg-white rounded-xl shadow p-5">
          <h3 className="font-semibold text-gray-700 mb-4">档口营收排行</h3>
          <SimpleBarChart data={stallRanking} xKey="name" yKey="amount" horizontal />
        </div>
        {/* Expense Breakdown */}
        <div className="bg-white rounded-xl shadow p-5">
          <h3 className="font-semibold text-gray-700 mb-4">支出构成</h3>
          {expenseBreakdown.length > 0 ? (
            <div className="space-y-3">
              {expenseBreakdown.map((e, i) => {
                const total = expenseBreakdown.reduce((s, x) => s + num(x.amount), 0);
                const pct = total > 0 ? (num(e.amount) / total * 100) : 0;
                const colors = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6'];
                return (
                  <div key={i}>
                    <div className="flex justify-between text-sm mb-1"><span>{e.category as string}</span><span className="text-gray-500">{fmt(e.amount)} ({pct.toFixed(1)}%)</span></div>
                    <div className="w-full bg-gray-100 rounded-full h-2"><div className="h-2 rounded-full" style={{ width: `${pct}%`, backgroundColor: colors[i % colors.length] }} /></div>
                  </div>
                );
              })}
            </div>
          ) : <p className="text-gray-400 text-sm">暂无数据</p>}
        </div>
      </div>
    </div>
  );
}

function KpiCard({ label, value, color, small }: { label: string; value: string; color: string; small?: boolean }) {
  const colorMap: Record<string, string> = { blue: 'bg-blue-50 text-blue-700', red: 'bg-red-50 text-red-700', green: 'bg-green-50 text-green-700', purple: 'bg-purple-50 text-purple-700' };
  return (
    <div className={`${colorMap[color] || 'bg-gray-50 text-gray-700'} rounded-xl ${small ? 'p-3' : 'p-5'}`}>
      <div className={`${small ? 'text-xs' : 'text-sm'} opacity-70`}>{label}</div>
      <div className={`${small ? 'text-lg' : 'text-2xl'} font-bold mt-1`}>{value}</div>
    </div>
  );
}

/* Simple SVG Bar Chart (no recharts dependency) */
function SimpleBarChart({ data, xKey, yKey, horizontal }: { data: Record<string, unknown>[]; xKey: string; yKey: string; horizontal?: boolean }) {
  if (data.length === 0) return <p className="text-gray-400 text-sm">暂无数据</p>;
  const maxVal = Math.max(...data.map(d => num(d[yKey])), 1);
  const colors = ['#3b82f6', '#60a5fa', '#93c5fd', '#bfdbfe'];

  if (horizontal) {
    return (
      <div className="space-y-2">
        {data.map((d, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className="text-xs text-gray-600 w-24 truncate">{d[xKey] as string}</span>
            <div className="flex-1 bg-gray-100 rounded-full h-5 relative">
              <div className="h-5 rounded-full flex items-center px-2" style={{ width: `${Math.max(num(d[yKey]) / maxVal * 100, 2)}%`, backgroundColor: colors[i % colors.length] }}>
                <span className="text-white text-xs">{fmt(d[yKey])}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="flex items-end gap-1 h-40">
      {data.map((d, i) => (
        <div key={i} className="flex-1 flex flex-col items-center">
          <span className="text-xs text-gray-500 mb-1">{fmt(d[yKey])}</span>
          <div className="w-full rounded-t" style={{ height: `${Math.max(num(d[yKey]) / maxVal * 120, 2)}px`, backgroundColor: colors[i % colors.length], minHeight: '2px' }} />
          <span className="text-xs text-gray-400 mt-1 truncate w-full text-center">{(d[xKey] as string).slice(5)}</span>
        </div>
      ))}
    </div>
  );
}

function GroupedBarChart({ data, xKey, bars }: { data: Record<string, unknown>[]; xKey: string; bars: { key: string; label: string; color: string }[] }) {
  if (data.length === 0) return <p className="text-gray-400 text-sm">暂无数据</p>;
  const maxVal = Math.max(...data.flatMap(d => bars.map(b => num(d[b.key]))), 1);

  return (
    <div className="space-y-1">
      <div className="flex gap-3 mb-2">{bars.map(b => <span key={b.key} className="text-xs flex items-center gap-1"><span className="w-3 h-3 rounded" style={{ backgroundColor: b.color }} />{b.label}</span>)}</div>
      <div className="flex items-end gap-1 h-40">
        {data.map((d, i) => (
          <div key={i} className="flex-1 flex flex-col items-center">
            <div className="flex gap-0.5 w-full items-end" style={{ height: '120px' }}>
              {bars.map(b => (
                <div key={b.key} className="flex-1 rounded-t" style={{ height: `${Math.max(num(d[b.key]) / maxVal * 120, 1)}px`, backgroundColor: b.color, minHeight: '1px' }} />
              ))}
            </div>
            <span className="text-xs text-gray-400 mt-1 truncate w-full text-center">{(d[xKey] as string).slice(5)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── REVENUE ENTRY ─── */
function RevenuePage() {
  const [canteens, setCanteens] = useState<Record<string, unknown>[]>([]);
  const [stalls, setStalls] = useState<Record<string, unknown>[]>([]);
  const [mealTypes, setMealTypes] = useState<Record<string, unknown>[]>([]);
  const [records, setRecords] = useState<Record<string, unknown>[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [form, setForm] = useState({ canteen_id: '', stall_id: '', meal_type_id: '', record_date: new Date().toLocaleDateString('sv-SE'), order_count: '', amount: '', note: '' });

  useEffect(() => { apiFetch<ApiResp>('/api/dropdown/canteens').then(res => { if (res.success && res.data) setCanteens(res.data as Record<string, unknown>[]); }); }, []);
  useEffect(() => {
    if (!form.canteen_id) { setStalls([]); setMealTypes([]); return; }
    Promise.all([apiFetch<ApiResp>(`/api/dropdown/stalls?canteen_id=${form.canteen_id}`), apiFetch<ApiResp>(`/api/meal-types?canteen_id=${form.canteen_id}`)]).then(([sRes, mRes]) => {
      if (sRes.success && sRes.data) setStalls(sRes.data as Record<string, unknown>[]);
      if (mRes.success && mRes.data) setMealTypes(mRes.data as Record<string, unknown>[]);
    });
  }, [form.canteen_id]);

  const loadRecords = useCallback(async () => {
    const res = await apiFetch<ApiResp>(`/api/revenue-records?page=${page}&page_size=10`);
    if (res.success && res.data) { const d = res.data as Record<string, unknown>; setRecords((d.records || []) as Record<string, unknown>[]); setTotal(num(d.total)); }
  }, [page]);
  useEffect(() => { loadRecords(); }, [loadRecords]);

  const submit = async () => {
    if (!form.canteen_id || !form.stall_id || !form.meal_type_id || !form.amount || !form.record_date) { alert('请填写必填项（食堂、档口、餐别、日期、金额）'); return; }
    const res = await apiFetch<ApiResp>('/api/revenue-records', { method: 'POST', body: JSON.stringify({ ...form, order_count: num(form.order_count), amount: num(form.amount) }) });
    if (res.success) { setForm(f => ({ ...f, order_count: '', amount: '', note: '' })); loadRecords(); } else alert(res.error);
  };

  const deleteRecord = async (id: string) => {
    if (!confirm('确认删除？')) return;
    const res = await apiFetch<ApiResp>(`/api/revenue-records/${id}`, { method: 'DELETE' });
    if (res.success) loadRecords(); else alert(res.error);
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl shadow p-5">
        <h3 className="font-semibold text-gray-700 mb-4">营收录入</h3>
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          <div><label className="block text-xs font-medium text-gray-600 mb-1">食堂 *</label><select value={form.canteen_id} onChange={e => setForm(f => ({ ...f, canteen_id: e.target.value, stall_id: '', meal_type_id: '' }))} className="w-full border rounded-lg px-3 py-2 text-sm"><option value="">选择食堂</option>{canteens.map(c => <option key={c.id as string} value={c.id as string}>{c.name as string}</option>)}</select></div>
          <div><label className="block text-xs font-medium text-gray-600 mb-1">档口 *</label><select value={form.stall_id} onChange={e => setForm(f => ({ ...f, stall_id: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm"><option value="">选择档口</option>{stalls.map(s => <option key={s.id as string} value={s.id as string}>{s.name as string}</option>)}</select></div>
          <div><label className="block text-xs font-medium text-gray-600 mb-1">餐别 *</label><select value={form.meal_type_id} onChange={e => setForm(f => ({ ...f, meal_type_id: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm"><option value="">选择餐别</option>{mealTypes.map(m => <option key={m.id as string} value={m.id as string}>{m.name as string}</option>)}</select></div>
          <div><label className="block text-xs font-medium text-gray-600 mb-1">日期 *</label><input type="date" value={form.record_date} onChange={e => setForm(f => ({ ...f, record_date: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm" /></div>
          <div><label className="block text-xs font-medium text-gray-600 mb-1">订单数</label><input type="number" value={form.order_count} onChange={e => setForm(f => ({ ...f, order_count: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm" /></div>
          <div><label className="block text-xs font-medium text-gray-600 mb-1">金额 *</label><input type="number" step="0.01" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm" /></div>
          <div className="col-span-2 lg:col-span-3"><label className="block text-xs font-medium text-gray-600 mb-1">备注</label><input value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm" /></div>
        </div>
        <button onClick={submit} className="mt-4 bg-blue-600 text-white px-6 py-2 rounded-lg text-sm">录入</button>
      </div>

      <div className="bg-white rounded-xl shadow overflow-hidden">
        <table className="w-full text-sm">
          <thead><tr className="bg-gray-50"><th className="px-3 py-2 text-left">日期</th><th className="px-3 py-2 text-left">食堂</th><th className="px-3 py-2 text-left">档口</th><th className="px-3 py-2 text-left">餐别</th><th className="px-3 py-2 text-right">订单数</th><th className="px-3 py-2 text-right">金额</th><th className="px-3 py-2 text-center">操作</th></tr></thead>
          <tbody>
            {records.map(r => (
              <tr key={r.id as string} className="border-t hover:bg-gray-50">
                <td className="px-3 py-2">{r.record_date as string}</td>
                <td className="px-3 py-2">{r.canteen_name as string || '-'}</td>
                <td className="px-3 py-2">{r.stall_name as string || '-'}</td>
                <td className="px-3 py-2">{r.meal_type_name as string || '-'}</td>
                <td className="px-3 py-2 text-right">{r.order_count as number || 0}</td>
                <td className="px-3 py-2 text-right">{fmt(r.amount)}</td>
                <td className="px-3 py-2 text-center"><button onClick={() => deleteRecord(r.id as string)} className="text-red-600 hover:underline text-xs">删除</button></td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="flex justify-between items-center px-4 py-3 text-sm text-gray-500 border-t">
          <span>共 {total} 条</span>
          <div className="flex gap-2"><button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1} className="px-3 py-1 border rounded disabled:opacity-30">上一页</button><button onClick={() => setPage(p => p + 1)} disabled={records.length < 10} className="px-3 py-1 border rounded disabled:opacity-30">下一页</button></div>
        </div>
      </div>
    </div>
  );
}

/* ─── EXPENSE ENTRY ─── */
function ExpensePage() {
  const [canteens, setCanteens] = useState<Record<string, unknown>[]>([]);
  const [records, setRecords] = useState<Record<string, unknown>[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [categories, setCategories] = useState<Record<string, unknown>[]>([]);
  const [products, setProducts] = useState<Record<string, unknown>[]>([]);
  const [specs, setSpecs] = useState<Record<string, unknown>[]>([]);
  const [form, setForm] = useState({ canteen_id: '', expense_date: new Date().toLocaleDateString('sv-SE'), category: '食材采购', amount: '', note: '', product_category_id: '', product_id: '', product_spec_id: '', quantity: '', unit_price: '' });

  useEffect(() => { apiFetch<ApiResp>('/api/dropdown/canteens').then(res => { if (res.success && res.data) setCanteens(res.data as Record<string, unknown>[]); }); }, []);
  useEffect(() => { apiFetch<ApiResp>('/api/settings/products/categories').then(res => { if (res.success && res.data) setCategories(res.data as Record<string, unknown>[]); }); }, []);
  useEffect(() => {
    if (!form.product_category_id) { setProducts([]); return; }
    apiFetch<ApiResp>(`/api/settings/products?category_id=${form.product_category_id}`).then(res => { if (res.success && res.data) setProducts(res.data as Record<string, unknown>[]); });
  }, [form.product_category_id]);
  useEffect(() => {
    if (!form.product_id) { setSpecs([]); return; }
    apiFetch<ApiResp>(`/api/settings/products/specs?product_id=${form.product_id}`).then(res => { if (res.success && res.data) setSpecs(res.data as Record<string, unknown>[]); });
  }, [form.product_id]);

  const loadRecords = useCallback(async () => {
    const res = await apiFetch<ApiResp>(`/api/expense-records?page=${page}&page_size=10`);
    if (res.success && res.data) { const d = res.data as Record<string, unknown>; setRecords((d.records || []) as Record<string, unknown>[]); setTotal(num(d.total)); }
  }, [page]);
  useEffect(() => { loadRecords(); }, [loadRecords]);

  const isMaterial = form.category === '食材采购';

  const submit = async () => {
    if (!form.canteen_id || !form.amount || !form.expense_date) { alert('请填写必填项'); return; }
    const body: Record<string, unknown> = { canteen_id: form.canteen_id, expense_date: form.expense_date, category: form.category, amount: num(form.amount), note: form.note };
    if (isMaterial) { body.product_category_id = form.product_category_id || null; body.product_id = form.product_id || null; body.product_spec_id = form.product_spec_id || null; body.quantity = form.quantity ? num(form.quantity) : null; body.unit_price = form.unit_price ? num(form.unit_price) : null; }
    const res = await apiFetch<ApiResp>('/api/expense-records', { method: 'POST', body: JSON.stringify(body) });
    if (res.success) { setForm(f => ({ ...f, amount: '', note: '', product_category_id: '', product_id: '', product_spec_id: '', quantity: '', unit_price: '' })); loadRecords(); } else alert(res.error);
  };

  const deleteRecord = async (id: string) => {
    if (!confirm('确认删除？')) return;
    const res = await apiFetch<ApiResp>(`/api/expense-records/${id}`, { method: 'DELETE' });
    if (res.success) loadRecords(); else alert(res.error);
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl shadow p-5">
        <h3 className="font-semibold text-gray-700 mb-4">支出录入</h3>
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          <div><label className="block text-xs font-medium text-gray-600 mb-1">食堂 *</label><select value={form.canteen_id} onChange={e => setForm(f => ({ ...f, canteen_id: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm"><option value="">选择食堂</option>{canteens.map(c => <option key={c.id as string} value={c.id as string}>{c.name as string}</option>)}</select></div>
          <div><label className="block text-xs font-medium text-gray-600 mb-1">日期 *</label><input type="date" value={form.expense_date} onChange={e => setForm(f => ({ ...f, expense_date: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm" /></div>
          <div><label className="block text-xs font-medium text-gray-600 mb-1">支出类别</label><select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value, product_category_id: '', product_id: '', product_spec_id: '' }))} className="w-full border rounded-lg px-3 py-2 text-sm"><option>食材采购</option><option>人工成本</option><option>水电费</option><option>设备维护</option><option>其他</option></select></div>
          <div><label className="block text-xs font-medium text-gray-600 mb-1">金额 *</label><input type="number" step="0.01" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm" /></div>
          <div className="col-span-2 lg:col-span-3"><label className="block text-xs font-medium text-gray-600 mb-1">备注</label><input value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm" /></div>
          {isMaterial && <>
            <div><label className="block text-xs font-medium text-gray-600 mb-1">商品品类</label><select value={form.product_category_id} onChange={e => setForm(f => ({ ...f, product_category_id: e.target.value, product_id: '', product_spec_id: '' }))} className="w-full border rounded-lg px-3 py-2 text-sm"><option value="">选择品类</option>{categories.map(c => <option key={c.id as string} value={c.id as string}>{c.name as string}</option>)}</select></div>
            <div><label className="block text-xs font-medium text-gray-600 mb-1">商品名称</label><select value={form.product_id} onChange={e => setForm(f => ({ ...f, product_id: e.target.value, product_spec_id: '' }))} className="w-full border rounded-lg px-3 py-2 text-sm"><option value="">选择商品</option>{products.map(p => <option key={p.id as string} value={p.id as string}>{p.name as string}</option>)}</select></div>
            <div><label className="block text-xs font-medium text-gray-600 mb-1">规格</label><select value={form.product_spec_id} onChange={e => setForm(f => ({ ...f, product_spec_id: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm"><option value="">选择规格</option>{specs.map(s => <option key={s.id as string} value={s.id as string}>{s.name as string}</option>)}</select></div>
            <div><label className="block text-xs font-medium text-gray-600 mb-1">数量</label><input type="number" step="0.01" value={form.quantity} onChange={e => setForm(f => ({ ...f, quantity: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm" /></div>
            <div><label className="block text-xs font-medium text-gray-600 mb-1">单价</label><input type="number" step="0.01" value={form.unit_price} onChange={e => setForm(f => ({ ...f, unit_price: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm" /></div>
          </>}
        </div>
        <button onClick={submit} className="mt-4 bg-blue-600 text-white px-6 py-2 rounded-lg text-sm">录入</button>
      </div>

      <div className="bg-white rounded-xl shadow overflow-hidden">
        <table className="w-full text-sm">
          <thead><tr className="bg-gray-50"><th className="px-3 py-2 text-left">日期</th><th className="px-3 py-2 text-left">食堂</th><th className="px-3 py-2 text-left">类别</th><th className="px-3 py-2 text-left">商品</th><th className="px-3 py-2 text-right">金额</th><th className="px-3 py-2 text-left">自动</th><th className="px-3 py-2 text-center">操作</th></tr></thead>
          <tbody>
            {records.map(r => (
              <tr key={r.id as string} className="border-t hover:bg-gray-50">
                <td className="px-3 py-2">{r.expense_date as string}</td>
                <td className="px-3 py-2">{r.canteen_name as string || '-'}</td>
                <td className="px-3 py-2">{r.category as string}</td>
                <td className="px-3 py-2 text-gray-500">{[r.product_category_name, r.product_name, r.product_spec_name].filter(Boolean).join(' / ') || '-'}</td>
                <td className="px-3 py-2 text-right">{fmt(r.amount)}</td>
                <td className="px-3 py-2">{r.is_auto_generated ? <span className="text-xs text-blue-500">自动</span> : ''}</td>
                <td className="px-3 py-2 text-center"><button onClick={() => deleteRecord(r.id as string)} className="text-red-600 hover:underline text-xs">删除</button></td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="flex justify-between items-center px-4 py-3 text-sm text-gray-500 border-t">
          <span>共 {total} 条</span>
          <div className="flex gap-2"><button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1} className="px-3 py-1 border rounded disabled:opacity-30">上一页</button><button onClick={() => setPage(p => p + 1)} disabled={records.length < 10} className="px-3 py-1 border rounded disabled:opacity-30">下一页</button></div>
        </div>
      </div>
    </div>
  );
}

/* ─── SETTINGS PAGE ─── */
type SettingsTab = 'my_account' | 'canteens' | 'stalls' | 'fixed_expenses' | 'meal_types' | 'accounts' | 'products' | 'logs';

function SettingsPage({ user }: { user: AuthUser }) {
  const isStallManager = user.role_code === 'STALL_MANAGER';
  const isCompanyManager = user.role_code === 'COMPANY_MANAGER';
  const isCanteenManager = user.role_code === 'CANTEEN_MANAGER';
  const isDeveloper = user.role_code === 'SYSTEM_DEVELOPER';

  const [tab, setTab] = useState<SettingsTab>('my_account');

  if (isStallManager) return <MyAccountSection user={user} />;

  let tabs: { key: SettingsTab; label: string }[] = [{ key: 'my_account', label: '我的账号' }];
  if (isDeveloper) {
    tabs = tabs.concat([
      { key: 'canteens', label: '食堂管理' }, { key: 'stalls', label: '档口管理' }, { key: 'fixed_expenses', label: '固定支出' },
      { key: 'meal_types', label: '餐别管理' }, { key: 'accounts', label: '账号管理' }, { key: 'products', label: '商品管理' }, { key: 'logs', label: '操作日志' },
    ]);
  } else if (isCompanyManager) {
    tabs = tabs.concat([
      { key: 'canteens', label: '食堂管理' }, { key: 'stalls', label: '档口管理' }, { key: 'fixed_expenses', label: '固定支出' },
      { key: 'meal_types', label: '餐别管理' }, { key: 'accounts', label: '账号管理' }, { key: 'products', label: '商品管理' }, { key: 'logs', label: '操作日志' },
    ]);
  } else if (isCanteenManager) {
    tabs = tabs.concat([
      { key: 'stalls', label: '档口管理' }, { key: 'fixed_expenses', label: '固定支出' },
      { key: 'meal_types', label: '餐别管理' }, { key: 'accounts', label: '账号管理' }, { key: 'products', label: '商品管理' }, { key: 'logs', label: '操作日志' },
    ]);
  }

  return (
    <div>
      <div className="flex flex-wrap gap-1 mb-6 border-b pb-2">
        {tabs.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} className={`px-4 py-2 rounded-t text-sm font-medium transition ${tab === t.key ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-100'}`}>{t.label}</button>
        ))}
      </div>
      {tab === 'my_account' && <MyAccountSection user={user} />}
      {tab === 'canteens' && <CanteenManagerSection />}
      {tab === 'stalls' && <StallManagerSection />}
      {tab === 'fixed_expenses' && <FixedExpenseManager />}
      {tab === 'meal_types' && <MealTypeManager />}
      {tab === 'accounts' && <AccountManager user={user} />}
      {tab === 'products' && <ProductManager />}
      {tab === 'logs' && <OperationLogViewer />}
    </div>
  );
}

/* ─── MY ACCOUNT ─── */
function MyAccountSection({ user }: { user: AuthUser }) {
  const [oldPw, setOldPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [companyName, setCompanyName] = useState(user.company_name || user.org_name || '');
  const [msg, setMsg] = useState('');
  const [errMsg, setErrMsg] = useState('');

  const companyId = user.role_code === 'COMPANY_MANAGER' ? user.org_id : null;

  const changePassword = async () => {
    if (!oldPw || !newPw) { setErrMsg('请填写旧密码和新密码'); return; }
    const res = await apiFetch<ApiResp>('/api/settings/users/self/password', { method: 'PUT', body: JSON.stringify({ old_password: oldPw, new_password: newPw }) });
    if (res.success) { setMsg('密码修改成功'); setOldPw(''); setNewPw(''); setErrMsg(''); } else { setErrMsg(res.error || '修改失败'); setMsg(''); }
  };

  const updateCompanyName = async () => {
    if (!companyId) { setErrMsg('仅公司负责人可修改公司名称'); return; }
    if (!companyName.trim()) { setErrMsg('公司名称不能为空'); return; }
    const res = await apiFetch<ApiResp>(`/api/companies/${companyId}`, { method: 'PUT', body: JSON.stringify({ name: companyName.trim() }) });
    if (res.success) { setMsg('公司名称修改成功'); setErrMsg(''); } else { setErrMsg(res.error || '修改失败'); setMsg(''); }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl shadow p-5">
        <h3 className="font-semibold text-gray-700 mb-4">我的账号 — {user.real_name || user.username}</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div><span className="text-gray-500">账号名称：</span><span className="font-medium">{user.real_name || user.username}</span></div>
          <div><span className="text-gray-500">角色：</span><span className="font-medium">{ROLE_LABEL[user.role_code] || user.role_code}</span></div>
          <div><span className="text-gray-500">公司名称：</span>
            {companyId ? (
              <span className="inline-flex items-center gap-2">
                <input value={companyName} onChange={e => setCompanyName(e.target.value)} className="border rounded px-2 py-1 text-sm" />
                <button onClick={updateCompanyName} className="text-blue-600 text-xs hover:underline">保存</button>
              </span>
            ) : <span className="font-medium">{user.company_name || user.org_name || '-'}</span>}
          </div>
          <div><span className="text-gray-500">有效期：</span>
            <span className="font-medium">{user.expires_at ? new Date(user.expires_at).toLocaleDateString('zh-CN') : '永久'}</span>
            {user.role_code !== 'SYSTEM_DEVELOPER' && <span className="text-xs text-gray-400 ml-2">（由开发者设定，到期后账号停用）</span>}
          </div>
        </div>
        {msg && <div className="mt-3 text-green-600 text-sm">{msg}</div>}
        {errMsg && <div className="mt-3 text-red-600 text-sm">{errMsg}</div>}
      </div>

      <div className="bg-white rounded-xl shadow p-5">
        <h3 className="font-semibold text-gray-700 mb-4">修改密码</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div><label className="block text-xs font-medium text-gray-600 mb-1">旧密码</label><input type="password" value={oldPw} onChange={e => setOldPw(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm" /></div>
          <div><label className="block text-xs font-medium text-gray-600 mb-1">新密码</label><input type="password" value={newPw} onChange={e => setNewPw(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm" /></div>
        </div>
        <button onClick={changePassword} className="mt-4 bg-blue-600 text-white px-6 py-2 rounded-lg text-sm hover:bg-blue-700">修改密码</button>
      </div>
    </div>
  );
}

/* ─── CANTEEN MANAGER ─── */
function CanteenManagerSection() {
  const [canteens, setCanteens] = useState<Record<string, unknown>[]>([]);
  const [users, setUsers] = useState<Record<string, unknown>[]>([]);
  const [companies, setCompanies] = useState<Record<string, unknown>[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', address: '', contact_name: '', contact_phone: '', manager_id: '', company_id: '' });

  const load = useCallback(async () => {
    const [cRes, uRes, coRes] = await Promise.all([apiFetch<ApiResp>('/api/companies'), apiFetch<ApiResp>('/api/users?role_code=CANTEEN_MANAGER'), apiFetch<ApiResp>('/api/companies')]);
    if (cRes.success && cRes.data) {
      const cos = cRes.data as Record<string, unknown>[];
      setCompanies(cos);
      const allCanteens: Record<string, unknown>[] = [];
      for (const c of cos) {
        const res = await apiFetch<ApiResp>(`/api/companies/${c.id}/canteens`);
        if (res.success && res.data) allCanteens.push(...(res.data as Record<string, unknown>[]).map(cn => ({ ...cn, company_name: c.name })));
      }
      setCanteens(allCanteens);
    }
    if (uRes.success && uRes.data) setUsers(uRes.data as Record<string, unknown>[]);
  }, []);

  useEffect(() => { load(); }, [load]);

  const submit = async () => {
    if (!form.name.trim()) { alert('食堂名称不能为空'); return; }
    if (editingId) {
      const res = await apiFetch<ApiResp>(`/api/canteens/${editingId}`, { method: 'PUT', body: JSON.stringify(form) });
      if (res.success) { setShowForm(false); setEditingId(null); load(); } else alert(res.error);
    } else {
      if (!form.company_id) { alert('请选择公司'); return; }
      const res = await apiFetch<ApiResp>(`/api/companies/${form.company_id}/canteens`, { method: 'POST', body: JSON.stringify(form) });
      if (res.success) { setShowForm(false); load(); } else alert(res.error);
    }
  };

  const startEdit = (c: Record<string, unknown>) => {
    setEditingId(c.id as string);
    setForm({ name: c.name as string || '', address: c.address as string || '', contact_name: c.contact_name as string || '', contact_phone: c.contact_phone as string || '', manager_id: c.manager_id as string || '', company_id: c.company_id as string || '' });
    setShowForm(true);
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center"><h3 className="font-semibold text-gray-700">食堂管理</h3><button onClick={() => { setShowForm(!showForm); setEditingId(null); setForm({ name: '', address: '', contact_name: '', contact_phone: '', manager_id: '', company_id: companies[0]?.id as string || '' }); }} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm">{showForm && !editingId ? '取消' : '新增食堂'}</button></div>
      {showForm && (
        <div className="bg-white rounded-xl shadow p-5">
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
            <div><label className="block text-xs font-medium text-gray-600 mb-1">食堂名称 *</label><input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm" /></div>
            <div><label className="block text-xs font-medium text-gray-600 mb-1">地址</label><input value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm" /></div>
            <div><label className="block text-xs font-medium text-gray-600 mb-1">联系人</label><input value={form.contact_name} onChange={e => setForm(f => ({ ...f, contact_name: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm" /></div>
            <div><label className="block text-xs font-medium text-gray-600 mb-1">联系电话</label><input value={form.contact_phone} onChange={e => setForm(f => ({ ...f, contact_phone: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm" /></div>
            <div><label className="block text-xs font-medium text-gray-600 mb-1">食堂负责人</label><select value={form.manager_id} onChange={e => setForm(f => ({ ...f, manager_id: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm"><option value="">选择负责人</option>{users.map(u => <option key={u.id as string} value={u.id as string}>{u.real_name as string || u.username as string}</option>)}</select></div>
            {!editingId && <div><label className="block text-xs font-medium text-gray-600 mb-1">所属公司 *</label><select value={form.company_id} onChange={e => setForm(f => ({ ...f, company_id: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm"><option value="">选择公司</option>{companies.map(c => <option key={c.id as string} value={c.id as string}>{c.name as string}</option>)}</select></div>}
          </div>
          <div className="flex gap-2 mt-4"><button onClick={submit} className="bg-blue-600 text-white px-6 py-2 rounded-lg text-sm">{editingId ? '保存' : '创建'}</button><button onClick={() => { setShowForm(false); setEditingId(null); }} className="bg-gray-200 text-gray-700 px-6 py-2 rounded-lg text-sm">取消</button></div>
        </div>
      )}
      <div className="bg-white rounded-xl shadow overflow-hidden">
        <table className="w-full text-sm">
          <thead><tr className="bg-gray-50"><th className="px-3 py-2 text-left">名称</th><th className="px-3 py-2 text-left">公司</th><th className="px-3 py-2 text-left">地址</th><th className="px-3 py-2 text-left">负责人</th><th className="px-3 py-2 text-center">操作</th></tr></thead>
          <tbody>{canteens.map(c => (<tr key={c.id as string} className="border-t hover:bg-gray-50"><td className="px-3 py-2">{c.name as string}</td><td className="px-3 py-2 text-gray-500">{c.company_name as string || '-'}</td><td className="px-3 py-2 text-gray-500">{c.address as string || '-'}</td><td className="px-3 py-2">{users.find(u => u.id === c.manager_id)?.real_name as string || '-'}</td><td className="px-3 py-2 text-center"><button onClick={() => startEdit(c)} className="text-blue-600 hover:underline text-xs">编辑</button></td></tr>))}</tbody>
        </table>
      </div>
    </div>
  );
}

/* ─── STALL MANAGER ─── */
function StallManagerSection() {
  const [canteens, setCanteens] = useState<Record<string, unknown>[]>([]);
  const [stalls, setStalls] = useState<Record<string, unknown>[]>([]);
  const [stallManagers, setStallManagers] = useState<Record<string, unknown>[]>([]);
  const [selectedCanteen, setSelectedCanteen] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', manager_id: '' });

  const load = useCallback(async () => {
    const [cRes, mRes] = await Promise.all([apiFetch<ApiResp>('/api/dropdown/canteens'), apiFetch<ApiResp>('/api/dropdown/stall-managers')]);
    if (cRes.success && cRes.data) setCanteens(cRes.data as Record<string, unknown>[]);
    if (mRes.success && mRes.data) setStallManagers(mRes.data as Record<string, unknown>[]);
  }, []);

  const loadStalls = useCallback(async () => {
    if (!selectedCanteen) { setStalls([]); return; }
    const res = await apiFetch<ApiResp>(`/api/canteens/${selectedCanteen}/stalls`);
    if (res.success && res.data) setStalls(res.data as Record<string, unknown>[]);
  }, [selectedCanteen]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { loadStalls(); }, [loadStalls]);

  const submit = async () => {
    if (!form.name.trim() || !selectedCanteen) { alert('请填写档口名称并选择食堂'); return; }
    if (editingId) {
      const res = await apiFetch<ApiResp>(`/api/stalls/${editingId}`, { method: 'PUT', body: JSON.stringify({ name: form.name, manager_id: form.manager_id || null }) });
      if (res.success) { setShowForm(false); setEditingId(null); setForm({ name: '', manager_id: '' }); loadStalls(); } else alert(res.error);
    } else {
      const res = await apiFetch<ApiResp>(`/api/canteens/${selectedCanteen}/stalls`, { method: 'POST', body: JSON.stringify({ name: form.name, manager_id: form.manager_id || null }) });
      if (res.success) { setShowForm(false); setForm({ name: '', manager_id: '' }); loadStalls(); } else alert(res.error);
    }
  };

  const startEdit = (s: Record<string, unknown>) => {
    setEditingId(s.id as string);
    setForm({ name: s.name as string || '', manager_id: s.manager_id as string || '' });
    setShowForm(true);
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center"><h3 className="font-semibold text-gray-700">档口管理</h3><button onClick={() => { setShowForm(!showForm); setEditingId(null); setForm({ name: '', manager_id: '' }); }} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm">{showForm && !editingId ? '取消' : '新增档口'}</button></div>
      <div className="flex items-center gap-3"><label className="text-sm text-gray-600">选择食堂：</label><select value={selectedCanteen} onChange={e => setSelectedCanteen(e.target.value)} className="border rounded-lg px-3 py-2 text-sm"><option value="">请选择</option>{canteens.map(c => <option key={c.id as string} value={c.id as string}>{c.name as string}</option>)}</select></div>
      {showForm && (
        <div className="bg-white rounded-xl shadow p-5">
          <div className="grid grid-cols-2 gap-4">
            <div><label className="block text-xs font-medium text-gray-600 mb-1">档口名称 *</label><input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm" /></div>
            <div><label className="block text-xs font-medium text-gray-600 mb-1">档口负责人</label><select value={form.manager_id} onChange={e => setForm(f => ({ ...f, manager_id: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm"><option value="">选择负责人</option>{stallManagers.map(u => <option key={u.id as string} value={u.id as string}>{u.real_name as string || u.username as string}</option>)}</select></div>
          </div>
          <div className="flex gap-2 mt-4"><button onClick={submit} className="bg-blue-600 text-white px-6 py-2 rounded-lg text-sm">{editingId ? '保存' : '创建'}</button><button onClick={() => { setShowForm(false); setEditingId(null); }} className="bg-gray-200 text-gray-700 px-6 py-2 rounded-lg text-sm">取消</button></div>
        </div>
      )}
      <div className="bg-white rounded-xl shadow overflow-hidden">
        <table className="w-full text-sm">
          <thead><tr className="bg-gray-50"><th className="px-3 py-2 text-left">名称</th><th className="px-3 py-2 text-left">负责人</th><th className="px-3 py-2 text-center">操作</th></tr></thead>
          <tbody>{stalls.map(s => (<tr key={s.id as string} className="border-t hover:bg-gray-50"><td className="px-3 py-2">{s.name as string}</td><td className="px-3 py-2">{stallManagers.find(u => u.id === s.manager_id)?.real_name as string || '-'}</td><td className="px-3 py-2 text-center"><button onClick={() => startEdit(s)} className="text-blue-600 hover:underline text-xs">编辑</button></td></tr>))}</tbody>
        </table>
      </div>
    </div>
  );
}

/* ─── FIXED EXPENSE MANAGER ─── */
function FixedExpenseManager() {
  const [canteens, setCanteens] = useState<Record<string, unknown>[]>([]);
  const [expenses, setExpenses] = useState<Record<string, unknown>[]>([]);
  const [selectedCanteen, setSelectedCanteen] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ expense_name: '', monthly_amount: '', start_date: '', end_date: '' });

  const load = useCallback(async () => { const res = await apiFetch<ApiResp>('/api/dropdown/canteens'); if (res.success && res.data) setCanteens(res.data as Record<string, unknown>[]); }, []);
  const loadExpenses = useCallback(async () => { if (!selectedCanteen) { setExpenses([]); return; } const res = await apiFetch<ApiResp>(`/api/settings/fixed-expenses?canteen_id=${selectedCanteen}`); if (res.success && res.data) setExpenses(res.data as Record<string, unknown>[]); }, [selectedCanteen]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { loadExpenses(); }, [loadExpenses]);

  const submit = async () => {
    if (!form.expense_name.trim() || !form.monthly_amount || !selectedCanteen) { alert('请填写费用名称、月金额并选择食堂'); return; }
    const body = { canteen_id: selectedCanteen, expense_name: form.expense_name.trim(), monthly_amount: num(form.monthly_amount), start_date: form.start_date || null, end_date: form.end_date || null };
    const url = editingId ? `/api/settings/fixed-expenses/${editingId}` : '/api/settings/fixed-expenses';
    const method = editingId ? 'PUT' : 'POST';
    const res = await apiFetch<ApiResp>(url, { method, body: JSON.stringify(body) });
    if (res.success) { setShowForm(false); setEditingId(null); setForm({ expense_name: '', monthly_amount: '', start_date: '', end_date: '' }); loadExpenses(); } else alert(res.error);
  };

  const deleteExpense = async (id: string) => { if (!confirm('确认删除？')) return; const res = await apiFetch<ApiResp>(`/api/settings/fixed-expenses/${id}`, { method: 'DELETE' }); if (res.success) loadExpenses(); else alert(res.error); };
  const startEdit = (fe: Record<string, unknown>) => { setEditingId(fe.id as string); setForm({ expense_name: fe.expense_name as string || '', monthly_amount: String(fe.monthly_amount || ''), start_date: fe.start_date as string || '', end_date: fe.end_date as string || '' }); setShowForm(true); };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center"><h3 className="font-semibold text-gray-700">固定支出</h3><button onClick={() => { setShowForm(!showForm); setEditingId(null); setForm({ expense_name: '', monthly_amount: '', start_date: '', end_date: '' }); }} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm">{showForm && !editingId ? '取消' : '新增'}</button></div>
      <div className="flex items-center gap-3"><label className="text-sm text-gray-600">选择食堂：</label><select value={selectedCanteen} onChange={e => setSelectedCanteen(e.target.value)} className="border rounded-lg px-3 py-2 text-sm"><option value="">请选择</option>{canteens.map(c => <option key={c.id as string} value={c.id as string}>{c.name as string}</option>)}</select></div>
      {showForm && (<div className="bg-white rounded-xl shadow p-5"><div className="grid grid-cols-2 lg:grid-cols-4 gap-4"><div><label className="block text-xs font-medium text-gray-600 mb-1">费用名称 *</label><input value={form.expense_name} onChange={e => setForm(f => ({ ...f, expense_name: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="如：房租、物业费" /></div><div><label className="block text-xs font-medium text-gray-600 mb-1">月金额 *</label><input type="number" step="0.01" value={form.monthly_amount} onChange={e => setForm(f => ({ ...f, monthly_amount: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm" /></div><div><label className="block text-xs font-medium text-gray-600 mb-1">开始日期</label><input type="date" value={form.start_date} onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm" /></div><div><label className="block text-xs font-medium text-gray-600 mb-1">结束日期</label><input type="date" value={form.end_date} onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm" /></div></div><div className="flex gap-2 mt-4"><button onClick={submit} className="bg-blue-600 text-white px-6 py-2 rounded-lg text-sm">{editingId ? '保存' : '创建'}</button><button onClick={() => { setShowForm(false); setEditingId(null); }} className="bg-gray-200 text-gray-700 px-6 py-2 rounded-lg text-sm">取消</button></div></div>)}
      <div className="bg-white rounded-xl shadow overflow-hidden"><table className="w-full text-sm"><thead><tr className="bg-gray-50"><th className="px-3 py-2 text-left">费用名称</th><th className="px-3 py-2 text-right">月金额</th><th className="px-3 py-2 text-right">日均</th><th className="px-3 py-2 text-left">起止日期</th><th className="px-3 py-2 text-center">操作</th></tr></thead><tbody>{expenses.map(fe => (<tr key={fe.id as string} className="border-t hover:bg-gray-50"><td className="px-3 py-2">{fe.expense_name as string}</td><td className="px-3 py-2 text-right">{fmt(fe.monthly_amount)}</td><td className="px-3 py-2 text-right">{fmt(fe.daily_amount)}</td><td className="px-3 py-2 text-gray-500">{fe.start_date as string || ''} ~ {fe.end_date as string || ''}</td><td className="px-3 py-2 text-center"><button onClick={() => startEdit(fe)} className="text-blue-600 hover:underline text-xs mr-2">编辑</button><button onClick={() => deleteExpense(fe.id as string)} className="text-red-600 hover:underline text-xs">删除</button></td></tr>))}</tbody></table></div>
    </div>
  );
}

/* ─── MEAL TYPE MANAGER ─── */
function MealTypeManager() {
  const [canteens, setCanteens] = useState<Record<string, unknown>[]>([]);
  const [mealTypes, setMealTypes] = useState<Record<string, unknown>[]>([]);
  const [selectedCanteen, setSelectedCanteen] = useState('');
  const [newName, setNewName] = useState('');

  useEffect(() => { apiFetch<ApiResp>('/api/dropdown/canteens').then(res => { if (res.success && res.data) setCanteens(res.data as Record<string, unknown>[]); }); }, []);
  useEffect(() => { if (!selectedCanteen) { setMealTypes([]); return; } apiFetch<ApiResp>(`/api/meal-types?canteen_id=${selectedCanteen}`).then(res => { if (res.success && res.data) setMealTypes(res.data as Record<string, unknown>[]); }); }, [selectedCanteen]);

  const add = async () => { if (!newName.trim() || !selectedCanteen) return; const res = await apiFetch<ApiResp>('/api/meal-types', { method: 'POST', body: JSON.stringify({ name: newName.trim(), canteen_id: selectedCanteen }) }); if (res.success) { setNewName(''); apiFetch<ApiResp>(`/api/meal-types?canteen_id=${selectedCanteen}`).then(res => { if (res.success && res.data) setMealTypes(res.data as Record<string, unknown>[]); }); } else alert(res.error); };
  const del = async (id: string) => { if (!confirm('确认删除？')) return; const res = await apiFetch<ApiResp>(`/api/meal-types/${id}`, { method: 'DELETE' }); if (res.success) apiFetch<ApiResp>(`/api/meal-types?canteen_id=${selectedCanteen}`).then(res => { if (res.success && res.data) setMealTypes(res.data as Record<string, unknown>[]); }); };

  return (<div className="space-y-4"><h3 className="font-semibold text-gray-700">餐别管理</h3><div className="flex items-center gap-3"><label className="text-sm text-gray-600">食堂：</label><select value={selectedCanteen} onChange={e => setSelectedCanteen(e.target.value)} className="border rounded-lg px-3 py-2 text-sm"><option value="">请选择</option>{canteens.map(c => <option key={c.id as string} value={c.id as string}>{c.name as string}</option>)}</select></div><div className="flex gap-2"><input value={newName} onChange={e => setNewName(e.target.value)} placeholder="餐别名称（如：早餐）" className="border rounded-lg px-3 py-2 text-sm flex-1" /><button onClick={add} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm">添加</button></div><div className="bg-white rounded-xl shadow overflow-hidden"><table className="w-full text-sm"><thead><tr className="bg-gray-50"><th className="px-3 py-2 text-left">名称</th><th className="px-3 py-2 text-center">操作</th></tr></thead><tbody>{mealTypes.map(m => <tr key={m.id as string} className="border-t"><td className="px-3 py-2">{m.name as string}</td><td className="px-3 py-2 text-center"><button onClick={() => del(m.id as string)} className="text-red-600 hover:underline text-xs">删除</button></td></tr>)}</tbody></table></div></div>);
}

/* ─── ACCOUNT MANAGER ─── */
function AccountManager({ user: currentUser }: { user: AuthUser }) {
  const [users, setUsers] = useState<Record<string, unknown>[]>([]);
  const [canteens, setCanteens] = useState<Record<string, unknown>[]>([]);
  const [stalls, setStalls] = useState<Record<string, unknown>[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const isCompanyManager = currentUser.role_code === 'COMPANY_MANAGER';
  const isCanteenManager = currentUser.role_code === 'CANTEEN_MANAGER';

  // Role options based on current user's role
  const roleOptions = isCompanyManager
    ? [{ value: 'CANTEEN_MANAGER', label: '食堂负责人' }, { value: 'STALL_MANAGER', label: '档口负责人' }]
    : isCanteenManager
      ? [{ value: 'STALL_MANAGER', label: '档口负责人' }]
      : [{ value: 'CANTEEN_MANAGER', label: '食堂负责人' }, { value: 'STALL_MANAGER', label: '档口负责人' }];

  const defaultRole = roleOptions[0].value;
  const [form, setForm] = useState({ username: '', real_name: '', role_code: defaultRole, org_id: '', password: '', expires_at: '' });

  const load = useCallback(async () => {
    const [uRes, cRes] = await Promise.all([apiFetch<ApiResp>('/api/users'), apiFetch<ApiResp>('/api/dropdown/canteens')]);
    if (uRes.success && uRes.data) setUsers(uRes.data as Record<string, unknown>[]);
    if (cRes.success && cRes.data) setCanteens(cRes.data as Record<string, unknown>[]);
  }, []);

  useEffect(() => { load(); apiFetch<ApiResp>('/api/dropdown/stalls').then(res => { if (res.success && res.data) setStalls(res.data as Record<string, unknown>[]); }); }, [load]);

  const orgOptions = form.role_code === 'CANTEEN_MANAGER' ? canteens : form.role_code === 'STALL_MANAGER' ? stalls : [];

  const submit = async () => {
    if (!form.real_name.trim()) { alert('请填写姓名'); return; }
    if (editingId) {
      const body: Record<string, unknown> = { real_name: form.real_name.trim(), role_code: form.role_code, org_id: form.org_id || null };
      if (form.password) body.password = form.password;
      if (form.expires_at) body.expires_at = form.expires_at; else if (form.expires_at === '') body.expires_at = null;
      const res = await apiFetch<ApiResp>(`/api/users/${editingId}`, { method: 'PUT', body: JSON.stringify(body) });
      if (res.success) { setShowForm(false); setEditingId(null); setForm({ username: '', real_name: '', role_code: defaultRole, org_id: '', password: '', expires_at: '' }); load(); } else alert(res.error);
    } else {
      if (!form.username.trim() || !form.password) { alert('新建账号需填写用户名和密码'); return; }
      const body = { username: form.username.trim(), real_name: form.real_name.trim(), role_code: form.role_code, org_id: form.org_id || null, password: form.password, expires_at: form.expires_at || null };
      const res = await apiFetch<ApiResp>('/api/users', { method: 'POST', body: JSON.stringify(body) });
      if (res.success) { setShowForm(false); setForm({ username: '', real_name: '', role_code: defaultRole, org_id: '', password: '', expires_at: '' }); load(); } else alert(res.error);
    }
  };

  const startEdit = (u: Record<string, unknown>) => {
    setEditingId(u.id as string);
    setForm({ username: u.username as string || '', real_name: u.real_name as string || '', role_code: u.role_code as string || defaultRole, org_id: u.org_id as string || '', password: '', expires_at: u.expires_at as string ? (u.expires_at as string).slice(0, 10) : '' });
    setShowForm(true);
  };

  const toggleDisable = async (u: Record<string, unknown>) => { const action = u.is_disabled ? '启用' : '禁用'; if (!confirm(`确认${action}此账号？`)) return; const res = await apiFetch<ApiResp>(`/api/settings/users/${u.id}/disable`, { method: 'PUT', body: JSON.stringify({ is_disabled: !u.is_disabled }) }); if (res.success) load(); else alert(res.error); };
  const resetPw = async (u: Record<string, unknown>) => { if (!confirm('确认重置密码为默认密码？')) return; const res = await apiFetch<ApiResp>(`/api/settings/users/${u.id}/reset-password`, { method: 'PUT' }); if (res.success) alert('密码已重置'); else alert(res.error); };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center"><h3 className="font-semibold text-gray-700">账号管理</h3><button onClick={() => { setShowForm(!showForm); setEditingId(null); setForm({ username: '', real_name: '', role_code: defaultRole, org_id: '', password: '', expires_at: '' }); }} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm">{showForm && !editingId ? '取消' : '新增账号'}</button></div>
      {showForm && (<div className="bg-white rounded-xl shadow p-5"><h4 className="font-medium text-gray-600 mb-3">{editingId ? '编辑账号' : '新增账号'}</h4><div className="grid grid-cols-2 lg:grid-cols-3 gap-4"><div><label className="block text-xs font-medium text-gray-600 mb-1">用户名 {!editingId && '*'}</label><input value={form.username} onChange={e => setForm(f => ({ ...f, username: e.target.value }))} disabled={!!editingId} className="w-full border rounded-lg px-3 py-2 text-sm disabled:bg-gray-100" /></div><div><label className="block text-xs font-medium text-gray-600 mb-1">姓名 *</label><input value={form.real_name} onChange={e => setForm(f => ({ ...f, real_name: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm" /></div><div><label className="block text-xs font-medium text-gray-600 mb-1">角色</label><select value={form.role_code} onChange={e => setForm(f => ({ ...f, role_code: e.target.value, org_id: '' }))} className="w-full border rounded-lg px-3 py-2 text-sm">{roleOptions.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}</select></div><div><label className="block text-xs font-medium text-gray-600 mb-1">{form.role_code === 'CANTEEN_MANAGER' ? '所属食堂' : '所属档口'}</label><select value={form.org_id} onChange={e => setForm(f => ({ ...f, org_id: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm"><option value="">选择{form.role_code === 'CANTEEN_MANAGER' ? '食堂' : '档口'}</option>{orgOptions.map(o => <option key={o.id as string} value={o.id as string}>{o.name as string}</option>)}</select></div><div><label className="block text-xs font-medium text-gray-600 mb-1">{editingId ? '新密码（留空不改）' : '密码 *'}</label><input type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm" /></div><div><label className="block text-xs font-medium text-gray-600 mb-1">有效期</label><input type="date" value={form.expires_at} onChange={e => setForm(f => ({ ...f, expires_at: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="留空永久" /></div></div><div className="flex gap-2 mt-4"><button onClick={submit} className="bg-blue-600 text-white px-6 py-2 rounded-lg text-sm">{editingId ? '保存' : '创建'}</button><button onClick={() => { setShowForm(false); setEditingId(null); }} className="bg-gray-200 text-gray-700 px-6 py-2 rounded-lg text-sm">取消</button></div></div>)}
      <div className="bg-white rounded-xl shadow overflow-hidden"><table className="w-full text-sm"><thead><tr className="bg-gray-50"><th className="px-3 py-2 text-left">用户名</th><th className="px-3 py-2 text-left">姓名</th><th className="px-3 py-2 text-left">角色</th><th className="px-3 py-2 text-left">有效期</th><th className="px-3 py-2 text-left">状态</th><th className="px-3 py-2 text-center">操作</th></tr></thead><tbody>{users.map(u => (<tr key={u.id as string} className="border-t hover:bg-gray-50"><td className="px-3 py-2">{u.username as string}</td><td className="px-3 py-2">{u.real_name as string || ''}</td><td className="px-3 py-2">{ROLE_LABEL[u.role_code as string] || '-'}</td><td className="px-3 py-2">{u.expires_at ? new Date(u.expires_at as string).toLocaleDateString('zh-CN') : '永久'}</td><td className="px-3 py-2">{u.is_disabled ? <span className="text-red-500">已禁用</span> : <span className="text-green-600">正常</span>}</td><td className="px-3 py-2 text-center space-x-1"><button onClick={() => startEdit(u)} className="text-blue-600 hover:underline text-xs">编辑</button><button onClick={() => toggleDisable(u)} className="text-orange-600 hover:underline text-xs">{u.is_disabled ? '启用' : '禁用'}</button><button onClick={() => resetPw(u)} className="text-gray-600 hover:underline text-xs">重置密码</button></td></tr>))}</tbody></table></div>
    </div>
  );
}

/* ─── PRODUCT MANAGER ─── */
function ProductManager() {
  const [categories, setCategories] = useState<Record<string, unknown>[]>([]);
  const [products, setProducts] = useState<Record<string, unknown>[]>([]);
  const [specs, setSpecs] = useState<Record<string, unknown>[]>([]);
  const [selectedCat, setSelectedCat] = useState('');
  const [selectedProd, setSelectedProd] = useState('');
  const [newCatName, setNewCatName] = useState('');
  const [newProdName, setNewProdName] = useState('');
  const [newSpecName, setNewSpecName] = useState('');

  const loadCats = useCallback(async () => { const res = await apiFetch<ApiResp>('/api/settings/products/categories'); if (res.success && res.data) setCategories(res.data as Record<string, unknown>[]); }, []);
  const loadProds = useCallback(async () => { if (!selectedCat) { setProducts([]); return; } const res = await apiFetch<ApiResp>(`/api/settings/products?category_id=${selectedCat}`); if (res.success && res.data) setProducts(res.data as Record<string, unknown>[]); }, [selectedCat]);
  const loadSpecs_ = useCallback(async () => { if (!selectedProd) { setSpecs([]); return; } const res = await apiFetch<ApiResp>(`/api/settings/products/specs?product_id=${selectedProd}`); if (res.success && res.data) setSpecs(res.data as Record<string, unknown>[]); }, [selectedProd]);

  useEffect(() => { loadCats(); }, [loadCats]);
  useEffect(() => { loadProds(); setSelectedProd(''); }, [loadProds]);
  useEffect(() => { loadSpecs_(); }, [loadSpecs_]);

  const addCat = async () => { if (!newCatName.trim()) return; const res = await apiFetch<ApiResp>('/api/settings/products/categories', { method: 'POST', body: JSON.stringify({ name: newCatName.trim() }) }); if (res.success) { setNewCatName(''); loadCats(); } else alert(res.error); };
  const addProd = async () => { if (!newProdName.trim() || !selectedCat) return; const res = await apiFetch<ApiResp>('/api/settings/products', { method: 'POST', body: JSON.stringify({ name: newProdName.trim(), category_id: selectedCat }) }); if (res.success) { setNewProdName(''); loadProds(); } else alert(res.error); };
  const addSpec = async () => { if (!newSpecName.trim() || !selectedProd) return; const res = await apiFetch<ApiResp>('/api/settings/products/specs', { method: 'POST', body: JSON.stringify({ name: newSpecName.trim(), product_id: selectedProd }) }); if (res.success) { setNewSpecName(''); loadSpecs_(); } else alert(res.error); };
  const delCat = async (id: string) => { if (!confirm('删除品类将同时删除下属商品和规格')) return; const r = await apiFetch<ApiResp>(`/api/settings/products/categories/${id}`, { method: 'DELETE' }); if (r.success) { loadCats(); setSelectedCat(''); } };
  const delProd = async (id: string) => { if (!confirm('确认删除？')) return; const r = await apiFetch<ApiResp>(`/api/settings/products/${id}`, { method: 'DELETE' }); if (r.success) { loadProds(); setSelectedProd(''); } };
  const delSpec = async (id: string) => { if (!confirm('确认删除？')) return; const r = await apiFetch<ApiResp>(`/api/settings/products/specs/${id}`, { method: 'DELETE' }); if (r.success) loadSpecs_(); };

  return (<div className="space-y-4"><h3 className="font-semibold text-gray-700">商品管理（品类 → 商品 → 规格）</h3><div className="grid grid-cols-1 lg:grid-cols-3 gap-6"><div className="bg-white rounded-xl shadow p-4"><h4 className="font-medium text-gray-600 mb-3">商品品类</h4><div className="flex gap-2 mb-3"><input value={newCatName} onChange={e => setNewCatName(e.target.value)} placeholder="品类名称" className="border rounded px-2 py-1 text-sm flex-1" /><button onClick={addCat} className="bg-blue-600 text-white px-3 py-1 rounded text-sm">添加</button></div>{categories.map(c => <div key={c.id as string} className={`flex justify-between items-center px-2 py-1 rounded cursor-pointer text-sm ${selectedCat === c.id ? 'bg-blue-50 text-blue-700' : 'hover:bg-gray-50'}`} onClick={() => setSelectedCat(c.id as string)}><span>{c.name as string}</span><button onClick={e => { e.stopPropagation(); delCat(c.id as string); }} className="text-red-400 text-xs">删除</button></div>)}</div><div className="bg-white rounded-xl shadow p-4"><h4 className="font-medium text-gray-600 mb-3">商品</h4><div className="flex gap-2 mb-3"><input value={newProdName} onChange={e => setNewProdName(e.target.value)} placeholder="商品名称" className="border rounded px-2 py-1 text-sm flex-1" disabled={!selectedCat} /><button onClick={addProd} className="bg-blue-600 text-white px-3 py-1 rounded text-sm" disabled={!selectedCat}>添加</button></div>{products.map(p => <div key={p.id as string} className={`flex justify-between items-center px-2 py-1 rounded cursor-pointer text-sm ${selectedProd === p.id ? 'bg-blue-50 text-blue-700' : 'hover:bg-gray-50'}`} onClick={() => setSelectedProd(p.id as string)}><span>{p.name as string}</span><button onClick={e => { e.stopPropagation(); delProd(p.id as string); }} className="text-red-400 text-xs">删除</button></div>)}</div><div className="bg-white rounded-xl shadow p-4"><h4 className="font-medium text-gray-600 mb-3">规格</h4><div className="flex gap-2 mb-3"><input value={newSpecName} onChange={e => setNewSpecName(e.target.value)} placeholder="规格名称（如：斤、千克、箱）" className="border rounded px-2 py-1 text-sm flex-1" disabled={!selectedProd} /><button onClick={addSpec} className="bg-blue-600 text-white px-3 py-1 rounded text-sm" disabled={!selectedProd}>添加</button></div>{specs.map(s => <div key={s.id as string} className="flex justify-between items-center px-2 py-1 text-sm hover:bg-gray-50"><span>{s.name as string}</span><button onClick={() => delSpec(s.id as string)} className="text-red-400 text-xs">删除</button></div>)}</div></div></div>);
}

/* ─── OPERATION LOG VIEWER ─── */
function OperationLogViewer() {
  const [logs, setLogs] = useState<Record<string, unknown>[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);

  useEffect(() => { apiFetch<ApiResp>(`/api/settings/operation-logs?page=${page}&page_size=20`).then(res => { if (res.success && res.data) { const d = res.data as Record<string, unknown>; setLogs((d.records || []) as Record<string, unknown>[]); setTotal(num(d.total)); } }); }, [page]);

  return (<div className="space-y-4"><h3 className="font-semibold text-gray-700">操作日志</h3><div className="bg-white rounded-xl shadow overflow-hidden"><table className="w-full text-sm"><thead><tr className="bg-gray-50"><th className="px-3 py-2 text-left">时间</th><th className="px-3 py-2 text-left">用户</th><th className="px-3 py-2 text-left">操作</th><th className="px-3 py-2 text-left">详情</th></tr></thead><tbody>{logs.map(l => <tr key={l.id as string} className="border-t"><td className="px-3 py-2 whitespace-nowrap">{l.created_at as string ? new Date(l.created_at as string).toLocaleString('zh-CN') : ''}</td><td className="px-3 py-2">{l.username as string || ''}</td><td className="px-3 py-2">{l.action as string || ''}</td><td className="px-3 py-2 text-gray-500 max-w-xs truncate">{l.detail as string || ''}</td></tr>)}</tbody></table></div><div className="flex justify-between items-center text-sm text-gray-500"><span>共 {total} 条</span><div className="flex gap-2"><button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1} className="px-3 py-1 border rounded disabled:opacity-30">上一页</button><button onClick={() => setPage(p => p + 1)} disabled={logs.length < 20} className="px-3 py-1 border rounded disabled:opacity-30">下一页</button></div></div></div>);
}

/* ─── MAIN APP ─── */
type Tab = 'dashboard' | 'revenue' | 'expense' | 'settings';

export default function Home() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [tab, setTab] = useState<Tab>('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      apiFetch<ApiResp>('/api/auth/me').then(res => {
        if (res.success && res.data) setUser(res.data as AuthUser);
        else localStorage.removeItem('token');
      });
    }
  }, []);

  const logout = () => { localStorage.removeItem('token'); setUser(null); };

  if (!user) return <LoginPage onLogin={setUser} />;

  const isDeveloper = user.role_code === 'SYSTEM_DEVELOPER';
  const isStallManager = user.role_code === 'STALL_MANAGER';

  // Developer only sees settings (account management)
  if (isDeveloper) {
    return (
      <div className="min-h-screen bg-gray-50 flex">
        <aside className="hidden md:flex w-56 bg-white border-r flex-col">
          <div className="p-4 border-b"><h2 className="font-bold text-gray-800">食堂管理系统</h2><p className="text-xs text-gray-400 mt-1">{user.real_name || user.username} · {ROLE_LABEL[user.role_code]}</p></div>
          <nav className="flex-1 p-2 space-y-1">
            <button className="w-full text-left px-4 py-2 rounded-lg text-sm bg-blue-600 text-white">基础设置</button>
          </nav>
          <div className="p-4 border-t"><button onClick={logout} className="w-full text-left px-4 py-2 rounded-lg text-sm text-red-600 hover:bg-red-50">退出登录</button></div>
        </aside>
        <main className="flex-1 p-6 max-w-6xl mx-auto"><DeveloperView user={user} onSwitchAccount={(u) => { setUser(u); setTab('dashboard'); }} /></main>
      </div>
    );
  }

  // Stall managers only see settings (password change)
  const visibleTabs: { key: Tab; label: string }[] = isStallManager
    ? [{ key: 'settings', label: '基础设置' }]
    : [{ key: 'dashboard', label: '仪表盘' }, { key: 'revenue', label: '营收录入' }, { key: 'expense', label: '支出录入' }, { key: 'settings', label: '基础设置' }];

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar - desktop */}
      <aside className="hidden md:flex w-56 bg-white border-r flex-col">
        <div className="p-4 border-b"><h2 className="font-bold text-gray-800">食堂管理系统</h2><p className="text-xs text-gray-400 mt-1">{user.real_name || user.username} · {ROLE_LABEL[user.role_code]}</p></div>
        <nav className="flex-1 p-2 space-y-1">
          {visibleTabs.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)} className={`w-full text-left px-4 py-2 rounded-lg text-sm transition ${tab === t.key ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-100'}`}>{t.label}</button>
          ))}
        </nav>
        <div className="p-4 border-t"><button onClick={logout} className="w-full text-left px-4 py-2 rounded-lg text-sm text-red-600 hover:bg-red-50">退出登录</button></div>
      </aside>

      {/* Mobile header */}
      <div className="md:hidden fixed top-0 left-0 right-0 bg-white border-b z-30 px-4 py-3 flex items-center justify-between">
        <h2 className="font-bold text-gray-800">食堂管理</h2>
        <button onClick={() => setSidebarOpen(!sidebarOpen)} className="text-gray-600">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
        </button>
      </div>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && <div className="md:hidden fixed inset-0 bg-black/30 z-40" onClick={() => setSidebarOpen(false)} />}
      {sidebarOpen && (
        <div className="md:hidden fixed left-0 top-0 bottom-0 w-56 bg-white z-50 shadow-xl">
          <div className="p-4 border-b flex justify-between items-center"><h2 className="font-bold text-gray-800">食堂管理</h2><button onClick={() => setSidebarOpen(false)} className="text-gray-400">✕</button></div>
          <nav className="p-2 space-y-1">
            {visibleTabs.map(t => (<button key={t.key} onClick={() => { setTab(t.key); setSidebarOpen(false); }} className={`w-full text-left px-4 py-2 rounded-lg text-sm ${tab === t.key ? 'bg-blue-600 text-white' : 'text-gray-600'}`}>{t.label}</button>))}
            <button onClick={logout} className="w-full text-left px-4 py-2 rounded-lg text-sm text-red-600 hover:bg-red-50">退出登录</button>
          </nav>
        </div>
      )}

      {/* Main content */}
      <main className="flex-1 p-4 md:p-6 mt-14 md:mt-0 max-w-6xl mx-auto">
        {tab === 'dashboard' && <DashboardPage />}
        {tab === 'revenue' && <RevenuePage />}
        {tab === 'expense' && <ExpensePage />}
        {tab === 'settings' && <SettingsPage user={user} />}
      </main>
    </div>
  );
}
