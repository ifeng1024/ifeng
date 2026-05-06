import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { getCurrentUser, requireRoles } from '@/lib/auth/guard';
import { hashPassword } from '@/lib/auth/password';
import { RoleCode, DEFAULT_PASSWORD } from '@/lib/auth/constants';

/** 重置用户密码 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const user = getCurrentUser(request);
  const roleCheck = requireRoles(user, [RoleCode.SYSTEM_DEVELOPER, RoleCode.COMPANY_MANAGER]);
  if (!roleCheck.ok) return roleCheck.response;

  try {
    const { userId } = await params;
    const client = getSupabaseClient();

    const { data: targetUser } = await client
      .from('users')
      .select('id, role_code')
      .eq('id', userId)
      .maybeSingle();

    if (!targetUser) {
      return NextResponse.json({ success: false, error: '用户不存在' }, { status: 404 });
    }

    // 公司负责人只能重置本公司下属用户密码
    if (roleCheck.user.role_code === RoleCode.COMPANY_MANAGER) {
      if (targetUser.role_code === RoleCode.SYSTEM_DEVELOPER || targetUser.role_code === RoleCode.COMPANY_MANAGER) {
        return NextResponse.json({ success: false, error: '权限不足' }, { status: 403 });
      }
    }

    const newPassword = DEFAULT_PASSWORD;
    const password_hash = await hashPassword(newPassword);

    const { error } = await client
      .from('users')
      .update({ password_hash, updated_at: new Date().toISOString() })
      .eq('id', userId);

    if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    return NextResponse.json({ success: true, data: { new_password: newPassword } });
  } catch (err) {
    const message = err instanceof Error ? err.message : '重置失败';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
