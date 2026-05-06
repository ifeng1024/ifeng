import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { getCurrentUser, requireRoles, requireMinRole, unauthorized } from '@/lib/auth/guard';
import { hashPassword } from '@/lib/auth/password';
import { RoleCode, RoleLevel, CAN_MANAGE_CANTEEN } from '@/lib/auth/constants';
import type { ApiResponse, DbUser } from '@/lib/auth/types';

interface CreateUserRequest {
  username: string;
  password: string;
  real_name: string;
  role_code: string;
  phone?: string;
  email?: string;
  org_id?: string;
}

/**
 * POST /api/users
 * 创建用户
 * - SYSTEM_DEVELOPER: 可创建任意角色
 * - COMPANY_MANAGER: 可创建 CANTEEN_MANAGER, STALL_MANAGER
 * - CANTEEN_MANAGER: 可创建 STALL_MANAGER
 */
export async function POST(request: NextRequest) {
  const currentUser = getCurrentUser(request);
  if (!currentUser) return unauthorized();

  const minRoleCheck = requireMinRole(currentUser, RoleLevel.CANTEEN_MANAGER);
  if (!minRoleCheck.ok) return minRoleCheck.response;

  try {
    const body = (await request.json()) as CreateUserRequest;

    if (!body.username?.trim() || !body.password || !body.real_name?.trim() || !body.role_code) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: '用户名、密码、姓名、角色不能为空' },
        { status: 400 }
      );
    }

    const validRoles = ['COMPANY_MANAGER', 'CANTEEN_MANAGER', 'STALL_MANAGER', 'REGULAR_USER'];
    if (currentUser.role_code !== RoleCode.SYSTEM_DEVELOPER && !validRoles.includes(body.role_code)) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: '无权创建该角色的用户' },
        { status: 403 }
      );
    }

    // COMPANY_MANAGER can only create CANTEEN_MANAGER and STALL_MANAGER
    if (currentUser.role_code === RoleCode.COMPANY_MANAGER && !['CANTEEN_MANAGER', 'STALL_MANAGER'].includes(body.role_code)) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: '公司负责人只能创建食堂负责人和档口负责人' },
        { status: 403 }
      );
    }

    // CANTEEN_MANAGER can only create STALL_MANAGER
    if (currentUser.role_code === RoleCode.CANTEEN_MANAGER && body.role_code !== 'STALL_MANAGER') {
      return NextResponse.json<ApiResponse>(
        { success: false, error: '食堂负责人只能创建档口负责人' },
        { status: 403 }
      );
    }

    const client = getSupabaseClient();

    // Check username uniqueness
    const { data: existing, error: checkError } = await client
      .from('users')
      .select('id')
      .eq('username', body.username.trim())
      .maybeSingle();

    if (checkError) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: `查询失败: ${checkError.message}` },
        { status: 500 }
      );
    }

    if (existing) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: '用户名已存在' },
        { status: 409 }
      );
    }

    // Create user
    const passwordHash = await hashPassword(body.password);
    const insertData: Record<string, unknown> = {
      username: body.username.trim(),
      password_hash: passwordHash,
      real_name: body.real_name.trim(),
      role_code: body.role_code,
    };
    if (body.phone) insertData.phone = body.phone;
    if (body.email) insertData.email = body.email;
    if (body.org_id) insertData.org_id = body.org_id;

    const { data, error } = await client
      .from('users')
      .insert(insertData)
      .select('id, username, real_name, role_code, org_id, is_disabled, expires_at, is_active, created_at')
      .single();

    if (error) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: `创建用户失败: ${error.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json<ApiResponse>(
      { success: true, data: data as DbUser },
      { status: 201 }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : '创建用户失败';
    return NextResponse.json<ApiResponse>(
      { success: false, error: message },
      { status: 500 }
    );
  }
}

/**
 * GET /api/users
 * 获取用户列表
 * - SYSTEM_DEVELOPER: 全部用户
 * - COMPANY_MANAGER: 自己公司下的用户
 * - CANTEEN_MANAGER: 自己食堂下的用户
 */
export async function GET(request: NextRequest) {
  const currentUser = getCurrentUser(request);
  if (!currentUser) return unauthorized();

  const minRoleCheck = requireMinRole(currentUser, RoleLevel.CANTEEN_MANAGER);
  if (!minRoleCheck.ok) return minRoleCheck.response;

  try {
    const client = getSupabaseClient();

    if (currentUser.role_code === RoleCode.SYSTEM_DEVELOPER) {
      const { data, error } = await client
        .from('users')
        .select('id, username, real_name, phone, email, role_code, org_id, is_disabled, expires_at, is_active, created_at')
        .order('created_at', { ascending: false });
      if (error) return NextResponse.json<ApiResponse>({ success: false, error: error.message }, { status: 500 });
      return NextResponse.json<ApiResponse>({ success: true, data });
    }

    if (currentUser.role_code === RoleCode.COMPANY_MANAGER) {
      // Get all canteens under this company, then get users with org_id in those canteens + the company itself
      const { data: canteens } = await client
        .from('canteens')
        .select('id')
        .eq('company_id', currentUser.org_id);
      const canteenIds = (canteens || []).map((c: { id: string }) => c.id);
      const orgIds = [currentUser.org_id, ...canteenIds];

      // Get stalls under these canteens
      const { data: stalls } = await client
        .from('stalls')
        .select('id')
        .in('canteen_id', canteenIds.length > 0 ? canteenIds : ['__none__']);
      const stallIds = (stalls || []).map((s: { id: string }) => s.id);
      orgIds.push(...stallIds);

      const { data, error } = await client
        .from('users')
        .select('id, username, real_name, phone, email, role_code, org_id, is_disabled, expires_at, is_active, created_at')
        .in('org_id', orgIds.length > 0 ? orgIds : ['__none__'])
        .order('created_at', { ascending: false });
      if (error) return NextResponse.json<ApiResponse>({ success: false, error: error.message }, { status: 500 });
      return NextResponse.json<ApiResponse>({ success: true, data });
    }

    if (currentUser.role_code === RoleCode.CANTEEN_MANAGER) {
      // Get stalls under this canteen
      const { data: stalls } = await client
        .from('stalls')
        .select('id')
        .eq('canteen_id', currentUser.org_id);
      const stallIds = (stalls || []).map((s: { id: string }) => s.id);
      const orgIds = [currentUser.org_id, ...stallIds];

      const { data, error } = await client
        .from('users')
        .select('id, username, real_name, phone, email, role_code, org_id, is_disabled, expires_at, is_active, created_at')
        .in('org_id', orgIds.length > 0 ? orgIds : ['__none__'])
        .order('created_at', { ascending: false });
      if (error) return NextResponse.json<ApiResponse>({ success: false, error: error.message }, { status: 500 });
      return NextResponse.json<ApiResponse>({ success: true, data });
    }

    return NextResponse.json<ApiResponse>({ success: true, data: [] });
  } catch (err) {
    const message = err instanceof Error ? err.message : '查询失败';
    return NextResponse.json<ApiResponse>(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
