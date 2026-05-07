import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { getCurrentUser, requireMinRole, unauthorized } from '@/lib/auth/guard';
import { hashPassword } from '@/lib/auth/password';
import { RoleCode, RoleLevel, DEFAULT_PASSWORD } from '@/lib/auth/constants';
import type { ApiResponse } from '@/lib/auth/types';

/**
 * GET /api/users
 * 获取用户列表（按权限过滤）
 * - SYSTEM_DEVELOPER: 可选 role_code 过滤
 * - COMPANY_MANAGER: 看到本公司下所有账号
 * - CANTEEN_MANAGER: 看到本食堂下所有账号
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
      // Can see all users in own company (including self)
      // Get all canteens under this company
      const { data: companyCanteens } = await supabase
        .from('canteens')
        .select('id')
        .eq('company_id', user.org_id);
      const canteenIds = (companyCanteens || []).map((c: { id: string }) => c.id);

      // Get all stalls under those canteens
      let stallIds: string[] = [];
      if (canteenIds.length > 0) {
        const { data: canteenStalls } = await supabase
          .from('stalls')
          .select('id')
          .in('canteen_id', canteenIds);
        stallIds = (canteenStalls || []).map((s: { id: string }) => s.id);
      }

      const orgIds = [user.org_id, ...canteenIds, ...stallIds];
      if (orgIds.length === 0) {
        return NextResponse.json<ApiResponse>({ success: true, data: [] });
      }
      query = query.in('org_id', orgIds).in('role_code', [RoleCode.COMPANY_MANAGER, RoleCode.CANTEEN_MANAGER, RoleCode.STALL_MANAGER]);
    } else if (user.role_code === RoleCode.CANTEEN_MANAGER) {
      // Can see all users in own canteen (including self and stall managers)
      const { data: canteenStalls } = await supabase
        .from('stalls')
        .select('id')
        .eq('canteen_id', user.org_id);
      const stallIds = (canteenStalls || []).map((s: { id: string }) => s.id);
      const orgIds = [user.org_id, ...stallIds];
      query = query.in('org_id', orgIds).in('role_code', [RoleCode.CANTEEN_MANAGER, RoleCode.STALL_MANAGER]);
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

    // Enrich data with company/canteen/stall names
    let enrichedData: Record<string, unknown>[] = (data || []) as Record<string, unknown>[];

    // Collect all org_ids by role for batch lookup
    const companyOrgIds = enrichedData
      .filter((u: Record<string, unknown>) => u.role_code === RoleCode.COMPANY_MANAGER && u.org_id)
      .map((u: Record<string, unknown>) => u.org_id as string);
    const canteenOrgIds = enrichedData
      .filter((u: Record<string, unknown>) => u.role_code === RoleCode.CANTEEN_MANAGER && u.org_id)
      .map((u: Record<string, unknown>) => u.org_id as string);
    const stallOrgIds = enrichedData
      .filter((u: Record<string, unknown>) => u.role_code === RoleCode.STALL_MANAGER && u.org_id)
      .map((u: Record<string, unknown>) => u.org_id as string);

    const [companyRes, canteenRes, stallRes] = await Promise.all([
      companyOrgIds.length > 0 ? supabase.from('companies').select('id, name').in('id', companyOrgIds) : { data: [] },
      canteenOrgIds.length > 0 ? supabase.from('canteens').select('id, name').in('id', canteenOrgIds) : { data: [] },
      stallOrgIds.length > 0 ? supabase.from('stalls').select('id, name, canteen_id').in('id', stallOrgIds) : { data: [] },
    ]);

    const companyMap = new Map((companyRes.data || []).map((c: { id: string; name: string }) => [c.id, c.name]));
    const canteenMap = new Map((canteenRes.data || []).map((c: { id: string; name: string }) => [c.id, c.name]));
    const stallMap = new Map((stallRes.data || []).map((s: { id: string; name: string; canteen_id: string }) => [s.id, { name: s.name, canteen_id: s.canteen_id }]));

    enrichedData = enrichedData.map((u: Record<string, unknown>) => {
      const enriched: Record<string, unknown> = { ...u };
      if (u.role_code === RoleCode.COMPANY_MANAGER && u.org_id) {
        enriched.company_name = companyMap.get(u.org_id as string) || null;
      }
      if (u.role_code === RoleCode.CANTEEN_MANAGER && u.org_id) {
        enriched.canteen_name = canteenMap.get(u.org_id as string) || null;
        // Also find company for this canteen
        const canteen = (canteenRes.data || []).find((c: { id: string }) => c.id === u.org_id);
        if (canteen) {
          // Find company_id for canteen
          enriched.company_name = null; // Will be filled by separate lookup if needed
        }
      }
      if (u.role_code === RoleCode.STALL_MANAGER && u.org_id) {
        const stallInfo = stallMap.get(u.org_id as string);
        enriched.stall_name = stallInfo?.name || null;
        if (stallInfo?.canteen_id) {
          enriched.canteen_name = canteenMap.get(stallInfo.canteen_id) || null;
        }
      }
      return enriched;
    });

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
 * 
 * 支持多选: canteen_ids (CANTEEN_MANAGER), stall_ids (STALL_MANAGER)
 * 为每个选中的组织创建一个账号
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
      canteen_ids?: string[];
      stall_ids?: string[];
      expires_at?: string;
      company_name?: string;
    };

    const { username, real_name, role_code, org_id, canteen_ids, stall_ids, expires_at, company_name } = body;
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

    const supabase = getSupabaseClient();
    const passwordHash = await hashPassword(password);

    // For SYSTEM_DEVELOPER creating COMPANY_MANAGER, create a company record first
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

      const insertData: Record<string, unknown> = {
        username,
        real_name,
        password_hash: passwordHash,
        role_code,
        org_id: companyData.id,
        expires_at: expires_at || null,
      };

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
    }

    // For CANTEEN_MANAGER: must select at least one canteen (canteen_ids)
    if (role_code === RoleCode.CANTEEN_MANAGER) {
      const selectedCanteenIds = canteen_ids && canteen_ids.length > 0 ? canteen_ids : (org_id ? [org_id] : []);
      if (selectedCanteenIds.length === 0) {
        return NextResponse.json<ApiResponse>(
          { success: false, error: '食堂负责人必须选择至少一个食堂' },
          { status: 400 }
        );
      }

      // Create one user per canteen (same username + name, different org_id)
      const results: Record<string, unknown>[] = [];
      for (let i = 0; i < selectedCanteenIds.length; i++) {
        const insertData: Record<string, unknown> = {
          username: selectedCanteenIds.length > 1 ? `${username}_${i + 1}` : username,
          real_name,
          password_hash: passwordHash,
          role_code,
          org_id: selectedCanteenIds[i],
        };

        const { data, error } = await supabase
          .from('users')
          .insert(insertData)
          .select('id, username, real_name, phone, email, role_code, org_id, is_disabled, expires_at, is_active, created_at')
          .single();

        if (error) {
          if (i === 0) {
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
          // Skip subsequent errors for multi-create
          continue;
        }
        results.push(data as Record<string, unknown>);
      }

      return NextResponse.json<ApiResponse>({ success: true, data: results[0] || null }, { status: 201 });
    }

    // For STALL_MANAGER: must select at least one stall (stall_ids)
    if (role_code === RoleCode.STALL_MANAGER) {
      const selectedStallIds = stall_ids && stall_ids.length > 0 ? stall_ids : (org_id ? [org_id] : []);
      if (selectedStallIds.length === 0) {
        return NextResponse.json<ApiResponse>(
          { success: false, error: '档口负责人必须选择至少一个档口' },
          { status: 400 }
        );
      }

      // Create one user per stall
      const results: Record<string, unknown>[] = [];
      for (let i = 0; i < selectedStallIds.length; i++) {
        const insertData: Record<string, unknown> = {
          username: selectedStallIds.length > 1 ? `${username}_${i + 1}` : username,
          real_name,
          password_hash: passwordHash,
          role_code,
          org_id: selectedStallIds[i],
        };

        const { data, error } = await supabase
          .from('users')
          .insert(insertData)
          .select('id, username, real_name, phone, email, role_code, org_id, is_disabled, expires_at, is_active, created_at')
          .single();

        if (error) {
          if (i === 0) {
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
          continue;
        }
        results.push(data as Record<string, unknown>);
      }

      return NextResponse.json<ApiResponse>({ success: true, data: results[0] || null }, { status: 201 });
    }

    // Default case (should not reach here normally)
    const insertData: Record<string, unknown> = {
      username,
      real_name,
      password_hash: passwordHash,
      role_code,
      org_id: org_id || null,
    };

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
