import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { comparePassword } from '@/lib/auth/password';
import { signToken } from '@/lib/auth/jwt';
import type { LoginRequest, LoginResponse, DbUser } from '@/lib/auth/types';
import { RoleLabel } from '@/lib/auth/constants';

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as LoginRequest;

    if (!body.username || !body.password) {
      return NextResponse.json<LoginResponse>(
        { success: false, error: '用户名和密码不能为空' },
        { status: 400 }
      );
    }

    const client = getSupabaseClient();

    // 查找用户
    const { data: users, error } = await client
      .from('users')
      .select('id, username, password_hash, real_name, role_code, org_id, is_active')
      .eq('username', body.username)
      .limit(1);

    if (error) {
      return NextResponse.json<LoginResponse>(
        { success: false, error: `查询失败: ${error.message}` },
        { status: 500 }
      );
    }

    const user = (users as DbUser[])?.[0];
    if (!user) {
      return NextResponse.json<LoginResponse>(
        { success: false, error: '用户名或密码错误' },
        { status: 401 }
      );
    }

    // 检查账号状态
    if (!user.is_active) {
      return NextResponse.json<LoginResponse>(
        { success: false, error: '账号已被禁用' },
        { status: 403 }
      );
    }

    // 校验密码
    const passwordValid = await comparePassword(body.password, user.password_hash);
    if (!passwordValid) {
      return NextResponse.json<LoginResponse>(
        { success: false, error: '用户名或密码错误' },
        { status: 401 }
      );
    }

    // 签发 JWT
    const token = signToken({
      user_id: user.id,
      username: user.username,
      role_code: user.role_code,
      org_id: user.org_id,
    });

    return NextResponse.json<LoginResponse>({
      success: true,
      data: {
        token,
        user: {
          id: user.id,
          username: user.username,
          real_name: user.real_name,
          role_code: user.role_code,
          org_id: user.org_id,
        },
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : '登录失败';
    return NextResponse.json<LoginResponse>(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
