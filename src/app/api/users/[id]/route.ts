import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { getCurrentUser, requireMinRole, unauthorized } from '@/lib/auth/guard';
import { RoleCode, RoleLevel } from '@/lib/auth/constants';
import { hashPassword } from '@/lib/auth/password';
import type { ApiResponse } from '@/lib/auth/types';

type RouteContext = { params: Promise<{ id: string }> };

/**
 * GET /api/users/[id]
 */
export async function GET(
  request: NextRequest,
  context: RouteContext
) {
  const user = getCurrentUser(request);
  if (!user) return unauthorized();

  const { id } = await context.params;
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('users')
    .select('id, username, real_name, phone, email, role_code, org_id, is_disabled, expires_at, is_active, created_at')
    .eq('id', id)
    .single();

  if (error || !data) {
    return NextResponse.json<ApiResponse>(
      { success: false, error: '用户不存在' },
      { status: 404 }
    );
  }

  return NextResponse.json<ApiResponse>({ success: true, data });
}

/**
 * PUT /api/users/[id]
 * 编辑用户信息
 */
export async function PUT(
  request: NextRequest,
  context: RouteContext
) {
  const user = getCurrentUser(request);
  if (!user) return unauthorized();

  const { id } = await context.params;
  const body = (await request.json()) as Record<string, unknown>;
  const supabase = getSupabaseClient();

  // First, get the target user to check permissions
  const { data: targetUser, error: fetchErr } = await supabase
    .from('users')
    .select('id, role_code, org_id')
    .eq('id', id)
    .single();

  if (fetchErr || !targetUser) {
    return NextResponse.json<ApiResponse>(
      { success: false, error: '用户不存在' },
      { status: 404 }
    );
  }

  // Build update object based on role permissions
  const updateData: Record<string, unknown> = {};
  let passwordChanged = false;

  if (user.role_code === RoleCode.SYSTEM_DEVELOPER) {
    // Can edit anything
    if (body.real_name !== undefined) updateData.real_name = body.real_name;
    if (body.role_code !== undefined) updateData.role_code = body.role_code;
    if (body.org_id !== undefined) updateData.org_id = body.org_id;
    if (body.is_disabled !== undefined) updateData.is_disabled = body.is_disabled;
    if (body.expires_at !== undefined) updateData.expires_at = body.expires_at || null;
    // Developer can set password for any user
    if (body.password && typeof body.password === 'string' && body.password.length >= 6) {
      updateData.password_hash = await hashPassword(body.password);
      passwordChanged = true;
    }
    // Developer can update company name for COMPANY_MANAGER users
    if (body.company_name !== undefined && targetUser.role_code === RoleCode.COMPANY_MANAGER) {
      // Update the company name in companies table
      if (targetUser.org_id) {
        await supabase.from('companies').update({ name: body.company_name }).eq('id', targetUser.org_id);
      }
    }
  } else if (user.role_code === RoleCode.COMPANY_MANAGER) {
    // Can only edit canteen/stall managers in own company
    if (![RoleCode.CANTEEN_MANAGER, RoleCode.STALL_MANAGER].includes(targetUser.role_code)) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: '无权编辑此用户' },
        { status: 403 }
      );
    }
    if (body.real_name !== undefined) updateData.real_name = body.real_name;
    if (body.org_id !== undefined) updateData.org_id = body.org_id;
    if (body.is_disabled !== undefined) updateData.is_disabled = body.is_disabled;
    if (body.expires_at !== undefined) updateData.expires_at = body.expires_at || null;
    // Company manager can set password for subordinate users
    if (body.password && typeof body.password === 'string' && body.password.length >= 6) {
      updateData.password_hash = await hashPassword(body.password);
      passwordChanged = true;
    }
  } else if (user.role_code === RoleCode.CANTEEN_MANAGER) {
    // Can only edit stall managers in own canteen
    if (targetUser.role_code !== RoleCode.STALL_MANAGER) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: '无权编辑此用户' },
        { status: 403 }
      );
    }
    if (body.real_name !== undefined) updateData.real_name = body.real_name;
    if (body.org_id !== undefined) updateData.org_id = body.org_id;
    if (body.is_disabled !== undefined) updateData.is_disabled = body.is_disabled;
    // Canteen manager can set password for stall managers
    if (body.password && typeof body.password === 'string' && body.password.length >= 6) {
      updateData.password_hash = await hashPassword(body.password);
      passwordChanged = true;
    }
  } else {
    return NextResponse.json<ApiResponse>(
      { success: false, error: '无权编辑用户' },
      { status: 403 }
    );
  }

  // If only password was changed and no other fields, still allow update
  if (Object.keys(updateData).length === 0) {
    return NextResponse.json<ApiResponse>(
      { success: false, error: '无更新内容' },
      { status: 400 }
    );
  }

  const { data, error } = await supabase
    .from('users')
    .update(updateData)
    .eq('id', id)
    .select('id, username, real_name, phone, email, role_code, org_id, is_disabled, expires_at, is_active, created_at')
    .single();

  if (error) {
    return NextResponse.json<ApiResponse>(
      { success: false, error: `更新失败: ${error.message}` },
      { status: 500 }
    );
  }

  return NextResponse.json<ApiResponse>({ success: true, data });
}

/**
 * DELETE /api/users/[id]
 * 删除用户（仅系统开发者可用）
 */
export async function DELETE(
  request: NextRequest,
  context: RouteContext
) {
  const user = getCurrentUser(request);
  if (!user) return unauthorized();

  if (user.role_code !== RoleCode.SYSTEM_DEVELOPER) {
    return NextResponse.json<ApiResponse>(
      { success: false, error: '仅系统开发者可删除账号' },
      { status: 403 }
    );
  }

  const { id } = await context.params;
  const supabase = getSupabaseClient();

  const { error } = await supabase
    .from('users')
    .delete()
    .eq('id', id);

  if (error) {
    return NextResponse.json<ApiResponse>(
      { success: false, error: `删除失败: ${error.message}` },
      { status: 500 }
    );
  }

  return NextResponse.json<ApiResponse>({ success: true, data: null });
}
