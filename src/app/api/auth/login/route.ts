import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { comparePassword } from '@/lib/auth/password';
import { signToken } from '@/lib/auth/jwt';
import type { LoginRequest, LoginResponse, DbUser } from '@/lib/auth/types';
import { RoleCode } from '@/lib/auth/constants';

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

    // 查找用户（包含有效期和禁用状态）
    const { data: users, error } = await client
      .from('users')
      .select('id, username, password_hash, real_name, role_code, org_id, is_active, is_disabled, expires_at')
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

    // 检查账号是否被禁用
    if (user.is_disabled) {
      return NextResponse.json<LoginResponse>(
        { success: false, error: '账号已被禁用，请联系管理员' },
        { status: 403 }
      );
    }

    // 检查账号状态
    if (!user.is_active) {
      return NextResponse.json<LoginResponse>(
        { success: false, error: '账号已被停用' },
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

    // 校验账号有效期
    const expiryCheck = await checkAccountExpiry(client, user);
    if (!expiryCheck.valid) {
      return NextResponse.json<LoginResponse>(
        { success: false, error: expiryCheck.message! },
        { status: 403 }
      );
    }

    // 签发 JWT
    const token = signToken({
      user_id: user.id,
      username: user.username,
      role_code: user.role_code,
      org_id: user.org_id,
    });

    // 记录登录日志
    await logOperation(client, {
      user_id: user.id,
      username: user.username,
      action: 'LOGIN',
      detail: JSON.stringify({ role_code: user.role_code }),
      ip: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
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

/**
 * 校验账号有效期
 * - 系统开发者永不过期
 * - 公司负责人：检查自身 expires_at + company_params.account_expires_at
 * - 食堂/档口负责人：级联继承公司有效期
 */
async function checkAccountExpiry(
  client: ReturnType<typeof getSupabaseClient>,
  user: DbUser
): Promise<{ valid: boolean; message?: string }> {
  // 系统开发者永不过期
  if (user.role_code === RoleCode.SYSTEM_DEVELOPER) {
    return { valid: true };
  }

  const now = new Date();

  // 1. 检查用户自身的 expires_at
  if (user.expires_at && new Date(user.expires_at) < now) {
    return { valid: false, message: '账号已过期，请联系开发者' };
  }

  // 2. 对于公司负责人，检查 company_params 的有效期
  if (user.role_code === RoleCode.COMPANY_MANAGER && user.org_id) {
    const { data: params } = await client
      .from('company_params')
      .select('account_expires_at')
      .eq('company_id', user.org_id)
      .maybeSingle();
    if (params?.account_expires_at && new Date(params.account_expires_at) < now) {
      return { valid: false, message: '账号已过期，请联系开发者' };
    }
  }

  // 3. 对于食堂/档口负责人，级联查公司有效期
  if (user.role_code === RoleCode.CANTEEN_MANAGER && user.org_id) {
    const { data: canteen } = await client
      .from('canteens')
      .select('company_id')
      .eq('id', user.org_id)
      .maybeSingle();
    if (canteen?.company_id) {
      const { data: params } = await client
        .from('company_params')
        .select('account_expires_at')
        .eq('company_id', canteen.company_id)
        .maybeSingle();
      if (params?.account_expires_at && new Date(params.account_expires_at) < now) {
        return { valid: false, message: '账号已过期，请联系开发者' };
      }
    }
  }

  if (user.role_code === RoleCode.STALL_MANAGER && user.org_id) {
    const { data: stall } = await client
      .from('stalls')
      .select('canteen_id')
      .eq('id', user.org_id)
      .maybeSingle();
    if (stall?.canteen_id) {
      const { data: canteen } = await client
        .from('canteens')
        .select('company_id')
        .eq('id', stall.canteen_id)
        .maybeSingle();
      if (canteen?.company_id) {
        const { data: params } = await client
          .from('company_params')
          .select('account_expires_at')
          .eq('company_id', canteen.company_id)
          .maybeSingle();
        if (params?.account_expires_at && new Date(params.account_expires_at) < now) {
          return { valid: false, message: '账号已过期，请联系开发者' };
        }
      }
    }
  }

  return { valid: true };
}

/**
 * 记录操作日志
 */
async function logOperation(
  client: ReturnType<typeof getSupabaseClient>,
  log: {
    user_id: string;
    username: string;
    action: string;
    detail: string;
    ip: string;
  }
) {
  try {
    await client.from('operation_logs').insert({
      user_id: log.user_id,
      username: log.username,
      action: log.action,
      detail: log.detail,
      ip: log.ip,
    });
  } catch {
    // 日志写入失败不影响主流程
  }
}
