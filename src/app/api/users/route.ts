import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { getCurrentUser, requireRoles } from '@/lib/auth/guard';
import { hashPassword } from '@/lib/auth/password';
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
 * 创建用户（仅系统开发者可创建任意角色用户）
 */
export async function POST(request: NextRequest) {
  const currentUser = getCurrentUser(request);
  const roleCheck = requireRoles(currentUser, ['SYSTEM_DEVELOPER']);
  if (!roleCheck.ok) return roleCheck.response;

  try {
    const body = (await request.json()) as CreateUserRequest;

    if (!body.username?.trim() || !body.password || !body.real_name?.trim() || !body.role_code) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: '用户名、密码、姓名、角色不能为空' },
        { status: 400 }
      );
    }

    const validRoles = ['SYSTEM_DEVELOPER', 'COMPANY_MANAGER', 'CANTEEN_MANAGER', 'STALL_MANAGER', 'REGULAR_USER'];
    if (!validRoles.includes(body.role_code)) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: `无效的角色代码，允许值: ${validRoles.join(', ')}` },
        { status: 400 }
      );
    }

    const client = getSupabaseClient();

    // 检查用户名是否已存在
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

    // 创建用户
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
      .select('id, username, real_name, role_code, org_id, is_active, created_at')
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
 * 获取用户列表（仅系统开发者）
 */
export async function GET(request: NextRequest) {
  const currentUser = getCurrentUser(request);
  const roleCheck = requireRoles(currentUser, ['SYSTEM_DEVELOPER']);
  if (!roleCheck.ok) return roleCheck.response;

  try {
    const client = getSupabaseClient();
    const { data, error } = await client
      .from('users')
      .select('id, username, real_name, phone, email, role_code, org_id, is_active, created_at')
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: `查询失败: ${error.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json<ApiResponse>({ success: true, data });
  } catch (err) {
    const message = err instanceof Error ? err.message : '查询失败';
    return NextResponse.json<ApiResponse>(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
