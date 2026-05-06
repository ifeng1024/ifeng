'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { RoleLabel } from '@/lib/auth/constants';
import type { RoleCodeValue } from '@/lib/auth/constants';

// =============== 类型定义 ===============

interface UserInfo {
  id: string;
  username: string;
  real_name: string;
  role_code: RoleCodeValue;
  org_id: string | null;
  is_active: boolean;
}

interface OrgInfo {
  id: string;
  name: string;
  address?: string;
  manager_id?: string | null;
  company_id?: string;
  canteen_id?: string;
}

interface MealTypeInfo {
  id: string;
  canteen_id: string;
  name: string;
  is_active: boolean;
  created_at: string;
}

interface RevenueTypeInfo {
  id: string;
  canteen_id: string;
  name: string;
  is_active: boolean;
  created_at: string;
}

type TabKey = 'overview' | 'meal-types' | 'revenue-types';

// =============== 主组件 ===============

export default function HomePage() {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<UserInfo | null>(null);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<TabKey>('overview');

  // 组织数据
  const [companies, setCompanies] = useState<OrgInfo[]>([]);
  const [canteens, setCanteens] = useState<OrgInfo[]>([]);
  const [stalls, setStalls] = useState<OrgInfo[]>([]);

  // 基础设置 - 食堂选择
  const [selectedCanteenId, setSelectedCanteenId] = useState<string>('');
  const [dropdownCanteens, setDropdownCanteens] = useState<OrgInfo[]>([]);
  const [dropdownStalls, setDropdownStalls] = useState<OrgInfo[]>([]);

  // 餐别管理
  const [mealTypes, setMealTypes] = useState<MealTypeInfo[]>([]);
  const [newMealTypeName, setNewMealTypeName] = useState('');
  const [mealTypeLoading, setMealTypeLoading] = useState(false);

  // 营收类型管理
  const [revenueTypes, setRevenueTypes] = useState<RevenueTypeInfo[]>([]);
  const [newRevenueTypeName, setNewRevenueTypeName] = useState('');
  const [revenueTypeLoading, setRevenueTypeLoading] = useState(false);

  // 从 localStorage 恢复登录状态
  useEffect(() => {
    const savedToken = localStorage.getItem('canteen_token');
    if (savedToken) {
      setToken(savedToken);
      fetchUser(savedToken);
    }
  }, []);

  const fetchUser = async (t: string) => {
    try {
      const res = await fetch('/api/auth/me', { headers: { Authorization: `Bearer ${t}` } });
      const data = await res.json();
      if (data.success) {
        setUser(data.data);
      } else {
        localStorage.removeItem('canteen_token');
        setToken(null);
        setUser(null);
      }
    } catch {
      localStorage.removeItem('canteen_token');
      setToken(null);
      setUser(null);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    setLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (data.success && data.data) {
        setToken(data.data.token);
        setUser(data.data.user);
        localStorage.setItem('canteen_token', data.data.token);
      } else {
        setLoginError(data.error || '登录失败');
      }
    } catch {
      setLoginError('网络错误，请重试');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('canteen_token');
    setToken(null);
    setUser(null);
    setUsername('');
    setPassword('');
    setCompanies([]);
    setCanteens([]);
    setStalls([]);
    setActiveTab('overview');
    setSelectedCanteenId('');
    setDropdownCanteens([]);
    setDropdownStalls([]);
    setMealTypes([]);
    setRevenueTypes([]);
  };

  // 加载组织数据（概览页）
  const loadOrgData = useCallback(async () => {
    if (!token || !user) return;
    const headers = { Authorization: `Bearer ${token}` };
    try {
      const compRes = await fetch('/api/companies', { headers });
      const compData = await compRes.json();
      if (compData.success) {
        setCompanies(compData.data || []);
        const comps = compData.data || [];
        if (comps.length > 0) {
          const companyId = user.role_code === 'COMPANY_MANAGER' && user.org_id ? user.org_id : comps[0].id;
          const cantRes = await fetch(`/api/companies/${companyId}/canteens`, { headers });
          const cantData = await cantRes.json();
          if (cantData.success) {
            setCanteens(cantData.data || []);
            const cts = cantData.data || [];
            if (cts.length > 0) {
              const canteenId = user.role_code === 'CANTEEN_MANAGER' && user.org_id ? user.org_id : cts[0].id;
              const stallRes = await fetch(`/api/canteens/${canteenId}/stalls`, { headers });
              const stallData = await stallRes.json();
              if (stallData.success) setStalls(stallData.data || []);
            }
          }
        }
      }
    } catch { /* silent */ }
  }, [token, user]);

  // 加载下拉食堂列表（基础设置页）
  const loadDropdownCanteens = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch('/api/dropdown/canteens', { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (data.success) {
        const cts = (data.data || []) as OrgInfo[];
        setDropdownCanteens(cts);
        // 自动选中第一个
        if (cts.length > 0 && !selectedCanteenId) {
          setSelectedCanteenId(cts[0].id);
        }
      }
    } catch { /* silent */ }
  }, [token, selectedCanteenId]);

  // 根据食堂ID加载档口下拉
  const loadDropdownStalls = useCallback(async (canteenId: string) => {
    if (!token || !canteenId) return;
    try {
      const res = await fetch(`/api/dropdown/stalls?canteen_id=${canteenId}`, { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (data.success) setDropdownStalls(data.data || []);
    } catch { /* silent */ }
  }, [token]);

  // 加载餐别列表
  const loadMealTypes = useCallback(async (canteenId: string) => {
    if (!token || !canteenId) return;
    try {
      const res = await fetch(`/api/meal-types?canteen_id=${canteenId}`, { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (data.success) setMealTypes(data.data || []);
    } catch { /* silent */ }
  }, [token]);

  // 加载营收类型列表
  const loadRevenueTypes = useCallback(async (canteenId: string) => {
    if (!token || !canteenId) return;
    try {
      const res = await fetch(`/api/revenue-types?canteen_id=${canteenId}`, { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (data.success) setRevenueTypes(data.data || []);
    } catch { /* silent */ }
  }, [token]);

  useEffect(() => {
    if (token && user) loadOrgData();
  }, [token, user, loadOrgData]);

  useEffect(() => {
    if (token) loadDropdownCanteens();
  }, [token, loadDropdownCanteens]);

  useEffect(() => {
    if (selectedCanteenId) {
      loadDropdownStalls(selectedCanteenId);
      loadMealTypes(selectedCanteenId);
      loadRevenueTypes(selectedCanteenId);
    }
  }, [selectedCanteenId, loadDropdownStalls, loadMealTypes, loadRevenueTypes]);

  // 餐别操作
  const handleAddMealType = async () => {
    if (!newMealTypeName.trim() || !selectedCanteenId) return;
    setMealTypeLoading(true);
    try {
      const res = await fetch('/api/meal-types', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ canteen_id: selectedCanteenId, name: newMealTypeName.trim() }),
      });
      const data = await res.json();
      if (data.success) {
        setNewMealTypeName('');
        loadMealTypes(selectedCanteenId);
      } else {
        alert(data.error || '添加失败');
      }
    } catch {
      alert('网络错误');
    } finally {
      setMealTypeLoading(false);
    }
  };

  const handleDeleteMealType = async (id: string) => {
    if (!confirm('确定要删除此餐别吗？')) return;
    try {
      const res = await fetch(`/api/meal-types/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) {
        loadMealTypes(selectedCanteenId);
      } else {
        alert(data.error || '删除失败');
      }
    } catch {
      alert('网络错误');
    }
  };

  // 营收类型操作
  const handleAddRevenueType = async () => {
    if (!newRevenueTypeName.trim() || !selectedCanteenId) return;
    setRevenueTypeLoading(true);
    try {
      const res = await fetch('/api/revenue-types', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ canteen_id: selectedCanteenId, name: newRevenueTypeName.trim() }),
      });
      const data = await res.json();
      if (data.success) {
        setNewRevenueTypeName('');
        loadRevenueTypes(selectedCanteenId);
      } else {
        alert(data.error || '添加失败');
      }
    } catch {
      alert('网络错误');
    } finally {
      setRevenueTypeLoading(false);
    }
  };

  const handleDeleteRevenueType = async (id: string) => {
    if (!confirm('确定要删除此营收类型吗？')) return;
    try {
      const res = await fetch(`/api/revenue-types/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) {
        loadRevenueTypes(selectedCanteenId);
      } else {
        alert(data.error || '删除失败');
      }
    } catch {
      alert('网络错误');
    }
  };

  // 常用餐别预设
  const mealTypePresets = ['早餐', '午餐', '晚餐', '夜宵'];
  const revenueTypePresets = ['堂食', '外送', '外卖', '其他'];

  // =============== 未登录：登录页面 ===============
  if (!token || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-emerald-50 via-white to-amber-50 p-4">
        <Card className="w-full max-w-md shadow-lg">
          <CardHeader className="text-center">
            <div className="mx-auto mb-2 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100">
              <svg className="h-7 w-7 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
            </div>
            <CardTitle className="text-2xl font-bold">食堂管理系统</CardTitle>
            <CardDescription>请使用您的账号登录系统</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="username">用户名</Label>
                <Input id="username" placeholder="请输入用户名" value={username} onChange={(e) => setUsername(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">密码</Label>
                <Input id="password" type="password" placeholder="请输入密码" value={password} onChange={(e) => setPassword(e.target.value)} required />
              </div>
              {loginError && <p className="text-sm text-destructive">{loginError}</p>}
              <Button type="submit" className="w-full" disabled={loading}>{loading ? '登录中...' : '登 录'}</Button>
            </form>
            <Separator className="my-6" />
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground text-center">测试账号（点击快速填入）</p>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: '系统开发者', username: 'dev', password: 'dev123456' },
                  { label: '公司负责人', username: 'company_mgr', password: 'company123456' },
                  { label: '食堂负责人', username: 'canteen_mgr', password: 'canteen123456' },
                  { label: '档口负责人', username: 'stall_mgr', password: 'stall123456' },
                ].map((acc) => (
                  <button key={acc.username} type="button" className="rounded-md border px-2 py-1.5 text-xs text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors text-left truncate" onClick={() => { setUsername(acc.username); setPassword(acc.password); }}>
                    {acc.label}
                  </button>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // =============== 已登录 ===============
  const roleLabel = (RoleLabel as Record<string, string>)[user.role_code] || user.role_code;
  const canManageSettings = ['SYSTEM_DEVELOPER', 'COMPANY_MANAGER', 'CANTEEN_MANAGER'].includes(user.role_code);

  const tabs: { key: TabKey; label: string; icon: string }[] = [
    { key: 'overview', label: '系统概览', icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6' },
    { key: 'meal-types', label: '餐别管理', icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z' },
    { key: 'revenue-types', label: '营收类型', icon: 'M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z' },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50/50 via-white to-amber-50/50">
      {/* 顶部导航 */}
      <header className="sticky top-0 z-10 border-b bg-white/80 backdrop-blur-sm">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-emerald-100">
              <svg className="h-4 w-4 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
            </div>
            <span className="font-semibold">食堂管理系统</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground">{user.real_name}</span>
            <Badge variant="secondary">{roleLabel}</Badge>
            <Button variant="outline" size="sm" onClick={handleLogout}>退出</Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6">
        {/* Tab 导航 */}
        <div className="mb-6 flex gap-1 rounded-lg bg-muted p-1">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => canManageSettings || tab.key === 'overview' ? setActiveTab(tab.key) : null}
              className={`flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
                activeTab === tab.key
                  ? 'bg-white text-foreground shadow-sm'
                  : canManageSettings || tab.key === 'overview'
                    ? 'text-muted-foreground hover:text-foreground'
                    : 'text-muted-foreground/40 cursor-not-allowed'
              }`}
              disabled={!canManageSettings && tab.key !== 'overview'}
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={tab.icon} />
              </svg>
              {tab.label}
            </button>
          ))}
        </div>

        {/* 食堂选择器（基础设置页通用） */}
        {activeTab !== 'overview' && (
          <Card className="mb-6">
            <CardContent className="flex items-end gap-4 pt-6">
              <div className="flex-1 space-y-2">
                <Label>选择食堂</Label>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  value={selectedCanteenId}
                  onChange={(e) => setSelectedCanteenId(e.target.value)}
                >
                  <option value="">请选择食堂</option>
                  {dropdownCanteens.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              {selectedCanteenId && dropdownStalls.length > 0 && (
                <div className="flex-1 space-y-2">
                  <Label>档口（只读）</Label>
                  <select
                    className="flex h-10 w-full rounded-md border border-input bg-muted px-3 py-2 text-sm"
                    disabled
                  >
                    <option>共 {dropdownStalls.length} 个档口</option>
                  </select>
                </div>
              )}
              {selectedCanteenId && (
                <Badge variant="outline" className="mb-2.5">
                  {mealTypes.length} 个餐别 · {revenueTypes.length} 个营收类型
                </Badge>
              )}
            </CardContent>
          </Card>
        )}

        {/* =============== 系统概览 =============== */}
        {activeTab === 'overview' && (
          <>
            <Card className="mb-8 border-emerald-200 bg-gradient-to-r from-emerald-50 to-white">
              <CardHeader>
                <CardTitle className="text-xl">欢迎回来，{user.real_name}</CardTitle>
                <CardDescription>
                  当前角色：{roleLabel}
                  {user.org_id && <span className="ml-2 text-muted-foreground">（组织 ID: {user.org_id.slice(0, 8)}...）</span>}
                </CardDescription>
              </CardHeader>
            </Card>

            <div className="grid gap-6 md:grid-cols-3">
              {[
                { title: '公司', items: companies, count: companies.length },
                { title: '食堂', items: canteens, count: canteens.length },
                { title: '档口', items: stalls, count: stalls.length },
              ].map((section) => (
                <Card key={section.title}>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base">{section.title}</CardTitle>
                      <Badge variant="outline">{section.count}</Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {section.items.length === 0 ? (
                      <p className="text-sm text-muted-foreground">暂无数据</p>
                    ) : (
                      section.items.slice(0, 5).map((item) => (
                        <div key={item.id} className="flex items-center justify-between rounded-lg border p-3">
                          <div>
                            <p className="text-sm font-medium">{item.name}</p>
                            {item.address && <p className="text-xs text-muted-foreground">{item.address}</p>}
                          </div>
                          {item.manager_id && <Badge variant="secondary" className="text-xs">已指定负责人</Badge>}
                        </div>
                      ))
                    )}
                    {section.items.length > 5 && (
                      <p className="text-xs text-muted-foreground text-center">还有 {section.items.length - 5} 个{section.title}...</p>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>

            <Card className="mt-8">
              <CardHeader><CardTitle className="text-base">权限说明</CardTitle></CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="py-2 pr-4 text-left font-medium text-muted-foreground">角色</th>
                        <th className="py-2 pr-4 text-left font-medium text-muted-foreground">管理公司</th>
                        <th className="py-2 pr-4 text-left font-medium text-muted-foreground">管理食堂</th>
                        <th className="py-2 pr-4 text-left font-medium text-muted-foreground">餐别/营收类型</th>
                        <th className="py-2 pr-4 text-left font-medium text-muted-foreground">管理档口</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        { role: '系统开发者', comp: '全部', cant: '全部', config: '全部食堂', stall: '全部' },
                        { role: '公司负责人', comp: '-', cant: '本公司内', config: '本公司食堂', stall: '-' },
                        { role: '食堂负责人', comp: '-', cant: '-', config: '自己食堂', stall: '本食堂内' },
                        { role: '档口负责人', comp: '-', cant: '-', config: '无权限', stall: '-' },
                        { role: '普通订餐用户', comp: '-', cant: '-', config: '无权限', stall: '-' },
                      ].map((row) => (
                        <tr key={row.role} className="border-b last:border-0">
                          <td className="py-2 pr-4 font-medium">{row.role}</td>
                          <td className="py-2 pr-4">{row.comp}</td>
                          <td className="py-2 pr-4">{row.cant}</td>
                          <td className="py-2 pr-4">{row.config}</td>
                          <td className="py-2 pr-4">{row.stall}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </>
        )}

        {/* =============== 餐别管理 =============== */}
        {activeTab === 'meal-types' && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">餐别管理</CardTitle>
              <CardDescription>
                为当前食堂配置可用的餐别，营收录入时将根据所选食堂动态加载
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* 添加餐别 */}
              <div className="flex gap-3">
                <Input
                  placeholder="输入餐别名称"
                  value={newMealTypeName}
                  onChange={(e) => setNewMealTypeName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddMealType()}
                  className="max-w-xs"
                  disabled={!selectedCanteenId || mealTypeLoading}
                />
                <Button onClick={handleAddMealType} disabled={!selectedCanteenId || !newMealTypeName.trim() || mealTypeLoading}>
                  {mealTypeLoading ? '添加中...' : '添加'}
                </Button>
              </div>

              {/* 快捷预设 */}
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">快捷填入常用餐别：</p>
                <div className="flex gap-2">
                  {mealTypePresets.map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      className="rounded-md border px-3 py-1 text-xs text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
                      onClick={() => setNewMealTypeName(preset)}
                    >
                      {preset}
                    </button>
                  ))}
                </div>
              </div>

              <Separator />

              {/* 餐别列表 */}
              {!selectedCanteenId ? (
                <p className="text-sm text-muted-foreground text-center py-8">请先选择食堂</p>
              ) : mealTypes.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">暂无餐别，请添加</p>
              ) : (
                <div className="space-y-2">
                  {mealTypes.map((mt) => (
                    <div key={mt.id} className="flex items-center justify-between rounded-lg border p-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-100 text-amber-700 text-xs font-medium">
                          {mt.name.slice(0, 1)}
                        </div>
                        <div>
                          <p className="text-sm font-medium">{mt.name}</p>
                          <p className="text-xs text-muted-foreground">创建于 {new Date(mt.created_at).toLocaleDateString()}</p>
                        </div>
                      </div>
                      <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => handleDeleteMealType(mt.id)}>
                        删除
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* =============== 营收类型管理 =============== */}
        {activeTab === 'revenue-types' && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">营收类型管理</CardTitle>
              <CardDescription>
                为当前食堂配置营收类型（堂食、外送等），营收录入时将动态加载
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* 添加营收类型 */}
              <div className="flex gap-3">
                <Input
                  placeholder="输入营收类型名称"
                  value={newRevenueTypeName}
                  onChange={(e) => setNewRevenueTypeName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddRevenueType()}
                  className="max-w-xs"
                  disabled={!selectedCanteenId || revenueTypeLoading}
                />
                <Button onClick={handleAddRevenueType} disabled={!selectedCanteenId || !newRevenueTypeName.trim() || revenueTypeLoading}>
                  {revenueTypeLoading ? '添加中...' : '添加'}
                </Button>
              </div>

              {/* 快捷预设 */}
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">快捷填入常用类型：</p>
                <div className="flex gap-2">
                  {revenueTypePresets.map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      className="rounded-md border px-3 py-1 text-xs text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
                      onClick={() => setNewRevenueTypeName(preset)}
                    >
                      {preset}
                    </button>
                  ))}
                </div>
              </div>

              <Separator />

              {/* 营收类型列表 */}
              {!selectedCanteenId ? (
                <p className="text-sm text-muted-foreground text-center py-8">请先选择食堂</p>
              ) : revenueTypes.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">暂无营收类型，请添加</p>
              ) : (
                <div className="space-y-2">
                  {revenueTypes.map((rt) => (
                    <div key={rt.id} className="flex items-center justify-between rounded-lg border p-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-blue-700 text-xs font-medium">
                          {rt.name.slice(0, 1)}
                        </div>
                        <div>
                          <p className="text-sm font-medium">{rt.name}</p>
                          <p className="text-xs text-muted-foreground">创建于 {new Date(rt.created_at).toLocaleDateString()}</p>
                        </div>
                      </div>
                      <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => handleDeleteRevenueType(rt.id)}>
                        删除
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
