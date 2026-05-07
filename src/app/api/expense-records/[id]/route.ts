import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { getCurrentUser, requireRoles, checkCanteenAccess, CAN_MANAGE_EXPENSE, unauthorized } from '@/lib/auth/guard';
import type { ApiResponse } from '@/lib/auth/types';

/**
 * PUT /api/expense-records/[id]
 * 编辑支出记录
 * 如果记录属于 repeat_group，同步更新同组所有记录
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = getCurrentUser(request);
  if (!user) return unauthorized();

  const roleCheck = requireRoles(user, CAN_MANAGE_EXPENSE);
  if (!roleCheck.ok) return roleCheck.response;

  const { id } = await params;
  const body = (await request.json()) as Record<string, unknown>;
  const {
    canteen_id, expense_date, category, amount, note, stall_id, supplier_id,
    product_category_id, product_id, quantity, unit_price, product_spec_id,
  } = body;

  const supabase = getSupabaseClient();

  const { data: existing } = await supabase
    .from('expense_records')
    .select('*')
    .eq('id', id)
    .eq('is_active', true)
    .single();

  if (!existing) {
    return NextResponse.json<ApiResponse>({ success: false, error: '记录不存在' }, { status: 404 });
  }

  const existingRec = existing as Record<string, unknown>;

  // 权限校验
  const cId = (canteen_id as string) || (existingRec.canteen_id as string);
  const canteenAccess = await checkCanteenAccess(roleCheck.user, cId);
  if (!canteenAccess.ok) return canteenAccess.response;

  const updateData: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  if (category !== undefined) updateData.category = category as string;
  if (amount !== undefined) updateData.amount = String(amount);
  if (note !== undefined) updateData.note = (note as string) || null;
  if (stall_id !== undefined) updateData.stall_id = (stall_id as string) || null;
  if (supplier_id !== undefined) updateData.supplier_id = (supplier_id as string) || null;

  if ((category as string) === '食材采购' || (existingRec.category as string) === '食材采购') {
    if (product_category_id !== undefined) updateData.product_category_id = product_category_id as string;
    if (product_id !== undefined) updateData.product_id = product_id as string;
    if (quantity !== undefined) updateData.quantity = String(quantity);
    if (unit_price !== undefined) updateData.unit_price = String(unit_price);
    if (product_spec_id !== undefined) updateData.product_spec_id = product_spec_id as string;
  }

  // If this record has a repeat_group_id, update all records in the same group
  const repeatGroupId = existingRec.repeat_group_id as string | null;
  if (repeatGroupId && (amount !== undefined || category !== undefined || note !== undefined || stall_id !== undefined)) {
    const { error } = await supabase
      .from('expense_records')
      .update(updateData)
      .eq('repeat_group_id', repeatGroupId)
      .eq('is_active', true);

    if (error) return NextResponse.json<ApiResponse>({ success: false, error: error.message }, { status: 500 });
    return NextResponse.json<ApiResponse>({ success: true, data: { id, synced: true } });
  }

  // Normal update for non-repeating records
  const { data, error } = await supabase
    .from('expense_records')
    .update(updateData)
    .eq('id', id)
    .select()
    .single();

  if (error) return NextResponse.json<ApiResponse>({ success: false, error: error.message }, { status: 500 });
  return NextResponse.json<ApiResponse>({ success: true, data });
}

/**
 * DELETE /api/expense-records/[id]
 * 软删除支出记录
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = getCurrentUser(request);
  if (!user) return unauthorized();

  const roleCheck = requireRoles(user, CAN_MANAGE_EXPENSE);
  if (!roleCheck.ok) return roleCheck.response;

  const { id } = await params;
  const supabase = getSupabaseClient();

  const { data: existing } = await supabase
    .from('expense_records')
    .select('canteen_id')
    .eq('id', id)
    .eq('is_active', true)
    .single();

  if (!existing) return NextResponse.json<ApiResponse>({ success: false, error: '记录不存在' }, { status: 404 });

  const existingRec = existing as Record<string, unknown>;

  // 权限校验
  const canteenAccess = await checkCanteenAccess(roleCheck.user, existingRec.canteen_id as string);
  if (!canteenAccess.ok) return canteenAccess.response;

  const { error } = await supabase
    .from('expense_records')
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq('id', id);

  if (error) return NextResponse.json<ApiResponse>({ success: false, error: error.message }, { status: 500 });
  return NextResponse.json<ApiResponse>({ success: true, data: null });
}
