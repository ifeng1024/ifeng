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
  const [users, setUsers] = useState<Record<string, unknown>[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ company_name: '', username: '', real_name: '', password: '', expires_at: '' });

  const load = useCallback(async () => {
    const res = await apiFetch<ApiResp>('/api/users?role_code=COMPANY_MANAGER');
    if (res.success && res.data) setUsers(res.data as Record<string, unknown>[]);
  }, []);
  useEffect(() => { load(); }, [load]);

  const submit = async () => {
    if (editingId) {
      const body: Record<string, unknown> = { company_name: form.company_name.trim() };
      if (form.real_name.trim()) body.real_name = form.real_name.trim();
      if (form.password) body.password = form.password;
      if (form.expires_at) body.expires_at = form.expires_at; else body.expires_at = null;
      const res = await apiFetch<ApiResp>(`/api/users/${editingId}`, { method: 'PUT', body: JSON.stringify(body) });
      if (res.success) { setShowForm(false); setEditingId(null); load(); } else alert(res.error);
    } else {
      if (!form.company_name.trim() || !form.username.trim() || !form.password) { alert('请填写公司名称、用户名和密码'); return; }
      const res = await apiFetch<ApiResp>('/api/users', { method: 'POST', body: JSON.stringify({ username: form.username.trim(), real_name: form.real_name.trim() || form.username.trim(), role_code: 'COMPANY_MANAGER', company_name: form.company_name.trim(), password: form.password, expires_at: form.expires_at || null }) });
      if (res.success) { setShowForm(false); setForm({ company_name: '', username: '', real_name: '', password: '', expires_at: '' }); load(); } else alert(res.error);
    }
  };

  const startEdit = (u: Record<string, unknown>) => {
    setEditingId(u.id as string);
    setForm({ company_name: (u.company_name as string) || '', username: u.username as string || '', real_name: u.real_name as string || '', password: '', expires_at: u.expires_at ? (u.expires_at as string).slice(0, 10) : '' });
    setShowForm(true);
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
          <button onClick={() => { setShowForm(!showForm); setEditingId(null); setForm({ company_name: '', username: '', real_name: '', password: '', expires_at: '' }); }} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm">{showForm && !editingId ? '取消' : '新建账号'}</button>
        </div>

        {showForm && (
          <div className="bg-blue-50 rounded-lg p-4 mb-4">
            <h4 className="font-medium text-gray-600 mb-3">{editingId ? '编辑账号' : '新增账号'}</h4>
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
              <div><label className="block text-xs font-medium text-gray-600 mb-1">公司名称 *</label><input value={form.company_name} onChange={e => setForm(f => ({ ...f, company_name: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="如：XX科技有限公司" /></div>
              <div><label className="block text-xs font-medium text-gray-600 mb-1">用户名 {!editingId && '*'}</label><input value={form.username} onChange={e => setForm(f => ({ ...f, username: e.target.value }))} disabled={!!editingId} className="w-full border rounded-lg px-3 py-2 text-sm disabled:bg-gray-100" /></div>
              <div><label className="block text-xs font-medium text-gray-600 mb-1">姓名</label><input value={form.real_name} onChange={e => setForm(f => ({ ...f, real_name: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm" /></div>
              <div><label className="block text-xs font-medium text-gray-600 mb-1">{editingId ? '新密码（留空不改）' : '密码 *'}</label><input type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm" /></div>
              <div><label className="block text-xs font-medium text-gray-600 mb-1">有效期</label><input type="date" value={form.expires_at} onChange={e => setForm(f => ({ ...f, expires_at: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="留空永久" /></div>
            </div>
            <div className="flex gap-2 mt-4">
              <button onClick={submit} className="bg-blue-600 text-white px-6 py-2 rounded-lg text-sm">{editingId ? '保存' : '创建'}</button>
              <button onClick={() => { setShowForm(false); setEditingId(null); }} className="bg-gray-200 text-gray-700 px-6 py-2 rounded-lg text-sm">取消</button>
            </div>
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
                    <button onClick={() => startEdit(u)} className="text-blue-600 hover:underline text-xs">编辑</button>
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

/* ─── KPI CARD ─── */
function KpiCard({ label, value, color, small }: { label: string; value: string; color: string; small?: boolean }) {
  const colorMap: Record<string, string> = { blue: 'bg-blue-50 text-blue-700', red: 'bg-red-50 text-red-700', green: 'bg-green-50 text-green-700', purple: 'bg-purple-50 text-purple-700' };
  return (
    <div className={`${colorMap[color] || 'bg-gray-50 text-gray-700'} rounded-xl ${small ? 'p-3' : 'p-5'}`}>
      <div className={`${small ? 'text-xs' : 'text-sm'} opacity-70`}>{label}</div>
      <div className={`${small ? 'text-lg' : 'text-2xl'} font-bold mt-1`}>{value}</div>
    </div>
  );
}

/* Simple SVG Bar Chart */
function SimpleBarChart({ data, xKey, yKey, horizontal }: { data: Record<string, unknown>[]; xKey: string; yKey: string; horizontal?: boolean }) {
  if (data.length === 0) return <p className="text-gray-400 text-sm">暂无数据</p>;
  const maxVal = Math.max(...data.map(d => num(d[yKey])), 1);
  const colors = ['#3b82f6', '#60a5fa', '#93c5fd', '#bfdbfe'];
  if (horizontal) {
    return (<div className="space-y-2">{data.map((d, i) => (<div key={i} className="flex items-center gap-2"><span className="text-xs text-gray-600 w-24 truncate">{d[xKey] as string}</span><div className="flex-1 bg-gray-100 rounded-full h-5 relative"><div className="h-5 rounded-full flex items-center px-2" style={{ width: `${Math.max(num(d[yKey]) / maxVal * 100, 2)}%`, backgroundColor: colors[i % colors.length] }}><span className="text-white text-xs">{fmt(d[yKey])}</span></div></div></div>))}</div>);
  }
  return (<div className="flex items-end gap-1 h-40">{data.map((d, i) => (<div key={i} className="flex-1 flex flex-col items-center"><span className="text-xs text-gray-500 mb-1">{fmt(d[yKey])}</span><div className="w-full rounded-t" style={{ height: `${Math.max(num(d[yKey]) / maxVal * 120, 2)}px`, backgroundColor: colors[i % colors.length], minHeight: '2px' }} /><span className="text-xs text-gray-400 mt-1 truncate w-full text-center">{(d[xKey] as string).slice(5)}</span></div>))}</div>);
}

function GroupedBarChart({ data, xKey, bars }: { data: Record<string, unknown>[]; xKey: string; bars: { key: string; label: string; color: string }[] }) {
  if (data.length === 0) return <p className="text-gray-400 text-sm">暂无数据</p>;
  const maxVal = Math.max(...data.flatMap(d => bars.map(b => num(d[b.key]))), 1);
  return (
    <div className="space-y-1">
      <div className="flex gap-3 mb-2">{bars.map(b => <span key={b.key} className="text-xs flex items-center gap-1"><span className="w-3 h-3 rounded" style={{ backgroundColor: b.color }} />{b.label}</span>)}</div>
      <div className="flex items-end gap-1 h-40">{data.map((d, i) => (<div key={i} className="flex-1 flex flex-col items-center"><div className="flex gap-0.5 w-full items-end" style={{ height: '120px' }}>{bars.map(b => (<div key={b.key} className="flex-1 rounded-t" style={{ height: `${Math.max(num(d[b.key]) / maxVal * 120, 1)}px`, backgroundColor: b.color, minHeight: '1px' }} />))}</div><span className="text-xs text-gray-400 mt-1 truncate w-full text-center">{(d[xKey] as string).slice(5)}</span></div>))}</div>
    </div>
  );
}

/* ─── DASHBOARD ─── */
function DashboardPage() {
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [range] = useState('7d');

  useEffect(() => {
    const today = new Date().toLocaleDateString('sv-SE');
    apiFetch<ApiResp>(`/api/dashboard?date=${today}&range=${range}`).then(res => {
      if (res.success && res.data) setData(res.data as Record<string, unknown>);
    }).finally(() => setLoading(false));
  }, [range]);

  if (loading) return <div className="text-center py-10 text-gray-400">加载中...</div>;
  if (!data) return <div className="text-center py-10 text-red-400">加载失败</div>;

  const kpi = (data.kpi || {}) as Record<string, unknown>;
  const perCanteenKpi = (data.per_canteen_kpi || []) as Record<string, unknown>[];
  const stallRanking = (data.stall_ranking || []) as Record<string, unknown>[];
  const revenueTrend = (data.revenue_trend || []) as Record<string, unknown>[];
  const expenseBreakdown = (data.expense_breakdown || []) as Record<string, unknown>[];
  const profitTrend = (data.profit_trend || []) as Record<string, unknown>[];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-gray-800">数据概览</h2>
      </div>

      {/* KPI Cards - Row 1: Today */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="今日营收" value={num(kpi.today_revenue).toFixed(2)} color="blue" />
        <KpiCard label="今日支出" value={num(kpi.today_expense).toFixed(2)} color="red" />
        <KpiCard label="今日毛利" value={(num(kpi.today_revenue) - num(kpi.today_expense)).toFixed(2)} color="green" />
        <KpiCard label="今日毛利率" value={`${num(kpi.today_revenue) > 0 ? ((num(kpi.today_revenue) - num(kpi.today_expense)) / num(kpi.today_revenue) * 100).toFixed(1) : '0.0'}%`} color="purple" />
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

      {/* Canteen Comparison (Company Manager) */}
      {perCanteenKpi.length > 0 && (
        <div className="bg-white rounded-xl shadow p-5">
          <h3 className="font-semibold text-gray-700 mb-4">食堂对比</h3>
          <table className="w-full text-sm">
            <thead><tr className="bg-gray-50"><th className="px-3 py-2 text-left">食堂</th><th className="px-3 py-2 text-right">当日营收</th><th className="px-3 py-2 text-right">当日支出</th><th className="px-3 py-2 text-right">当日毛利</th><th className="px-3 py-2 text-right">当月营收</th><th className="px-3 py-2 text-right">当月支出</th><th className="px-3 py-2 text-right">当月毛利</th></tr></thead>
            <tbody>
              {perCanteenKpi.map((c, i) => (
                <tr key={i} className="border-t hover:bg-gray-50">
                  <td className="px-3 py-2">{(c.canteen_name as string) || '未知'}</td>
                  <td className="px-3 py-2 text-right">{fmt(c.today_revenue)}</td>
                  <td className="px-3 py-2 text-right">{fmt(c.today_expense)}</td>
                  <td className="px-3 py-2 text-right">{fmt(c.today_gross_profit)}</td>
                  <td className="px-3 py-2 text-right">{fmt(c.month_revenue)}</td>
                  <td className="px-3 py-2 text-right">{fmt(c.month_expense)}</td>
                  <td className="px-3 py-2 text-right">{fmt(c.month_gross_profit)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow p-5">
          <h3 className="font-semibold text-gray-700 mb-4">营收趋势</h3>
          <SimpleBarChart data={revenueTrend} xKey="date" yKey="amount" />
        </div>
        <div className="bg-white rounded-xl shadow p-5">
          <h3 className="font-semibold text-gray-700 mb-4">收支对比</h3>
          <GroupedBarChart data={profitTrend} xKey="date" bars={[{ key: 'revenue', label: '营收', color: '#3b82f6' }, { key: 'expense', label: '支出', color: '#ef4444' }]} />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow p-5">
          <h3 className="font-semibold text-gray-700 mb-4">档口营收排行</h3>
          <SimpleBarChart data={stallRanking} xKey="name" yKey="amount" horizontal />
        </div>
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

/* ─── REVENUE ENTRY ─── */
function RevenuePage({ user }: { user: AuthUser }) {
  const isStallMgr = user.role_code === 'STALL_MANAGER';
  const [canteens, setCanteens] = useState<Record<string, unknown>[]>([]);
  const [stalls, setStalls] = useState<Record<string, unknown>[]>([]);
  const [mealTypes, setMealTypes] = useState<Record<string, unknown>[]>([]);
  const [records, setRecords] = useState<Record<string, unknown>[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ canteen_id: '', stall_id: '', meal_type_id: '', record_date: new Date().toLocaleDateString('sv-SE'), order_count: '', amount: '', note: '' });

  useEffect(() => {
    apiFetch<ApiResp>('/api/dropdown/canteens').then(res => {
      if (res.success && res.data) {
        const c = res.data as Record<string, unknown>[];
        setCanteens(c);
        if (c.length === 1) setForm(f => ({ ...f, canteen_id: c[0].id as string }));
      }
    });
  }, []);

  useEffect(() => {
    if (!form.canteen_id) { setStalls([]); setMealTypes([]); return; }
    Promise.all([apiFetch<ApiResp>(`/api/dropdown/stalls?canteen_id=${form.canteen_id}`), apiFetch<ApiResp>(`/api/meal-types?canteen_id=${form.canteen_id}`)]).then(([sRes, mRes]) => {
      if (sRes.success && sRes.data) {
        const s = sRes.data as Record<string, unknown>[];
        setStalls(s);
        if (isStallMgr && s.length === 1) setForm(f => ({ ...f, stall_id: s[0].id as string }));
      }
      if (mRes.success && mRes.data) setMealTypes(mRes.data as Record<string, unknown>[]);
    });
  }, [form.canteen_id, isStallMgr]);

  const loadRecords = useCallback(async () => {
    const res = await apiFetch<ApiResp>(`/api/revenue-records?page=${page}&page_size=10`);
    if (res.success && res.data) { const d = res.data as Record<string, unknown>; setRecords((d.records || []) as Record<string, unknown>[]); setTotal(num(d.total)); }
  }, [page]);
  useEffect(() => { loadRecords(); }, [loadRecords]);

  const submit = async () => {
    if (!form.canteen_id || !form.stall_id || !form.meal_type_id || !form.amount || !form.record_date) { alert('请填写必填项'); return; }
    if (editingId) {
      const res = await apiFetch<ApiResp>(`/api/revenue-records/${editingId}`, { method: 'PUT', body: JSON.stringify({ ...form, order_count: num(form.order_count), amount: num(form.amount) }) });
      if (res.success) { setShowForm(false); setEditingId(null); setForm(f => ({ ...f, order_count: '', amount: '', note: '' })); loadRecords(); } else alert(res.error);
    } else {
      const res = await apiFetch<ApiResp>('/api/revenue-records', { method: 'POST', body: JSON.stringify({ ...form, order_count: num(form.order_count), amount: num(form.amount) }) });
      if (res.success) { setForm(f => ({ ...f, order_count: '', amount: '', note: '' })); loadRecords(); } else alert(res.error);
    }
  };

  const deleteRecord = async (id: string) => {
    if (!confirm('确认删除？')) return;
    const res = await apiFetch<ApiResp>(`/api/revenue-records/${id}`, { method: 'DELETE' });
    if (res.success) loadRecords(); else alert(res.error);
  };

  const startEdit = (r: Record<string, unknown>) => {
    setEditingId(r.id as string);
    setForm({
      canteen_id: r.canteen_id as string || '', stall_id: r.stall_id as string || '', meal_type_id: r.meal_type_id as string || '',
      record_date: r.record_date as string || new Date().toLocaleDateString('sv-SE'),
      order_count: String(r.order_count || ''), amount: String(r.amount || ''), note: r.note as string || ''
    });
    setShowForm(true);
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl shadow p-5">
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-semibold text-gray-700">营收录入</h3>
          <button onClick={() => { setShowForm(!showForm); setEditingId(null); }} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm">{showForm && !editingId ? '取消' : '录入'}</button>
        </div>
        {showForm && (
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
            <div><label className="block text-xs font-medium text-gray-600 mb-1">食堂 *</label><select value={form.canteen_id} onChange={e => setForm(f => ({ ...f, canteen_id: e.target.value, stall_id: '', meal_type_id: '' }))} disabled={isStallMgr && canteens.length === 1} className="w-full border rounded-lg px-3 py-2 text-sm"><option value="">选择食堂</option>{canteens.map(c => <option key={c.id as string} value={c.id as string}>{c.name as string}</option>)}</select></div>
            <div><label className="block text-xs font-medium text-gray-600 mb-1">档口 *</label><select value={form.stall_id} onChange={e => setForm(f => ({ ...f, stall_id: e.target.value }))} disabled={isStallMgr && stalls.length === 1} className="w-full border rounded-lg px-3 py-2 text-sm"><option value="">选择档口</option>{stalls.map(s => <option key={s.id as string} value={s.id as string}>{s.name as string}</option>)}</select></div>
            <div><label className="block text-xs font-medium text-gray-600 mb-1">餐别 *</label><select value={form.meal_type_id} onChange={e => setForm(f => ({ ...f, meal_type_id: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm"><option value="">选择餐别</option>{mealTypes.map(m => <option key={m.id as string} value={m.id as string}>{m.name as string}</option>)}</select></div>
            <div><label className="block text-xs font-medium text-gray-600 mb-1">日期 *</label><input type="date" value={form.record_date} onChange={e => setForm(f => ({ ...f, record_date: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm" /></div>
            <div><label className="block text-xs font-medium text-gray-600 mb-1">订单数</label><input type="number" value={form.order_count} onChange={e => setForm(f => ({ ...f, order_count: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm" /></div>
            <div><label className="block text-xs font-medium text-gray-600 mb-1">金额 *</label><input type="number" step="0.01" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm" /></div>
            <div className="col-span-2 lg:col-span-3"><label className="block text-xs font-medium text-gray-600 mb-1">备注</label><input value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm" /></div>
            <div className="col-span-2 lg:col-span-3 flex gap-2"><button onClick={submit} className="bg-blue-600 text-white px-6 py-2 rounded-lg text-sm">{editingId ? '保存' : '录入'}</button><button onClick={() => { setShowForm(false); setEditingId(null); }} className="bg-gray-200 text-gray-700 px-6 py-2 rounded-lg text-sm">取消</button></div>
          </div>
        )}
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
                <td className="px-3 py-2 text-center space-x-1">
                  <button onClick={() => startEdit(r)} className="text-blue-600 hover:underline text-xs">编辑</button>
                  <button onClick={() => deleteRecord(r.id as string)} className="text-red-600 hover:underline text-xs">删除</button>
                </td>
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
  const [stalls, setStalls] = useState<Record<string, unknown>[]>([]);
  const [suppliers, setSuppliers] = useState<Record<string, unknown>[]>([]);
  const [records, setRecords] = useState<Record<string, unknown>[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [categories, setCategories] = useState<Record<string, unknown>[]>([]);
  const [products, setProducts] = useState<Record<string, unknown>[]>([]);
  const [specs, setSpecs] = useState<Record<string, unknown>[]>([]);
  const [form, setForm] = useState({ canteen_id: '', stall_id: '', expense_date: new Date().toLocaleDateString('sv-SE'), category: '食材采购', amount: '', note: '', is_daily_repeat: false, product_category_id: '', product_id: '', product_spec_id: '', quantity: '', unit_price: '', supplier_id: '' });

  useEffect(() => { apiFetch<ApiResp>('/api/dropdown/canteens').then(res => { if (res.success && res.data) setCanteens(res.data as Record<string, unknown>[]); }); }, []);
  useEffect(() => { apiFetch<ApiResp>('/api/suppliers').then(res => { if (res.success && res.data) setSuppliers(res.data as Record<string, unknown>[]); }); }, []);
  // Load stalls based on selected canteen
  useEffect(() => {
    if (!form.canteen_id) { setStalls([]); return; }
    apiFetch<ApiResp>(`/api/dropdown/stalls?canteen_id=${form.canteen_id}`).then(res => { if (res.success && res.data) setStalls(res.data as Record<string, unknown>[]); });
  }, [form.canteen_id]);
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
    const body: Record<string, unknown> = { canteen_id: form.canteen_id, stall_id: form.stall_id || null, expense_date: form.expense_date, category: form.category, amount: num(form.amount), note: form.note, is_daily_repeat: form.is_daily_repeat };
    if (isMaterial) {
      body.product_category_id = form.product_category_id || null; body.product_id = form.product_id || null; body.product_spec_id = form.product_spec_id || null; body.quantity = form.quantity ? num(form.quantity) : null; body.unit_price = form.unit_price ? num(form.unit_price) : null;
      body.supplier_id = form.supplier_id || null;
    }
    const res = await apiFetch<ApiResp>('/api/expense-records', { method: 'POST', body: JSON.stringify(body) });
    if (res.success) { setForm(f => ({ ...f, amount: '', note: '', product_category_id: '', product_id: '', product_spec_id: '', quantity: '', unit_price: '', is_daily_repeat: false, supplier_id: '' })); loadRecords(); } else alert(res.error);
  };

  const deleteRecord = async (id: string) => {
    if (!confirm('确认删除？')) return;
    const res = await apiFetch<ApiResp>(`/api/expense-records/${id}`, { method: 'DELETE' });
    if (res.success) loadRecords(); else alert(res.error);
  };

  const exportData = async () => {
    const res = await apiFetch<ApiResp>('/api/expense-records?page=1&page_size=10000');
    if (!res.success || !res.data) { alert('导出失败'); return; }
    const d = res.data as Record<string, unknown>;
    const recs = (d.records || []) as Record<string, unknown>[];
    const header = '日期,食堂,档口,类别,商品,供应商,金额,备注';
    const rows = recs.map(r => `${r.expense_date},${r.canteen_name || ''},${r.stall_name || ''},${r.category},${[r.product_category_name, r.product_name, r.product_spec_name].filter(Boolean).join('/') || ''},${(r as Record<string, unknown>).supplier_name || ''},${r.amount},${(r.note as string || '').replace(/,/g, '，')}`);
    const csv = '\uFEFF' + header + '\n' + rows.join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `支出记录_${new Date().toLocaleDateString('sv-SE')}.csv`; a.click(); window.URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl shadow p-5">
        <h3 className="font-semibold text-gray-700 mb-4">支出录入</h3>
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          <div><label className="block text-xs font-medium text-gray-600 mb-1">食堂 *</label><select value={form.canteen_id} onChange={e => setForm(f => ({ ...f, canteen_id: e.target.value, stall_id: '' }))} className="w-full border rounded-lg px-3 py-2 text-sm"><option value="">选择食堂</option>{canteens.map(c => <option key={c.id as string} value={c.id as string}>{c.name as string}</option>)}</select></div>
          <div><label className="block text-xs font-medium text-gray-600 mb-1">档口（非必填）</label><select value={form.stall_id} onChange={e => setForm(f => ({ ...f, stall_id: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm"><option value="">选择档口</option>{stalls.map(s => <option key={s.id as string} value={s.id as string}>{s.name as string}</option>)}</select></div>
          <div><label className="block text-xs font-medium text-gray-600 mb-1">日期 *</label><input type="date" value={form.expense_date} onChange={e => setForm(f => ({ ...f, expense_date: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm" /></div>
          <div><label className="block text-xs font-medium text-gray-600 mb-1">支出类别</label><select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value, product_category_id: '', product_id: '', product_spec_id: '', supplier_id: '' }))} className="w-full border rounded-lg px-3 py-2 text-sm"><option>食材采购</option><option>人工成本</option><option>水电费</option><option>房租</option><option>设备维护</option><option>其他</option></select></div>
          <div><label className="block text-xs font-medium text-gray-600 mb-1">金额 *</label><input type="number" step="0.01" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm" /></div>
          <div className="flex items-end pb-1"><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.is_daily_repeat} onChange={e => setForm(f => ({ ...f, is_daily_repeat: e.target.checked }))} className="w-4 h-4" />当月每天重复</label></div>
          <div className="col-span-2 lg:col-span-3"><label className="block text-xs font-medium text-gray-600 mb-1">备注</label><input value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm" /></div>
          {isMaterial && <>
            <div><label className="block text-xs font-medium text-gray-600 mb-1">供应商</label><select value={form.supplier_id} onChange={e => setForm(f => ({ ...f, supplier_id: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm"><option value="">选择供应商</option>{suppliers.map(s => <option key={s.id as string} value={s.id as string}>{s.name as string}</option>)}</select></div>
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
        <div className="flex justify-end px-4 py-2 border-b">
          <button onClick={exportData} className="text-sm text-blue-600 hover:underline">导出 CSV</button>
        </div>
        <table className="w-full text-sm">
          <thead><tr className="bg-gray-50"><th className="px-3 py-2 text-left">日期</th><th className="px-3 py-2 text-left">食堂</th><th className="px-3 py-2 text-left">档口</th><th className="px-3 py-2 text-left">类别</th><th className="px-3 py-2 text-left">商品</th><th className="px-3 py-2 text-right">金额</th><th className="px-3 py-2 text-left">重复</th><th className="px-3 py-2 text-center">操作</th></tr></thead>
          <tbody>
            {records.map(r => (
              <tr key={r.id as string} className="border-t hover:bg-gray-50">
                <td className="px-3 py-2">{r.expense_date as string}</td>
                <td className="px-3 py-2">{r.canteen_name as string || '-'}</td>
                <td className="px-3 py-2">{r.stall_name as string || '-'}</td>
                <td className="px-3 py-2">{r.category as string}</td>
                <td className="px-3 py-2 text-gray-500">{[r.product_category_name, r.product_name, r.product_spec_name].filter(Boolean).join(' / ') || '-'}</td>
                <td className="px-3 py-2 text-right">{fmt(r.amount)}</td>
                <td className="px-3 py-2">{r.is_daily_repeat ? <span className="text-xs text-blue-500">每日</span> : ''}</td>
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
type SettingsTab = 'my_account' | 'canteens' | 'stalls' | 'meal_types' | 'accounts' | 'products' | 'suppliers' | 'logs';

function SettingsPage({ user }: { user: AuthUser }) {
  const isStallManager = user.role_code === 'STALL_MANAGER';
  const isCompanyManager = user.role_code === 'COMPANY_MANAGER';
  const isCanteenManager = user.role_code === 'CANTEEN_MANAGER';

  const [tab, setTab] = useState<SettingsTab>('my_account');

  if (isStallManager) return <MyAccountSection user={user} />;

  let tabs: { key: SettingsTab; label: string }[] = [{ key: 'my_account', label: '我的账号' }];
  if (isCompanyManager) {
    tabs = tabs.concat([
      { key: 'canteens', label: '食堂管理' }, { key: 'stalls', label: '档口管理' },
      { key: 'meal_types', label: '餐别管理' }, { key: 'accounts', label: '账号管理' }, { key: 'products', label: '商品管理' }, { key: 'suppliers', label: '供应商管理' }, { key: 'logs', label: '操作日志' },
    ]);
  } else if (isCanteenManager) {
    tabs = tabs.concat([
      { key: 'stalls', label: '档口管理' },
      { key: 'meal_types', label: '餐别管理' }, { key: 'accounts', label: '账号管理' }, { key: 'products', label: '商品管理' }, { key: 'suppliers', label: '供应商管理' }, { key: 'logs', label: '操作日志' },
    ]);
  } else {
    tabs = tabs.concat([
      { key: 'canteens', label: '食堂管理' }, { key: 'stalls', label: '档口管理' },
      { key: 'meal_types', label: '餐别管理' }, { key: 'accounts', label: '账号管理' }, { key: 'products', label: '商品管理' }, { key: 'suppliers', label: '供应商管理' }, { key: 'logs', label: '操作日志' },
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
      {tab === 'meal_types' && <MealTypeManager />}
      {tab === 'accounts' && <AccountManager user={user} />}
      {tab === 'products' && <ProductManager />}
      {tab === 'suppliers' && <SupplierManager />}
      {tab === 'logs' && <OperationLogViewer />}
    </div>
  );
}

/* ─── MY ACCOUNT ─── */
function MyAccountSection({ user }: { user: AuthUser }) {
  const [oldPw, setOldPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [msg, setMsg] = useState('');
  const [errMsg, setErrMsg] = useState('');

  const changePassword = async () => {
    if (!oldPw || !newPw) { setErrMsg('请填写旧密码和新密码'); return; }
    const res = await apiFetch<ApiResp>('/api/settings/users/self/password', { method: 'PUT', body: JSON.stringify({ old_password: oldPw, new_password: newPw }) });
    if (res.success) { setMsg('密码修改成功'); setOldPw(''); setNewPw(''); setErrMsg(''); } else { setErrMsg(res.error || '修改失败'); setMsg(''); }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl shadow p-5">
        <h3 className="font-semibold text-gray-700 mb-4">我的账号 — {user.real_name || user.username}</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div><span className="text-gray-500">账号名称：</span><span className="font-medium">{user.real_name || user.username}</span></div>
          <div><span className="text-gray-500">角色：</span><span className="font-medium">{ROLE_LABEL[user.role_code] || user.role_code}</span></div>
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
  const [form, setForm] = useState({ name: '', address: '', contact_name: '', contact_phone: '', manager_id: '', company_id: '', note: '' });

  const load = useCallback(async () => {
    const [cRes, uRes] = await Promise.all([apiFetch<ApiResp>('/api/companies'), apiFetch<ApiResp>('/api/users?role_code=CANTEEN_MANAGER')]);
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
    setForm({ name: c.name as string || '', address: c.address as string || '', contact_name: c.contact_name as string || '', contact_phone: c.contact_phone as string || '', manager_id: c.manager_id as string || '', company_id: c.company_id as string || '', note: c.note as string || '' });
    setShowForm(true);
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center"><h3 className="font-semibold text-gray-700">食堂管理</h3><button onClick={() => { setShowForm(!showForm); setEditingId(null); setForm({ name: '', address: '', contact_name: '', contact_phone: '', manager_id: '', company_id: companies[0]?.id as string || '', note: '' }); }} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm">{showForm && !editingId ? '取消' : '新增食堂'}</button></div>
      {showForm && (
        <div className="bg-white rounded-xl shadow p-5">
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
            <div><label className="block text-xs font-medium text-gray-600 mb-1">食堂名称 *</label><input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm" /></div>
            <div><label className="block text-xs font-medium text-gray-600 mb-1">地址</label><input value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm" /></div>
            <div><label className="block text-xs font-medium text-gray-600 mb-1">联系人</label><input value={form.contact_name} onChange={e => setForm(f => ({ ...f, contact_name: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm" /></div>
            <div><label className="block text-xs font-medium text-gray-600 mb-1">联系电话</label><input value={form.contact_phone} onChange={e => setForm(f => ({ ...f, contact_phone: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm" /></div>
            <div><label className="block text-xs font-medium text-gray-600 mb-1">食堂负责人</label><select value={form.manager_id} onChange={e => setForm(f => ({ ...f, manager_id: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm"><option value="">选择负责人</option>{users.map(u => <option key={u.id as string} value={u.id as string}>{u.real_name as string || u.username as string}</option>)}</select></div>
            {!editingId && <div><label className="block text-xs font-medium text-gray-600 mb-1">所属公司 *</label><select value={form.company_id} onChange={e => setForm(f => ({ ...f, company_id: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm"><option value="">选择公司</option>{companies.map(c => <option key={c.id as string} value={c.id as string}>{c.name as string}</option>)}</select></div>}
            <div><label className="block text-xs font-medium text-gray-600 mb-1">备注</label><input value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm" /></div>
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
  const [form, setForm] = useState({ name: '', manager_id: '', note: '' });

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

  const canteenName = (id: string) => canteens.find(c => c.id === id)?.name as string || '-';

  const submit = async () => {
    if (!form.name.trim() || !selectedCanteen) { alert('请填写档口名称并选择食堂'); return; }
    if (editingId) {
      const res = await apiFetch<ApiResp>(`/api/stalls/${editingId}`, { method: 'PUT', body: JSON.stringify({ name: form.name, manager_id: form.manager_id || null, note: form.note }) });
      if (res.success) { setShowForm(false); setEditingId(null); setForm({ name: '', manager_id: '', note: '' }); loadStalls(); } else alert(res.error);
    } else {
      const res = await apiFetch<ApiResp>(`/api/canteens/${selectedCanteen}/stalls`, { method: 'POST', body: JSON.stringify({ name: form.name, manager_id: form.manager_id || null, note: form.note }) });
      if (res.success) { setShowForm(false); setForm({ name: '', manager_id: '', note: '' }); loadStalls(); } else alert(res.error);
    }
  };

  const startEdit = (s: Record<string, unknown>) => {
    setEditingId(s.id as string);
    setForm({ name: s.name as string || '', manager_id: s.manager_id as string || '', note: s.note as string || '' });
    setShowForm(true);
  };

  const managerName = (id: string) => stallManagers.find(u => u.id === id)?.real_name as string || stallManagers.find(u => u.id === id)?.username as string || '-';

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center"><h3 className="font-semibold text-gray-700">档口管理</h3><button onClick={() => { setShowForm(!showForm); setEditingId(null); setForm({ name: '', manager_id: '', note: '' }); }} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm">{showForm && !editingId ? '取消' : '新增档口'}</button></div>
      <div className="flex items-center gap-3"><label className="text-sm text-gray-600">选择食堂：</label><select value={selectedCanteen} onChange={e => setSelectedCanteen(e.target.value)} className="border rounded-lg px-3 py-2 text-sm"><option value="">请选择</option>{canteens.map(c => <option key={c.id as string} value={c.id as string}>{c.name as string}</option>)}</select></div>
      {showForm && (
        <div className="bg-white rounded-xl shadow p-5">
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
            <div><label className="block text-xs font-medium text-gray-600 mb-1">档口名称 *</label><input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm" /></div>
            <div><label className="block text-xs font-medium text-gray-600 mb-1">档口负责人</label><select value={form.manager_id} onChange={e => setForm(f => ({ ...f, manager_id: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm"><option value="">选择负责人</option>{stallManagers.map(u => <option key={u.id as string} value={u.id as string}>{u.real_name as string || u.username as string}</option>)}</select></div>
            <div><label className="block text-xs font-medium text-gray-600 mb-1">备注</label><input value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm" /></div>
          </div>
          <div className="flex gap-2 mt-4"><button onClick={submit} className="bg-blue-600 text-white px-6 py-2 rounded-lg text-sm">{editingId ? '保存' : '创建'}</button><button onClick={() => { setShowForm(false); setEditingId(null); }} className="bg-gray-200 text-gray-700 px-6 py-2 rounded-lg text-sm">取消</button></div>
        </div>
      )}
      <div className="bg-white rounded-xl shadow overflow-hidden">
        <table className="w-full text-sm">
          <thead><tr className="bg-gray-50"><th className="px-3 py-2 text-left">档口名称</th><th className="px-3 py-2 text-left">所属食堂</th><th className="px-3 py-2 text-left">负责人</th><th className="px-3 py-2 text-left">备注</th><th className="px-3 py-2 text-center">操作</th></tr></thead>
          <tbody>
            {stalls.map(s => (
              <tr key={s.id as string} className="border-t hover:bg-gray-50">
                <td className="px-3 py-2">{s.name as string}</td>
                <td className="px-3 py-2">{canteenName(s.canteen_id as string)}</td>
                <td className="px-3 py-2">{managerName(s.manager_id as string)}</td>
                <td className="px-3 py-2 text-gray-500">{s.note as string || '-'}</td>
                <td className="px-3 py-2 text-center"><button onClick={() => startEdit(s)} className="text-blue-600 hover:underline text-xs">编辑</button></td>
              </tr>
            ))}
            {stalls.length === 0 && <tr><td colSpan={5} className="px-3 py-4 text-center text-gray-400">请先选择食堂</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ─── MEAL TYPE MANAGER ─── */
function MealTypeManager() {
  const [canteens, setCanteens] = useState<Record<string, unknown>[]>([]);
  const [, setMealTypes] = useState<Record<string, unknown>[]>([]);
  const [selectedCanteen, setSelectedCanteen] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [newName, setNewName] = useState('');

  useEffect(() => { apiFetch<ApiResp>('/api/dropdown/canteens').then(res => { if (res.success && res.data) setCanteens(res.data as Record<string, unknown>[]); }); }, []);
  useEffect(() => { if (!selectedCanteen) { setMealTypes([]); return; } apiFetch<ApiResp>(`/api/meal-types?canteen_id=${selectedCanteen}`).then(res => { if (res.success && res.data) setMealTypes(res.data as Record<string, unknown>[]); }); }, [selectedCanteen]);

  const add = async () => { if (!newName.trim() || !selectedCanteen) return; const res = await apiFetch<ApiResp>('/api/meal-types', { method: 'POST', body: JSON.stringify({ name: newName.trim(), canteen_id: selectedCanteen }) }); if (res.success) { setNewName(''); setShowForm(false); apiFetch<ApiResp>(`/api/meal-types?canteen_id=${selectedCanteen}`).then(res => { if (res.success && res.data) setMealTypes(res.data as Record<string, unknown>[]); }); } else alert(res.error); };
  const del = async (id: string) => { if (!confirm('确认删除？')) return; const res = await apiFetch<ApiResp>(`/api/meal-types/${id}`, { method: 'DELETE' }); if (res.success) apiFetch<ApiResp>(`/api/meal-types?canteen_id=${selectedCanteen}`).then(res => { if (res.success && res.data) setMealTypes(res.data as Record<string, unknown>[]); }); };

  // All meal types across all canteens for list view
  const [allMealTypes, setAllMealTypes] = useState<Record<string, unknown>[]>([]);
  const loadAll = useCallback(async () => {
    const cRes = await apiFetch<ApiResp>('/api/dropdown/canteens');
    if (cRes.success && cRes.data) {
      const cs = cRes.data as Record<string, unknown>[];
      const all: Record<string, unknown>[] = [];
      for (const c of cs) {
        const mRes = await apiFetch<ApiResp>(`/api/meal-types?canteen_id=${c.id}`);
        if (mRes.success && mRes.data) all.push(...(mRes.data as Record<string, unknown>[]).map(m => ({ ...m, canteen_name: c.name })));
      }
      setAllMealTypes(all);
    }
  }, []);
  useEffect(() => { loadAll(); }, [loadAll]);

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center"><h3 className="font-semibold text-gray-700">餐别管理</h3><button onClick={() => setShowForm(!showForm)} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm">{showForm ? '取消' : '新增餐别'}</button></div>
      {showForm && (
        <div className="bg-white rounded-xl shadow p-5">
          <div className="flex gap-3 items-end flex-wrap">
            <div><label className="block text-xs font-medium text-gray-600 mb-1">食堂 *</label><select value={selectedCanteen} onChange={e => setSelectedCanteen(e.target.value)} className="border rounded-lg px-3 py-2 text-sm"><option value="">请选择</option>{canteens.map(c => <option key={c.id as string} value={c.id as string}>{c.name as string}</option>)}</select></div>
            <div className="flex-1 min-w-[200px]"><label className="block text-xs font-medium text-gray-600 mb-1">餐别名称</label><input value={newName} onChange={e => setNewName(e.target.value)} placeholder="如：早餐" className="w-full border rounded-lg px-3 py-2 text-sm" /></div>
            <button onClick={add} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm">添加</button>
          </div>
        </div>
      )}
      <div className="bg-white rounded-xl shadow overflow-hidden">
        <table className="w-full text-sm">
          <thead><tr className="bg-gray-50"><th className="px-3 py-2 text-left">所属食堂</th><th className="px-3 py-2 text-left">餐别</th><th className="px-3 py-2 text-center">操作</th></tr></thead>
          <tbody>
            {allMealTypes.map(m => (
              <tr key={m.id as string} className="border-t hover:bg-gray-50">
                <td className="px-3 py-2">{m.canteen_name as string || '-'}</td>
                <td className="px-3 py-2">{m.name as string}</td>
                <td className="px-3 py-2 text-center"><button onClick={() => del(m.id as string)} className="text-red-600 hover:underline text-xs">删除</button></td>
              </tr>
            ))}
            {allMealTypes.length === 0 && <tr><td colSpan={3} className="px-3 py-4 text-center text-gray-400">暂无数据</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
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

  const roleOptions = isCompanyManager
    ? [{ value: 'CANTEEN_MANAGER', label: '食堂负责人' }, { value: 'STALL_MANAGER', label: '档口负责人' }]
    : isCanteenManager
      ? [{ value: 'STALL_MANAGER', label: '档口负责人' }]
      : [{ value: 'CANTEEN_MANAGER', label: '食堂负责人' }, { value: 'STALL_MANAGER', label: '档口负责人' }];

  const defaultRole = roleOptions[0].value;
  const [form, setForm] = useState({ username: '', real_name: '', role_code: defaultRole, org_id: '', password: '' });

  const load = useCallback(async () => {
    const [uRes, cRes] = await Promise.all([apiFetch<ApiResp>('/api/users'), apiFetch<ApiResp>('/api/dropdown/canteens')]);
    if (uRes.success && uRes.data) setUsers(uRes.data as Record<string, unknown>[]);
    if (cRes.success && cRes.data) setCanteens(cRes.data as Record<string, unknown>[]);
  }, []);

  useEffect(() => { load(); apiFetch<ApiResp>('/api/dropdown/stalls').then(res => { if (res.success && res.data) setStalls(res.data as Record<string, unknown>[]); }); }, [load]);

  // Reload stalls when canteen changes for org_id dropdown
  const orgOptions = form.role_code === 'CANTEEN_MANAGER' ? canteens : form.role_code === 'STALL_MANAGER' ? stalls : [];

  const submit = async () => {
    if (!form.real_name.trim()) { alert('请填写姓名'); return; }
    if (editingId) {
      const body: Record<string, unknown> = { real_name: form.real_name.trim(), role_code: form.role_code, org_id: form.org_id || null };
      if (form.password) body.password = form.password;
      const res = await apiFetch<ApiResp>(`/api/users/${editingId}`, { method: 'PUT', body: JSON.stringify(body) });
      if (res.success) { setShowForm(false); setEditingId(null); setForm({ username: '', real_name: '', role_code: defaultRole, org_id: '', password: '' }); load(); } else alert(res.error);
    } else {
      if (!form.username.trim() || !form.password) { alert('新建账号需填写用户名和密码'); return; }
      const body = { username: form.username.trim(), real_name: form.real_name.trim(), role_code: form.role_code, org_id: form.org_id || null, password: form.password };
      const res = await apiFetch<ApiResp>('/api/users', { method: 'POST', body: JSON.stringify(body) });
      if (res.success) { setShowForm(false); setForm({ username: '', real_name: '', role_code: defaultRole, org_id: '', password: '' }); load(); } else alert(res.error);
    }
  };

  const startEdit = (u: Record<string, unknown>) => {
    setEditingId(u.id as string);
    setForm({ username: u.username as string || '', real_name: u.real_name as string || '', role_code: u.role_code as string || defaultRole, org_id: u.org_id as string || '', password: '' });
    setShowForm(true);
  };

  const toggleDisable = async (u: Record<string, unknown>) => { const action = u.is_disabled ? '启用' : '禁用'; if (!confirm(`确认${action}此账号？`)) return; const res = await apiFetch<ApiResp>(`/api/settings/users/${u.id}/disable`, { method: 'PUT', body: JSON.stringify({ is_disabled: !u.is_disabled }) }); if (res.success) load(); else alert(res.error); };
  const resetPw = async (u: Record<string, unknown>) => { if (!confirm('确认重置密码为默认密码？')) return; const res = await apiFetch<ApiResp>(`/api/settings/users/${u.id}/reset-password`, { method: 'PUT' }); if (res.success) alert('密码已重置'); else alert(res.error); };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center"><h3 className="font-semibold text-gray-700">账号管理</h3><button onClick={() => { setShowForm(!showForm); setEditingId(null); setForm({ username: '', real_name: '', role_code: defaultRole, org_id: '', password: '' }); }} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm">{showForm && !editingId ? '取消' : '新增账号'}</button></div>
      {showForm && (
        <div className="bg-white rounded-xl shadow p-5">
          <h4 className="font-medium text-gray-600 mb-3">{editingId ? '编辑账号' : '新增账号'}</h4>
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
            <div><label className="block text-xs font-medium text-gray-600 mb-1">用户名 {!editingId && '*'}</label><input value={form.username} onChange={e => setForm(f => ({ ...f, username: e.target.value }))} disabled={!!editingId} className="w-full border rounded-lg px-3 py-2 text-sm disabled:bg-gray-100" /></div>
            <div><label className="block text-xs font-medium text-gray-600 mb-1">姓名 *</label><input value={form.real_name} onChange={e => setForm(f => ({ ...f, real_name: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm" /></div>
            <div><label className="block text-xs font-medium text-gray-600 mb-1">角色</label><select value={form.role_code} onChange={e => setForm(f => ({ ...f, role_code: e.target.value, org_id: '' }))} className="w-full border rounded-lg px-3 py-2 text-sm">{roleOptions.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}</select></div>
            <div><label className="block text-xs font-medium text-gray-600 mb-1">{form.role_code === 'CANTEEN_MANAGER' ? '所属食堂' : '所属档口'}</label><select value={form.org_id} onChange={e => setForm(f => ({ ...f, org_id: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm"><option value="">选择{form.role_code === 'CANTEEN_MANAGER' ? '食堂' : '档口'}</option>{orgOptions.map(o => <option key={o.id as string} value={o.id as string}>{o.name as string}</option>)}</select></div>
            <div><label className="block text-xs font-medium text-gray-600 mb-1">{editingId ? '新密码（留空不改）' : '密码 *'}</label><input type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm" /></div>
          </div>
          <div className="flex gap-2 mt-4"><button onClick={submit} className="bg-blue-600 text-white px-6 py-2 rounded-lg text-sm">{editingId ? '保存' : '创建'}</button><button onClick={() => { setShowForm(false); setEditingId(null); }} className="bg-gray-200 text-gray-700 px-6 py-2 rounded-lg text-sm">取消</button></div>
        </div>
      )}
      <div className="bg-white rounded-xl shadow overflow-hidden">
        <table className="w-full text-sm">
          <thead><tr className="bg-gray-50"><th className="px-3 py-2 text-left">用户名</th><th className="px-3 py-2 text-left">姓名</th><th className="px-3 py-2 text-left">角色</th><th className="px-3 py-2 text-left">状态</th><th className="px-3 py-2 text-center">操作</th></tr></thead>
          <tbody>{users.map(u => (<tr key={u.id as string} className="border-t hover:bg-gray-50"><td className="px-3 py-2">{u.username as string}</td><td className="px-3 py-2">{u.real_name as string || ''}</td><td className="px-3 py-2">{ROLE_LABEL[u.role_code as string] || '-'}</td><td className="px-3 py-2">{u.is_disabled ? <span className="text-red-500">已禁用</span> : <span className="text-green-600">正常</span>}</td><td className="px-3 py-2 text-center space-x-1"><button onClick={() => startEdit(u)} className="text-blue-600 hover:underline text-xs">编辑</button><button onClick={() => toggleDisable(u)} className="text-orange-600 hover:underline text-xs">{u.is_disabled ? '启用' : '禁用'}</button><button onClick={() => resetPw(u)} className="text-gray-600 hover:underline text-xs">重置密码</button></td></tr>))}</tbody>
        </table>
      </div>
    </div>
  );
}

/* ─── PRODUCT MANAGER ─── (List view with Name/Category/Spec/Note) */
function ProductManager() {
  const [categories, setCategories] = useState<Record<string, unknown>[]>([]);
  const [products, setProducts] = useState<Record<string, unknown>[]>([]);
  const [specs, setSpecs] = useState<Record<string, unknown>[]>([]);
  const [allItems, setAllItems] = useState<Record<string, unknown>[]>([]);
  const [showAddCat, setShowAddCat] = useState(false);
  const [showAddProd, setShowAddProd] = useState(false);
  const [showAddSpec, setShowAddSpec] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [newProdName, setNewProdName] = useState('');
  const [newSpecName, setNewSpecName] = useState('');
  const [selectedCat, setSelectedCat] = useState('');
  const [selectedProd, setSelectedProd] = useState('');
  // Edit states
  const [editingCatId, setEditingCatId] = useState<string | null>(null);
  const [editingCatName, setEditingCatName] = useState('');
  const [editingProdId, setEditingProdId] = useState<string | null>(null);
  const [editingProdName, setEditingProdName] = useState('');
  const [editingSpecId, setEditingSpecId] = useState<string | null>(null);
  const [editingSpecName, setEditingSpecName] = useState('');

  const loadCats = useCallback(async () => { const res = await apiFetch<ApiResp>('/api/settings/products/categories'); if (res.success && res.data) setCategories(res.data as Record<string, unknown>[]); }, []);

  const buildAllItems = useCallback(async () => {
    const cRes = await apiFetch<ApiResp>('/api/settings/products/categories');
    if (!cRes.success || !cRes.data) return;
    const cats = cRes.data as Record<string, unknown>[];
    const items: Record<string, unknown>[] = [];
    for (const cat of cats) {
      const pRes = await apiFetch<ApiResp>(`/api/settings/products?category_id=${cat.id}`);
      if (pRes.success && pRes.data) {
        const prods = pRes.data as Record<string, unknown>[];
        for (const p of prods) {
          const sRes = await apiFetch<ApiResp>(`/api/settings/products/specs?product_id=${p.id}`);
          if (sRes.success && sRes.data) {
            const sps = sRes.data as Record<string, unknown>[];
            if (sps.length === 0) items.push({ id: p.id, product_id: p.id, name: p.name, category: cat.name, spec: '', note: '', cat_id: cat.id, spec_id: '' });
            for (const s of sps) items.push({ id: s.id, product_id: p.id, name: p.name, category: cat.name, spec: s.name, note: s.note || '', cat_id: cat.id, spec_id: s.id });
          }
        }
      }
    }
    setAllItems(items);
  }, []);

  useEffect(() => { loadCats(); buildAllItems(); }, [loadCats, buildAllItems]);

  const loadProds = useCallback(async () => { if (!selectedCat) { setProducts([]); return; } const res = await apiFetch<ApiResp>(`/api/settings/products?category_id=${selectedCat}`); if (res.success && res.data) setProducts(res.data as Record<string, unknown>[]); }, [selectedCat]);
  const loadSpecs_ = useCallback(async () => { if (!selectedProd) { setSpecs([]); return; } const res = await apiFetch<ApiResp>(`/api/settings/products/specs?product_id=${selectedProd}`); if (res.success && res.data) setSpecs(res.data as Record<string, unknown>[]); }, [selectedProd]);

  useEffect(() => { loadProds(); setSelectedProd(''); setSpecs([]); }, [loadProds]);
  useEffect(() => { loadSpecs_(); }, [loadSpecs_]);

  const addCat = async () => { if (!newCatName.trim()) return; const res = await apiFetch<ApiResp>('/api/settings/products/categories', { method: 'POST', body: JSON.stringify({ name: newCatName.trim() }) }); if (res.success) { setNewCatName(''); setShowAddCat(false); loadCats(); buildAllItems(); } else alert(res.error); };
  const addProd = async () => { if (!newProdName.trim() || !selectedCat) return; const res = await apiFetch<ApiResp>('/api/settings/products', { method: 'POST', body: JSON.stringify({ name: newProdName.trim(), category_id: selectedCat }) }); if (res.success) { setNewProdName(''); setShowAddProd(false); loadProds(); buildAllItems(); } else alert(res.error); };
  const addSpec = async () => { if (!newSpecName.trim() || !selectedProd) return; const res = await apiFetch<ApiResp>('/api/settings/products/specs', { method: 'POST', body: JSON.stringify({ name: newSpecName.trim(), product_id: selectedProd }) }); if (res.success) { setNewSpecName(''); setShowAddSpec(false); loadSpecs_(); buildAllItems(); } else alert(res.error); };
  const delCat = async (id: string) => { if (!confirm('删除品类将同时删除下属商品和规格')) return; const r = await apiFetch<ApiResp>(`/api/settings/products/categories/${id}`, { method: 'DELETE' }); if (r.success) { loadCats(); setSelectedCat(''); buildAllItems(); } };
  const delProd = async (id: string) => { if (!confirm('确认删除？')) return; const r = await apiFetch<ApiResp>(`/api/settings/products/${id}`, { method: 'DELETE' }); if (r.success) { loadProds(); setSelectedProd(''); buildAllItems(); } };
  const delSpec = async (id: string) => { if (!confirm('确认删除？')) return; const r = await apiFetch<ApiResp>(`/api/settings/products/specs/${id}`, { method: 'DELETE' }); if (r.success) { loadSpecs_(); buildAllItems(); } };

  // Edit functions
  const updateCatName = async (id: string) => { if (!editingCatName.trim()) return; const res = await apiFetch<ApiResp>(`/api/settings/products/categories/${id}`, { method: 'PUT', body: JSON.stringify({ name: editingCatName.trim() }) }); if (res.success) { setEditingCatId(null); loadCats(); buildAllItems(); } else alert(res.error); };
  const updateProdName = async (id: string) => { if (!editingProdName.trim()) return; const res = await apiFetch<ApiResp>(`/api/settings/products/${id}`, { method: 'PUT', body: JSON.stringify({ name: editingProdName.trim() }) }); if (res.success) { setEditingProdId(null); loadProds(); buildAllItems(); } else alert(res.error); };
  const updateSpecName = async (id: string) => { if (!editingSpecName.trim()) return; const res = await apiFetch<ApiResp>(`/api/settings/products/specs/${id}`, { method: 'PUT', body: JSON.stringify({ name: editingSpecName.trim() }) }); if (res.success) { setEditingSpecId(null); loadSpecs_(); buildAllItems(); } else alert(res.error); };

  const exportProducts = async () => {
    const header = '名称,品类,规格,备注';
    const rows = allItems.map(r => `${r.name},${r.category},${r.spec},${(r.note as string || '').replace(/,/g, '，')}`);
    const csv = '\uFEFF' + header + '\n' + rows.join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `商品目录_${new Date().toLocaleDateString('sv-SE')}.csv`; a.click(); window.URL.revokeObjectURL(url);
  };

  const importProducts = () => {
    const input = document.createElement('input');
    input.type = 'file'; input.accept = '.csv';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const text = await file.text();
      const lines = text.replace(/^\uFEFF/, '').split('\n').filter(l => l.trim());
      if (lines.length < 2) { alert('CSV文件无有效数据'); return; }
      const catMap = new Map<string, string>();
      const prodMap = new Map<string, string>();
      for (const cat of categories) catMap.set(cat.name as string, cat.id as string);
      let count = 0;
      for (let i = 1; i < lines.length; i++) {
        const [catName, prodName, specName] = lines[i].split(',').map(s => s.trim());
        if (!catName || !prodName) continue;
        if (!catMap.has(catName)) {
          const res = await apiFetch<ApiResp>('/api/settings/products/categories', { method: 'POST', body: JSON.stringify({ name: catName }) });
          if (res.success && res.data) { const d = res.data as Record<string, unknown>; catMap.set(catName, d.id as string); count++; }
        }
        const catId = catMap.get(catName)!;
        const prodKey = `${catId}:${prodName}`;
        if (!prodMap.has(prodKey)) {
          const res = await apiFetch<ApiResp>('/api/settings/products', { method: 'POST', body: JSON.stringify({ name: prodName, category_id: catId }) });
          if (res.success && res.data) { const d = res.data as Record<string, unknown>; prodMap.set(prodKey, d.id as string); count++; }
        }
        if (specName) {
          const prodId = prodMap.get(prodKey)!;
          const res = await apiFetch<ApiResp>('/api/settings/products/specs', { method: 'POST', body: JSON.stringify({ name: specName, product_id: prodId }) });
          if (res.success) count++;
        }
      }
      alert(`导入完成，新增 ${count} 条记录`);
      loadCats(); buildAllItems(); setSelectedCat(''); setSelectedProd('');
    };
    input.click();
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="font-semibold text-gray-700">商品管理</h3>
        <div className="flex gap-2">
          <button onClick={importProducts} className="bg-green-600 text-white px-3 py-1.5 rounded-lg text-sm">批量导入</button>
          <button onClick={exportProducts} className="bg-gray-600 text-white px-3 py-1.5 rounded-lg text-sm">导出</button>
        </div>
      </div>

      {/* Add form row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl shadow p-4">
          <div className="flex justify-between items-center mb-3"><h4 className="font-medium text-gray-600">商品品类</h4><button onClick={() => setShowAddCat(!showAddCat)} className="text-blue-600 text-sm">+添加</button></div>
          {showAddCat && <div className="flex gap-2 mb-3"><input value={newCatName} onChange={e => setNewCatName(e.target.value)} placeholder="品类名称" className="border rounded px-2 py-1 text-sm flex-1" /><button onClick={addCat} className="bg-blue-600 text-white px-3 py-1 rounded text-sm">添加</button></div>}
          {categories.map(c => (
            <div key={c.id as string} className={`flex justify-between items-center px-3 py-2 rounded cursor-pointer text-sm ${selectedCat === c.id ? 'bg-blue-50 text-blue-700 font-medium' : 'hover:bg-gray-50'}`} onClick={() => setSelectedCat(c.id as string)}>
              {editingCatId === c.id ? (
                <input value={editingCatName} onChange={e => setEditingCatName(e.target.value)} onBlur={() => updateCatName(c.id as string)} onKeyDown={e => e.key === 'Enter' && updateCatName(c.id as string)} className="border rounded px-2 py-0.5 text-sm flex-1" onClick={e => e.stopPropagation()} />
              ) : (
                <span onDoubleClick={() => { setEditingCatId(c.id as string); setEditingCatName(c.name as string); }}>{c.name as string}</span>
              )}
              <button onClick={e => { e.stopPropagation(); delCat(c.id as string); }} className="text-red-400 text-xs hover:text-red-600 ml-2">删除</button>
            </div>
          ))}
        </div>
        <div className="bg-white rounded-xl shadow p-4">
          <div className="flex justify-between items-center mb-3"><h4 className="font-medium text-gray-600">商品</h4><button onClick={() => setShowAddProd(!showAddProd)} className="text-blue-600 text-sm" disabled={!selectedCat}>+添加</button></div>
          {showAddProd && selectedCat && <div className="flex gap-2 mb-3"><input value={newProdName} onChange={e => setNewProdName(e.target.value)} placeholder="商品名称" className="border rounded px-2 py-1 text-sm flex-1" /><button onClick={addProd} className="bg-blue-600 text-white px-3 py-1 rounded text-sm">添加</button></div>}
          {products.map(p => (
            <div key={p.id as string} className={`flex justify-between items-center px-3 py-2 rounded cursor-pointer text-sm ${selectedProd === p.id ? 'bg-blue-50 text-blue-700 font-medium' : 'hover:bg-gray-50'}`} onClick={() => setSelectedProd(p.id as string)}>
              {editingProdId === p.id ? (
                <input value={editingProdName} onChange={e => setEditingProdName(e.target.value)} onBlur={() => updateProdName(p.id as string)} onKeyDown={e => e.key === 'Enter' && updateProdName(p.id as string)} className="border rounded px-2 py-0.5 text-sm flex-1" onClick={e => e.stopPropagation()} />
              ) : (
                <span onDoubleClick={() => { setEditingProdId(p.id as string); setEditingProdName(p.name as string); }}>{p.name as string}</span>
              )}
              <button onClick={e => { e.stopPropagation(); delProd(p.id as string); }} className="text-red-400 text-xs hover:text-red-600 ml-2">删除</button>
            </div>
          ))}
        </div>
        <div className="bg-white rounded-xl shadow p-4">
          <div className="flex justify-between items-center mb-3"><h4 className="font-medium text-gray-600">规格</h4><button onClick={() => setShowAddSpec(!showAddSpec)} className="text-blue-600 text-sm" disabled={!selectedProd}>+添加</button></div>
          {showAddSpec && selectedProd && <div className="flex gap-2 mb-3"><input value={newSpecName} onChange={e => setNewSpecName(e.target.value)} placeholder="规格名称（如：斤、千克、箱）" className="border rounded px-2 py-1 text-sm flex-1" /><button onClick={addSpec} className="bg-blue-600 text-white px-3 py-1 rounded text-sm">添加</button></div>}
          {specs.map(s => (
            <div key={s.id as string} className="flex justify-between items-center px-3 py-2 text-sm hover:bg-gray-50 rounded">
              {editingSpecId === s.id ? (
                <input value={editingSpecName} onChange={e => setEditingSpecName(e.target.value)} onBlur={() => updateSpecName(s.id as string)} onKeyDown={e => e.key === 'Enter' && updateSpecName(s.id as string)} className="border rounded px-2 py-0.5 text-sm flex-1" />
              ) : (
                <span onDoubleClick={() => { setEditingSpecId(s.id as string); setEditingSpecName(s.name as string); }}>{s.name as string}</span>
              )}
              <button onClick={() => delSpec(s.id as string)} className="text-red-400 text-xs hover:text-red-600 ml-2">删除</button>
            </div>
          ))}
        </div>
      </div>

      {/* Product list view */}
      <div className="bg-white rounded-xl shadow overflow-hidden">
        <table className="w-full text-sm">
          <thead><tr className="bg-gray-50"><th className="px-3 py-2 text-left">名称</th><th className="px-3 py-2 text-left">品类</th><th className="px-3 py-2 text-left">规格</th><th className="px-3 py-2 text-left">备注</th><th className="px-3 py-2 text-center">操作</th></tr></thead>
          <tbody>
            {allItems.map((item, i) => (
              <tr key={i} className="border-t hover:bg-gray-50">
                <td className="px-3 py-2">{item.name as string}</td>
                <td className="px-3 py-2">{item.category as string}</td>
                <td className="px-3 py-2">{item.spec as string || '-'}</td>
                <td className="px-3 py-2 text-gray-500">{item.note as string || '-'}</td>
                <td className="px-3 py-2 text-center"><button onClick={async () => {
                  const newName = prompt('商品名称', item.name as string);
                  if (newName === null) return;
                  const newNote = prompt('备注', (item.note as string) || '');
                  if (newNote === null) return;
                  // Update product name/note
                  await apiFetch<ApiResp>(`/api/settings/products/${item.product_id}`, { method: 'PUT', body: JSON.stringify({ name: newName, note: newNote }) });
                  // Update spec name/note if spec exists
                  if (item.spec_id) {
                    const newSpecName = prompt('规格名称', item.spec as string);
                    if (newSpecName !== null) await apiFetch<ApiResp>(`/api/settings/products/specs/${item.spec_id}`, { method: 'PUT', body: JSON.stringify({ name: newSpecName, note: newNote }) });
                  }
                  buildAllItems();
                }} className="text-blue-600 hover:underline text-xs">编辑</button></td>
              </tr>
            ))}
            {allItems.length === 0 && <tr><td colSpan={5} className="px-3 py-4 text-center text-gray-400">暂无商品数据</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ─── SUPPLIER MANAGER ─── */
function SupplierManager() {
  const [suppliers, setSuppliers] = useState<Record<string, unknown>[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', contact_person: '', contact_phone: '', address: '', note: '' });

  const load = useCallback(async () => {
    const res = await apiFetch<ApiResp>('/api/suppliers');
    if (res.success && res.data) setSuppliers(res.data as Record<string, unknown>[]);
  }, []);

  useEffect(() => { load(); }, [load]);

  const submit = async () => {
    if (!form.name.trim()) { alert('供应商名称不能为空'); return; }
    if (editingId) {
      const res = await apiFetch<ApiResp>(`/api/suppliers/${editingId}`, { method: 'PUT', body: JSON.stringify(form) });
      if (res.success) { setShowForm(false); setEditingId(null); setForm({ name: '', contact_person: '', contact_phone: '', address: '', note: '' }); load(); } else alert(res.error);
    } else {
      const res = await apiFetch<ApiResp>('/api/suppliers', { method: 'POST', body: JSON.stringify(form) });
      if (res.success) { setShowForm(false); setForm({ name: '', contact_person: '', contact_phone: '', address: '', note: '' }); load(); } else alert(res.error);
    }
  };

  const startEdit = (s: Record<string, unknown>) => {
    setEditingId(s.id as string);
    setForm({ name: s.name as string || '', contact_person: s.contact_person as string || '', contact_phone: s.contact_phone as string || '', address: s.address as string || '', note: s.note as string || '' });
    setShowForm(true);
  };

  const deleteSupplier = async (id: string) => {
    if (!confirm('确认删除此供应商？')) return;
    const res = await apiFetch<ApiResp>(`/api/suppliers/${id}`, { method: 'DELETE' });
    if (res.success) load(); else alert(res.error);
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center"><h3 className="font-semibold text-gray-700">供应商管理</h3><button onClick={() => { setShowForm(!showForm); setEditingId(null); setForm({ name: '', contact_person: '', contact_phone: '', address: '', note: '' }); }} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm">{showForm && !editingId ? '取消' : '新增供应商'}</button></div>
      {showForm && (
        <div className="bg-white rounded-xl shadow p-5">
          <h4 className="font-medium text-gray-600 mb-3">{editingId ? '编辑供应商' : '新增供应商'}</h4>
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
            <div><label className="block text-xs font-medium text-gray-600 mb-1">供应商名称 *</label><input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm" /></div>
            <div><label className="block text-xs font-medium text-gray-600 mb-1">联系人</label><input value={form.contact_person} onChange={e => setForm(f => ({ ...f, contact_person: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm" /></div>
            <div><label className="block text-xs font-medium text-gray-600 mb-1">联系电话</label><input value={form.contact_phone} onChange={e => setForm(f => ({ ...f, contact_phone: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm" /></div>
            <div><label className="block text-xs font-medium text-gray-600 mb-1">地址</label><input value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm" /></div>
            <div><label className="block text-xs font-medium text-gray-600 mb-1">备注</label><input value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm" /></div>
          </div>
          <div className="flex gap-2 mt-4"><button onClick={submit} className="bg-blue-600 text-white px-6 py-2 rounded-lg text-sm">{editingId ? '保存' : '创建'}</button><button onClick={() => { setShowForm(false); setEditingId(null); }} className="bg-gray-200 text-gray-700 px-6 py-2 rounded-lg text-sm">取消</button></div>
        </div>
      )}
      <div className="bg-white rounded-xl shadow overflow-hidden">
        <table className="w-full text-sm">
          <thead><tr className="bg-gray-50"><th className="px-3 py-2 text-left">名称</th><th className="px-3 py-2 text-left">联系人</th><th className="px-3 py-2 text-left">联系电话</th><th className="px-3 py-2 text-left">备注</th><th className="px-3 py-2 text-center">操作</th></tr></thead>
          <tbody>
            {suppliers.map(s => (
              <tr key={s.id as string} className="border-t hover:bg-gray-50">
                <td className="px-3 py-2">{s.name as string}</td>
                <td className="px-3 py-2">{s.contact_person as string || '-'}</td>
                <td className="px-3 py-2">{s.contact_phone as string || '-'}</td>
                <td className="px-3 py-2 text-gray-500">{s.note as string || '-'}</td>
                <td className="px-3 py-2 text-center space-x-1">
                  <button onClick={() => startEdit(s)} className="text-blue-600 hover:underline text-xs">编辑</button>
                  <button onClick={() => deleteSupplier(s.id as string)} className="text-red-600 hover:underline text-xs">删除</button>
                </td>
              </tr>
            ))}
            {suppliers.length === 0 && <tr><td colSpan={5} className="px-3 py-4 text-center text-gray-400">暂无供应商数据</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
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

  // Stall managers see revenue entry + settings
  const visibleTabs: { key: Tab; label: string }[] = isStallManager
    ? [{ key: 'revenue', label: '营收录入' }, { key: 'settings', label: '基础设置' }]
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
        {tab === 'revenue' && <RevenuePage user={user} />}
        {tab === 'expense' && <ExpensePage />}
        {tab === 'settings' && <SettingsPage user={user} />}
      </main>
    </div>
  );
}
