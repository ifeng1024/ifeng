import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { getCurrentUser, requireRoles, checkCanteenAccess, CAN_ENTER_EXPENSE, unauthorized } from '@/lib/auth/guard';
import type { ApiResponse } from '@/lib/auth/types';

/**
 * PUT /api/expense-records/[id]
 * 编辑支出记录
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = getCurrentUser(request);
  if (!user) return unauthorized();

  const roleCheck = requireRoles(user, CAN_ENTER_EXPENSE);
  if (!roleCheck.ok) return roleCheck.response;

  const { id } = await params;
  const body = (await request.json()) as Record<string, unknown>;
  const {
    canteen_id, expense_date, category, amount, note,
    product_category_id, product_id, quantity, unit_price, product_spec_id,
  } = body;

  const supabase = getSupabaseClient();

  const { data: existing } = await supabase
    .from('expense_records')
    .select('*')
    .eq('id', id)
    .eq('is_active', true)
    .single();

  if (!existing) return NextResponse.json<ApiResponse>({ success: false, error: '记录不存在' }, { status: 404 });

  const existingRec = existing as Record<string, unknown>;

  const cId = (canteen_id as string) || (existingRec.canteen_id as string);
  const access = await checkCanteenAccess(roleCheck.user, cId);
  if (!access.ok) return access.response;

  const updateData: Record<string, unknown> = {
    ...(canteen_id !== undefined && { canteen_id: canteen_id as string }),
    ...(expense_date !== undefined && { expense_date: expense_date as string }),
    ...(category !== undefined && { category: category as string }),
    ...(amount !== undefined && { amount: String(amount) }),
    ...(note !== undefined && { note: (note as string) || null }),
    updated_at: new Date().toISOString(),
  };

  const effectiveCategory = (category as string) || (existingRec.category as string);
  if (effectiveCategory === '食材采购') {
    updateData.product_category_id = (product_category_id as string) || null;
    updateData.product_id = (product_id as string) || null;
    updateData.quantity = quantity !== undefined ? String(quantity) : null;
    updateData.unit_price = unit_price !== undefined ? String(unit_price) : null;
    updateData.product_spec_id = (product_spec_id as string) || null;
  } else {
    updateData.product_category_id = null;
    updateData.product_id = null;
    updateData.quantity = null;
    updateData.unit_price = null;
    updateData.product_spec_id = null;
  }

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

  const roleCheck = requireRoles(user, CAN_ENTER_EXPENSE);
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
  const access = await checkCanteenAccess(roleCheck.user, existingRec.canteen_id as string);
  if (!access.ok) return access.response;

  const { error } = await supabase
    .from('expense_records')
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq('id', id);

  if (error) return NextResponse.json<ApiResponse>({ success: false, error: error.message }, { status: 500 });
  return NextResponse.json<ApiResponse>({ success: true });
}
