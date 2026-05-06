import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { getCurrentUser, requireRoles } from '@/lib/auth/guard';
import { RoleCode } from '@/lib/auth/constants';

/** 禁用/启用用户 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const user = getCurrentUser(request);
  // 只有开发者可以禁用公司负责人；公司负责人可以管理下属
  const roleCheck = requireRoles(user, [RoleCode.SYSTEM_DEVELOPER, RoleCode.COMPANY_MANAGER]);
  if (!roleCheck.ok) return roleCheck.response;

  try {
    const { userId } = await params;
    const body = await request.json();
    const is_disabled = body.is_disabled === true;
    const client = getSupabaseClient();

    const { data: targetUser, error: findError } = await client
      .from('users')
      .select('id, role_code, org_id')
      .eq('id', userId)
      .maybeSingle();

    if (findError || !targetUser) {
      return NextResponse.json({ success: false, error: '用户不存在' }, { status: 404 });
    }

    // 公司负责人只能管理自己公司下的用户
    if (roleCheck.user.role_code === RoleCode.COMPANY_MANAGER) {
      if (targetUser.role_code === RoleCode.SYSTEM_DEVELOPER || targetUser.role_code === RoleCode.COMPANY_MANAGER) {
        return NextResponse.json({ success: false, error: '权限不足' }, { status: 403 });
      }
      // 校验目标用户是否属于本公司
      if (targetUser.role_code === RoleCode.CANTEEN_MANAGER && targetUser.org_id) {
        const { data: canteen } = await client
          .from('canteens')
          .select('company_id')
          .eq('id', targetUser.org_id)
          .maybeSingle();
        if (!canteen || canteen.company_id !== roleCheck.user.org_id) {
          return NextResponse.json({ success: false, error: '权限不足' }, { status: 403 });
        }
      }
      if (targetUser.role_code === RoleCode.STALL_MANAGER && targetUser.org_id) {
        const { data: stall } = await client
          .from('stalls')
          .select('canteen_id')
          .eq('id', targetUser.org_id)
          .maybeSingle();
        if (stall) {
          const { data: canteen } = await client
            .from('canteens')
            .select('company_id')
            .eq('id', stall.canteen_id)
            .maybeSingle();
          if (!canteen || canteen.company_id !== roleCheck.user.org_id) {
            return NextResponse.json({ success: false, error: '权限不足' }, { status: 403 });
          }
        }
      }
    }

    const { data, error } = await client
      .from('users')
      .update({ is_disabled, updated_at: new Date().toISOString() })
      .eq('id', userId)
      .select('id, username, is_disabled')
      .single();

    if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    return NextResponse.json({ success: true, data });
  } catch (err) {
    const message = err instanceof Error ? err.message : '操作失败';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
