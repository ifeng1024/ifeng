import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { getCurrentUser, requireRoles, checkCanteenAccess, checkStallAccess, CAN_ENTER_REVENUE, unauthorized } from '@/lib/auth/guard';
import type { ApiResponse } from '@/lib/auth/types';

/**
 * PUT /api/revenue-records/[id]
 * 编辑营收记录
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = getCurrentUser(request);
  if (!user) return unauthorized();

  const roleCheck = requireRoles(user, CAN_ENTER_REVENUE);
  if (!roleCheck.ok) return roleCheck.response;

  const { id } = await params;
  const body = (await request.json()) as Record<string, unknown>;
  const { canteen_id, stall_id, meal_type_id, record_date, order_count, amount, note } = body;

  if (!meal_type_id) {
    return NextResponse.json<ApiResponse>({ success: false, error: '餐别为必填项' }, { status: 400 });
  }

  const supabase = getSupabaseClient();

  // 查找原记录
  const { data: existing, error: findErr } = await supabase
    .from('revenue_records')
    .select('*')
    .eq('id', id)
    .eq('is_active', true)
    .single();

  if (findErr || !existing) {
    return NextResponse.json<ApiResponse>({ success: false, error: '记录不存在' }, { status: 404 });
  }

  const existingRec = existing as Record<string, unknown>;

  // 档口负责人只能编辑自己档口的记录
  if (roleCheck.user.role_code === 'STALL_MANAGER' && existingRec.stall_id !== roleCheck.user.org_id) {
    return NextResponse.json<ApiResponse>({ success: false, error: '只能编辑自己档口的记录' }, { status: 403 });
  }

  // 权限校验
  const cId = (canteen_id as string) || (existingRec.canteen_id as string);
  const canteenAccess = await checkCanteenAccess(roleCheck.user, cId);
  if (!canteenAccess.ok) return canteenAccess.response;

  const sId = (stall_id as string) || (existingRec.stall_id as string);
  const stallAccess = await checkStallAccess(roleCheck.user, sId);
  if (!stallAccess.ok) return stallAccess.response;

  const { data, error } = await supabase
    .from('revenue_records')
    .update({
      ...(canteen_id !== undefined && { canteen_id: canteen_id as string }),
      ...(stall_id !== undefined && { stall_id: stall_id as string }),
      ...(meal_type_id !== undefined && { meal_type_id: meal_type_id as string }),
      ...(record_date !== undefined && { record_date: record_date as string }),
      ...(order_count !== undefined && { order_count: order_count as number }),
      ...(amount !== undefined && { amount: String(amount) }),
      ...(note !== undefined && { note: (note as string) || null }),
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single();

  if (error) return NextResponse.json<ApiResponse>({ success: false, error: error.message }, { status: 500 });
  return NextResponse.json<ApiResponse>({ success: true, data });
}

/**
 * DELETE /api/revenue-records/[id]
 * 软删除营收记录
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = getCurrentUser(request);
  if (!user) return unauthorized();

  const roleCheck = requireRoles(user, CAN_ENTER_REVENUE);
  if (!roleCheck.ok) return roleCheck.response;

  const { id } = await params;
  const supabase = getSupabaseClient();

  const { data: existing } = await supabase
    .from('revenue_records')
    .select('canteen_id, stall_id')
    .eq('id', id)
    .eq('is_active', true)
    .single();

  if (!existing) return NextResponse.json<ApiResponse>({ success: false, error: '记录不存在' }, { status: 404 });

  const existingRec = existing as Record<string, unknown>;

  // 档口负责人只能删除自己档口的记录
  if (roleCheck.user.role_code === 'STALL_MANAGER' && existingRec.stall_id !== roleCheck.user.org_id) {
    return NextResponse.json<ApiResponse>({ success: false, error: '只能删除自己档口的记录' }, { status: 403 });
  }

  // 权限校验
  const canteenAccess = await checkCanteenAccess(roleCheck.user, existingRec.canteen_id as string);
  if (!canteenAccess.ok) return canteenAccess.response;

  const stallAccess = await checkStallAccess(roleCheck.user, existingRec.stall_id as string);
  if (!stallAccess.ok) return stallAccess.response;

  const { error } = await supabase
    .from('revenue_records')
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq('id', id);

  if (error) return NextResponse.json<ApiResponse>({ success: false, error: error.message }, { status: 500 });
  return NextResponse.json<ApiResponse>({ success: true });
}
