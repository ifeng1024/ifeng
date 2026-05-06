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
}

export default function HomePage() {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<UserInfo | null>(null);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loading, setLoading] = useState(false);

  // 组织数据
  const [companies, setCompanies] = useState<OrgInfo[]>([]);
  const [canteens, setCanteens] = useState<OrgInfo[]>([]);
  const [stalls, setStalls] = useState<OrgInfo[]>([]);

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
      const res = await fetch('/api/auth/me', {
        headers: { Authorization: `Bearer ${t}` },
      });
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
  };

  // 加载组织数据
  const loadOrgData = useCallback(async () => {
    if (!token || !user) return;
    const headers = { Authorization: `Bearer ${token}` };

    try {
      // 加载公司
      const compRes = await fetch('/api/companies', { headers });
      const compData = await compRes.json();
      if (compData.success) {
        setCompanies(compData.data || []);
        // 如果只有一个公司，自动加载其食堂
        const comps = compData.data || [];
        if (comps.length > 0) {
          const companyId = user.role_code === 'COMPANY_MANAGER' && user.org_id
            ? user.org_id
            : comps[0].id;

          const cantRes = await fetch(`/api/companies/${companyId}/canteens`, { headers });
          const cantData = await cantRes.json();
          if (cantData.success) {
            setCanteens(cantData.data || []);
            // 加载第一个食堂的档口
            const cts = cantData.data || [];
            if (cts.length > 0) {
              const canteenId = user.role_code === 'CANTEEN_MANAGER' && user.org_id
                ? user.org_id
                : cts[0].id;
              const stallRes = await fetch(`/api/canteens/${canteenId}/stalls`, { headers });
              const stallData = await stallRes.json();
              if (stallData.success) {
                setStalls(stallData.data || []);
              }
            }
          }
        }
      }
    } catch {
      // 静默处理
    }
  }, [token, user]);

  useEffect(() => {
    if (token && user) {
      loadOrgData();
    }
  }, [token, user, loadOrgData]);

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
                <Input
                  id="username"
                  placeholder="请输入用户名"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">密码</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="请输入密码"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
              {loginError && (
                <p className="text-sm text-destructive">{loginError}</p>
              )}
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? '登录中...' : '登 录'}
              </Button>
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
                  <button
                    key={acc.username}
                    type="button"
                    className="rounded-md border px-2 py-1.5 text-xs text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors text-left truncate"
                    onClick={() => { setUsername(acc.username); setPassword(acc.password); }}
                  >
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

  // =============== 已登录：系统概览 ===============
  const roleLabel = (RoleLabel as Record<string, string>)[user.role_code] || user.role_code;

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

      <main className="mx-auto max-w-6xl px-4 py-8">
        {/* 欢迎卡片 */}
        <Card className="mb-8 border-emerald-200 bg-gradient-to-r from-emerald-50 to-white">
          <CardHeader>
            <CardTitle className="text-xl">
              欢迎回来，{user.real_name}
            </CardTitle>
            <CardDescription>
              当前角色：{roleLabel}
              {user.org_id && <span className="ml-2 text-muted-foreground">（组织 ID: {user.org_id.slice(0, 8)}...）</span>}
            </CardDescription>
          </CardHeader>
        </Card>

        {/* 组织架构概览 */}
        <div className="grid gap-6 md:grid-cols-3">
          {/* 公司 */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">公司</CardTitle>
                <Badge variant="outline">{companies.length}</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {companies.length === 0 ? (
                <p className="text-sm text-muted-foreground">暂无数据</p>
              ) : (
                companies.slice(0, 5).map((c) => (
                  <div key={c.id} className="flex items-center justify-between rounded-lg border p-3">
                    <div>
                      <p className="text-sm font-medium">{c.name}</p>
                      {c.address && <p className="text-xs text-muted-foreground">{c.address}</p>}
                    </div>
                    {c.manager_id && (
                      <Badge variant="secondary" className="text-xs">已指定负责人</Badge>
                    )}
                  </div>
                ))
              )}
              {companies.length > 5 && (
                <p className="text-xs text-muted-foreground text-center">还有 {companies.length - 5} 家公司...</p>
              )}
            </CardContent>
          </Card>

          {/* 食堂 */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">食堂</CardTitle>
                <Badge variant="outline">{canteens.length}</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {canteens.length === 0 ? (
                <p className="text-sm text-muted-foreground">暂无数据</p>
              ) : (
                canteens.slice(0, 5).map((c) => (
                  <div key={c.id} className="flex items-center justify-between rounded-lg border p-3">
                    <div>
                      <p className="text-sm font-medium">{c.name}</p>
                      {c.address && <p className="text-xs text-muted-foreground">{c.address}</p>}
                    </div>
                    {c.manager_id && (
                      <Badge variant="secondary" className="text-xs">已指定负责人</Badge>
                    )}
                  </div>
                ))
              )}
              {canteens.length > 5 && (
                <p className="text-xs text-muted-foreground text-center">还有 {canteens.length - 5} 个食堂...</p>
              )}
            </CardContent>
          </Card>

          {/* 档口 */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">档口</CardTitle>
                <Badge variant="outline">{stalls.length}</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {stalls.length === 0 ? (
                <p className="text-sm text-muted-foreground">暂无数据</p>
              ) : (
                stalls.slice(0, 5).map((s) => (
                  <div key={s.id} className="flex items-center justify-between rounded-lg border p-3">
                    <div>
                      <p className="text-sm font-medium">{s.name}</p>
                    </div>
                    {s.manager_id && (
                      <Badge variant="secondary" className="text-xs">已指定负责人</Badge>
                    )}
                  </div>
                ))
              )}
              {stalls.length > 5 && (
                <p className="text-xs text-muted-foreground text-center">还有 {stalls.length - 5} 个档口...</p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* 权限说明 */}
        <Card className="mt-8">
          <CardHeader>
            <CardTitle className="text-base">权限说明</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="py-2 pr-4 text-left font-medium text-muted-foreground">角色</th>
                    <th className="py-2 pr-4 text-left font-medium text-muted-foreground">管理公司</th>
                    <th className="py-2 pr-4 text-left font-medium text-muted-foreground">管理食堂</th>
                    <th className="py-2 pr-4 text-left font-medium text-muted-foreground">管理档口</th>
                    <th className="py-2 pr-4 text-left font-medium text-muted-foreground">管理用户</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { role: '系统开发者', comp: '全部', cant: '全部', stall: '全部', user: '全部' },
                    { role: '公司负责人', comp: '-', cant: '本公司内', stall: '-', user: '-' },
                    { role: '食堂负责人', comp: '-', cant: '-', stall: '本食堂内', user: '-' },
                    { role: '档口负责人', comp: '-', cant: '-', stall: '-', user: '-' },
                    { role: '普通订餐用户', comp: '-', cant: '-', stall: '-', user: '-' },
                  ].map((row) => (
                    <tr key={row.role} className="border-b last:border-0">
                      <td className="py-2 pr-4 font-medium">{row.role}</td>
                      <td className="py-2 pr-4">{row.comp}</td>
                      <td className="py-2 pr-4">{row.cant}</td>
                      <td className="py-2 pr-4">{row.stall}</td>
                      <td className="py-2 pr-4">{row.user}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
