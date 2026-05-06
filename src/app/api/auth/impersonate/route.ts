import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { getCurrentUser, unauthorized } from '@/lib/auth/guard';
import { RoleCode } from '@/lib/auth/constants';
import { signToken } from '@/lib/auth/jwt';
import type { ApiResponse } from '@/lib/auth/types';

/**
 * POST /api/auth/impersonate
 * 系统开发者以某公司负责人身份登录（跳转）
 */
export async function POST(request: NextRequest) {
  const currentUser = getCurrentUser(request);
  if (!currentUser) return unauthorized();

  if (currentUser.role_code !== RoleCode.SYSTEM_DEVELOPER) {
    return NextResponse.json<ApiResponse>(
      { success: false, error: '仅系统开发者可使用此功能' },
      { status: 403 }
    );
  }

  try {
    const body = (await request.json()) as { user_id: string };
    if (!body.user_id) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: '缺少用户ID' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseClient();
    const { data: targetUser, error } = await supabase
      .from('users')
      .select('id, username, role_code, org_id, is_disabled, expires_at')
      .eq('id', body.user_id)
      .single();

    if (error || !targetUser) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: '目标用户不存在' },
        { status: 404 }
      );
    }

    if (targetUser.role_code !== RoleCode.COMPANY_MANAGER) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: '只能以公司负责人身份跳转' },
        { status: 403 }
      );
    }

    if (targetUser.is_disabled) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: '目标账号已被禁用' },
        { status: 403 }
      );
    }

    if (targetUser.expires_at && new Date(targetUser.expires_at) < new Date()) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: '目标账号已过期' },
        { status: 403 }
      );
    }

    // Generate a new token for the target user
    const token = signToken({
      user_id: targetUser.id,
      username: targetUser.username,
      role_code: targetUser.role_code,
      org_id: targetUser.org_id,
    });

    return NextResponse.json<ApiResponse>({
      success: true,
      data: { token, user: { id: targetUser.id, username: targetUser.username, role_code: targetUser.role_code, org_id: targetUser.org_id } },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : '跳转失败';
    return NextResponse.json<ApiResponse>(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
