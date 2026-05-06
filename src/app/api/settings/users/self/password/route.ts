import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { getCurrentUser, unauthorized } from '@/lib/auth/guard';
import { comparePassword, hashPassword } from '@/lib/auth/password';
import type { ApiResponse } from '@/lib/auth/types';

/**
 * PUT /api/settings/users/self/password
 * 当前登录用户修改自己的密码
 */
export async function PUT(request: NextRequest) {
  const currentUser = getCurrentUser(request);
  if (!currentUser) return unauthorized();

  try {
    const body = (await request.json()) as { old_password?: string; new_password?: string };
    if (!body.old_password || !body.new_password) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: '旧密码和新密码不能为空' },
        { status: 400 }
      );
    }

    if (body.new_password.length < 6) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: '新密码长度不能少于6位' },
        { status: 400 }
      );
    }

    const client = getSupabaseClient();

    // 查询当前用户的密码哈希
    const { data: user, error: userError } = await client
      .from('users')
      .select('id, password_hash')
      .eq('id', currentUser.user_id)
      .maybeSingle();

    if (userError || !user) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: '用户不存在' },
        { status: 404 }
      );
    }

    // 验证旧密码
    const isValid = await comparePassword(body.old_password, user.password_hash);
    if (!isValid) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: '旧密码不正确' },
        { status: 400 }
      );
    }

    // 生成新密码哈希
    const newHash = await hashPassword(body.new_password);
    const { error: updateError } = await client
      .from('users')
      .update({ password_hash: newHash })
      .eq('id', currentUser.user_id);

    if (updateError) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: `密码修改失败: ${updateError.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json<ApiResponse>({ success: true, data: { message: '密码修改成功' } });
  } catch (err) {
    const message = err instanceof Error ? err.message : '密码修改失败';
    return NextResponse.json<ApiResponse>({ success: false, error: message }, { status: 500 });
  }
}
