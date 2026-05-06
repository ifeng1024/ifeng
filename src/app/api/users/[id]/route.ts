import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { getCurrentUser, requireMinRole, unauthorized } from '@/lib/auth/guard';
import { hashPassword } from '@/lib/auth/password';
import { RoleCode, RoleLevel } from '@/lib/auth/constants';
import type { ApiResponse } from '@/lib/auth/types';

/**
 * PUT /api/users/[id]
 * 编辑用户信息（real_name, phone, email, org_id, is_disabled, expires_at, password）
 * - SYSTEM_DEVELOPER: 可编辑所有字段含 expires_at
 * - COMPANY_MANAGER / CANTEEN_MANAGER: 可编辑自己下属的基本信息
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const currentUser = getCurrentUser(request);
  if (!currentUser) return unauthorized();

  const minRoleCheck = requireMinRole(currentUser, RoleLevel.CANTEEN_MANAGER);
  if (!minRoleCheck.ok) return minRoleCheck.response;

  const { id } = await params;

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const supabase = getSupabaseClient();

    // Check target user exists
    const { data: targetUser, error: fetchError } = await supabase
      .from('users')
      .select('id, role_code, org_id')
      .eq('id', id)
      .single();

    if (fetchError || !targetUser) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: '用户不存在' },
        { status: 404 }
      );
    }

    // Build update data
    const updateData: Record<string, unknown> = {};
    
    if (body.real_name !== undefined) updateData.real_name = body.real_name;
    if (body.phone !== undefined) updateData.phone = body.phone || null;
    if (body.email !== undefined) updateData.email = body.email || null;
    if (body.org_id !== undefined) updateData.org_id = body.org_id || null;
    
    // Only SYSTEM_DEVELOPER can set is_disabled and expires_at
    if (currentUser.role_code === RoleCode.SYSTEM_DEVELOPER) {
      if (body.is_disabled !== undefined) updateData.is_disabled = body.is_disabled;
      if (body.expires_at !== undefined) updateData.expires_at = body.expires_at || null;
    }

    // Password change
    if (body.password) {
      updateData.password_hash = await hashPassword(body.password as string);
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: '没有需要更新的字段' },
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
  } catch (err) {
    const message = err instanceof Error ? err.message : '更新失败';
    return NextResponse.json<ApiResponse>(
      { success: false, error: message },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/users/[id]
 * 禁用用户（软删除）
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const currentUser = getCurrentUser(request);
  if (!currentUser) return unauthorized();

  if (currentUser.role_code !== RoleCode.SYSTEM_DEVELOPER) {
    return NextResponse.json<ApiResponse>(
      { success: false, error: '仅系统开发者可禁用用户' },
      { status: 403 }
    );
  }

  const { id } = await params;

  try {
    const supabase = getSupabaseClient();
    const { error } = await supabase
      .from('users')
      .update({ is_disabled: true })
      .eq('id', id);

    if (error) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: `禁用失败: ${error.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json<ApiResponse>({ success: true, data: null });
  } catch (err) {
    const message = err instanceof Error ? err.message : '禁用失败';
    return NextResponse.json<ApiResponse>(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
