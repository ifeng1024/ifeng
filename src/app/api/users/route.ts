import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { getCurrentUser, requireMinRole, unauthorized } from '@/lib/auth/guard';
import { hashPassword } from '@/lib/auth/password';
import { RoleCode, RoleLevel, DEFAULT_PASSWORD } from '@/lib/auth/constants';
import type { ApiResponse } from '@/lib/auth/types';

/**
 * GET /api/users
 * 获取用户列表（按权限过滤）
 */
export async function GET(request: NextRequest) {
  const user = getCurrentUser(request);
  if (!user) return unauthorized();

  try {
    const supabase = getSupabaseClient();
    const { searchParams } = new URL(request.url);
    const roleCode = searchParams.get('role_code');

    let query = supabase
      .from('users')
      .select('id, username, real_name, phone, email, role_code, org_id, is_disabled, expires_at, is_active, created_at')
      .order('created_at', { ascending: false });

    if (roleCode) {
      query = query.eq('role_code', roleCode);
    }

    // Role-based filtering
    if (user.role_code === RoleCode.SYSTEM_DEVELOPER) {
      // Can see all users, optional role_code filter already applied above
    } else if (user.role_code === RoleCode.COMPANY_MANAGER) {
      // Can only see users in own company
      // Need to find canteens under this company first, then find users
      const { data: companyCanteens } = await supabase
        .from('canteens')
        .select('id')
        .eq('company_id', user.org_id);
      const canteenIds = (companyCanteens || []).map((c: { id: string }) => c.id);

      // Also find stalls under those canteens
      let stallIds: string[] = [];
      if (canteenIds.length > 0) {
        const { data: canteenStalls } = await supabase
          .from('stalls')
          .select('id')
          .in('canteen_id', canteenIds);
        stallIds = (canteenStalls || []).map((s: { id: string }) => s.id);
      }

      const orgIds = [...canteenIds, ...stallIds];
      if (orgIds.length === 0) {
        return NextResponse.json<ApiResponse>({ success: true, data: [] });
      }
      query = query.in('org_id', orgIds).in('role_code', [RoleCode.CANTEEN_MANAGER, RoleCode.STALL_MANAGER]);
    } else if (user.role_code === RoleCode.CANTEEN_MANAGER) {
      // Can only see stall managers in own canteen
      // Also find stalls under this canteen
      const { data: canteenStalls } = await supabase
        .from('stalls')
        .select('id')
        .eq('canteen_id', user.org_id);
      const stallIds = (canteenStalls || []).map((s: { id: string }) => s.id);
      const orgIds = [user.org_id, ...stallIds];
      query = query.in('org_id', orgIds).eq('role_code', RoleCode.STALL_MANAGER);
    } else {
      return NextResponse.json<ApiResponse>(
        { success: false, error: '无权限' },
        { status: 403 }
      );
    }

    const { data, error } = await query;

    if (error) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: `查询失败: ${error.message}` },
        { status: 500 }
      );
    }

    // For SYSTEM_DEVELOPER, also fetch company names for COMPANY_MANAGER users
    let enrichedData: Record<string, unknown>[] = (data || []) as Record<string, unknown>[];
    if (user.role_code === RoleCode.SYSTEM_DEVELOPER && enrichedData.length > 0) {
      const companyManagerIds = enrichedData
        .filter((u: Record<string, unknown>) => u.role_code === RoleCode.COMPANY_MANAGER && u.org_id)
        .map((u: Record<string, unknown>) => u.org_id as string);

      if (companyManagerIds.length > 0) {
        const { data: companies } = await supabase
          .from('companies')
          .select('id, name')
          .in('id', companyManagerIds);

        const companyMap = new Map((companies || []).map((c: { id: string; name: string }) => [c.id, c.name]));
        enrichedData = enrichedData.map((u: Record<string, unknown>) => ({
          ...u,
          company_name: u.role_code === RoleCode.COMPANY_MANAGER && u.org_id ? companyMap.get(u.org_id as string) || null : null,
        }));
      }
    }

    return NextResponse.json<ApiResponse>({ success: true, data: enrichedData });
  } catch (err) {
    const message = err instanceof Error ? err.message : '查询失败';
    return NextResponse.json<ApiResponse>(
      { success: false, error: message },
      { status: 500 }
    );
  }
}

