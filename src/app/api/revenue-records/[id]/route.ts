import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { getCurrentUser, requireRoles, checkCanteenAccess, forbidden } from '@/lib/auth/guard';
import { RoleCode } from '@/lib/auth/constants';

const CAN_RECORD_REVENUE = [RoleCode.SYSTEM_DEVELOPER, RoleCode.COMPANY_MANAGER, RoleCode.CANTEEN_MANAGER, RoleCode.STALL_MANAGER];

/** 更新营收记录 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = getCurrentUser(request);
  const roleCheck = requireRoles(user, CAN_RECORD_REVENUE);
  if (!roleCheck.ok) return roleCheck.response;

  try {
    const { id } = await params;
    const body = await request.json();
    const client = getSupabaseClient();

    // 查询原记录
    const { data: record, error: findError } = await client
      .from('revenue_records')
      .select('id, canteen_id, stall_id')
      .eq('id', id)
      .eq('is_active', true)
      .maybeSingle();

    if (findError || !record) {
      return NextResponse.json({ success: false, error: '记录不存在' }, { status: 404 });
    }

    // 权限校验
    const canteenCheck = await checkCanteenAccess(roleCheck.user, record.canteen_id);
    if (!canteenCheck.ok) return canteenCheck.response;

    if (roleCheck.user.role_code === RoleCode.STALL_MANAGER && roleCheck.user.org_id !== record.stall_id) {
      return forbidden('只能修改自己档口的数据');
    }
    if (roleCheck.user.role_code === RoleCode.CANTEEN_MANAGER && roleCheck.user.org_id !== record.canteen_id) {
      return forbidden('只能修改自己食堂的数据');
    }

    const updateFields: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (body.order_count !== undefined) updateFields.order_count = body.order_count;
    if (body.amount !== undefined) updateFields.amount = String(body.amount);
    if (body.note !== undefined) updateFields.note = body.note || null;
    if (body.meal_type_id !== undefined) updateFields.meal_type_id = body.meal_type_id || null;
    if (body.revenue_type_id !== undefined) updateFields.revenue_type_id = body.revenue_type_id || null;

    const { data, error } = await client
      .from('revenue_records')
      .update(updateFields)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ success: false, error: `更新失败: ${error.message}` }, { status: 500 });
    }
    return NextResponse.json({ success: true, data });
  } catch (err) {
    const message = err instanceof Error ? err.message : '更新失败';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

/** 删除营收记录（软删除） */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = getCurrentUser(request);
  const roleCheck = requireRoles(user, [RoleCode.SYSTEM_DEVELOPER, RoleCode.COMPANY_MANAGER, RoleCode.CANTEEN_MANAGER]);
  if (!roleCheck.ok) return roleCheck.response;

  try {
    const { id } = await params;
    const client = getSupabaseClient();

    const { data: record } = await client
      .from('revenue_records')
      .select('canteen_id, stall_id')
      .eq('id', id)
      .eq('is_active', true)
      .maybeSingle();

    if (!record) {
      return NextResponse.json({ success: false, error: '记录不存在' }, { status: 404 });
    }

    const canteenCheck = await checkCanteenAccess(roleCheck.user, record.canteen_id);
    if (!canteenCheck.ok) return canteenCheck.response;

    const { error } = await client
      .from('revenue_records')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('id', id);

    if (error) {
      return NextResponse.json({ success: false, error: `删除失败: ${error.message}` }, { status: 500 });
    }
    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : '删除失败';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