/**
 * POST /api/users
 * 创建用户（按权限限制可创建的角色）
 * - SYSTEM_DEVELOPER: 可创建 COMPANY_MANAGER
 * - COMPANY_MANAGER: 可创建 CANTEEN_MANAGER, STALL_MANAGER
 * - CANTEEN_MANAGER: 可创建 STALL_MANAGER
 */
export async function POST(request: NextRequest) {
  const user = getCurrentUser(request);
  if (!user) return unauthorized();

  const minRoleCheck = requireMinRole(user, RoleLevel.CANTEEN_MANAGER);
  if (!minRoleCheck.ok) return minRoleCheck.response;

  try {
    const body = (await request.json()) as {
      username: string;
      real_name: string;
      password?: string;
      role_code: string;
      org_id?: string;
      expires_at?: string;
      company_name?: string;
    };

    const { username, real_name, role_code, org_id, expires_at, company_name } = body;
    const password = body.password || DEFAULT_PASSWORD;

    if (!username || !real_name || !role_code) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: '用户名、姓名和角色为必填' },
        { status: 400 }
      );
    }

    // Role-based creation restrictions
    const allowedRoles: string[] = [];
    if (user.role_code === RoleCode.SYSTEM_DEVELOPER) {
      allowedRoles.push(RoleCode.COMPANY_MANAGER);
    } else if (user.role_code === RoleCode.COMPANY_MANAGER) {
      allowedRoles.push(RoleCode.CANTEEN_MANAGER, RoleCode.STALL_MANAGER);
    } else if (user.role_code === RoleCode.CANTEEN_MANAGER) {
      allowedRoles.push(RoleCode.STALL_MANAGER);
    }

    if (!allowedRoles.includes(role_code)) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: `您无权创建${role_code}角色的账号` },
        { status: 403 }
      );
    }

    // Validate org_id based on role
    let effectiveOrgId = org_id || null;
    if (user.role_code === RoleCode.COMPANY_MANAGER || user.role_code === RoleCode.CANTEEN_MANAGER) {
      // Sub-accounts must belong to the same org
      effectiveOrgId = user.org_id;
    }

    // For SYSTEM_DEVELOPER creating COMPANY_MANAGER, create a company record first
    const supabase = getSupabaseClient();
    if (user.role_code === RoleCode.SYSTEM_DEVELOPER && role_code === RoleCode.COMPANY_MANAGER) {
      const companyName = company_name?.trim() || `${real_name}的公司`;
      const { data: companyData, error: companyError } = await supabase
        .from('companies')
        .insert({ name: companyName })
        .select('id')
        .single();

      if (companyError || !companyData) {
        return NextResponse.json<ApiResponse>(
          { success: false, error: `创建公司失败: ${companyError?.message || '未知错误'}` },
          { status: 500 }
        );
      }
      effectiveOrgId = companyData.id;
    }

    const passwordHash = await hashPassword(password);

    const insertData: Record<string, unknown> = {
      username,
      real_name,
      password_hash: passwordHash,
      role_code,
      org_id: effectiveOrgId,
    };

    if (user.role_code === RoleCode.SYSTEM_DEVELOPER && expires_at) {
      insertData.expires_at = expires_at;
    }

    const { data, error } = await supabase
      .from('users')
      .insert(insertData)
      .select('id, username, real_name, phone, email, role_code, org_id, is_disabled, expires_at, is_active, created_at')
      .single();

    if (error) {
      if (error.message.includes('duplicate') || error.message.includes('unique')) {
        return NextResponse.json<ApiResponse>(
          { success: false, error: '用户名已存在' },
          { status: 409 }
        );
      }
      return NextResponse.json<ApiResponse>(
        { success: false, error: `创建失败: ${error.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json<ApiResponse>({ success: true, data }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : '创建失败';
    return NextResponse.json<ApiResponse>(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
