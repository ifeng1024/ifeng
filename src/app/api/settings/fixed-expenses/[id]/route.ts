import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { getCurrentUser, requireRoles, checkCanteenAccess, CAN_MANAGE_CANTEEN, unauthorized } from '@/lib/auth/guard';
import type { ApiResponse } from '@/lib/auth/types';

/**
 * PUT /api/settings/fixed-expenses/[id]
 * 编辑固定支出（修改金额时同步更新日期范围内已自动生成的支出记录）
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = getCurrentUser(request);
  if (!user) return unauthorized();

  const roleCheck = requireRoles(user, CAN_MANAGE_CANTEEN);
  if (!roleCheck.ok) return roleCheck.response;

  const { id } = await params;
  const body = (await request.json()) as Record<string, unknown>;
  const { category, amount, note, start_date, end_date } = body;

  const supabase = getSupabaseClient();

  // 查找原记录
  const { data: existing } = await supabase
    .from('fixed_expenses')
    .select('*')
    .eq('id', id)
    .eq('is_active', true)
    .single();

  if (!existing) return NextResponse.json<ApiResponse>({ success: false, error: '记录不存在' }, { status: 404 });

  const access = await checkCanteenAccess(roleCheck.user, (existing as Record<string, unknown>).canteen_id as string);
  if (!access.ok) return access.response;

  const newAmount = amount !== undefined ? String(amount) : (existing as Record<string, unknown>).amount as string;
  const newCategory = (category as string) || ((existing as Record<string, unknown>).category as string);
  const newStartDate = (start_date as string) || ((existing as Record<string, unknown>).start_date as string);
  const newEndDate = (end_date as string) || ((existing as Record<string, unknown>).end_date as string) || null;

  // 更新固定支出记录
  const { data, error } = await supabase
    .from('fixed_expenses')
    .update({
      category: newCategory,
      amount: newAmount,
      note: note !== undefined ? ((note as string) || null) : (existing as Record<string, unknown>).note as string | null,
      start_date: newStartDate,
      end_date: newEndDate,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single();

  if (error) return NextResponse.json<ApiResponse>({ success: false, error: error.message }, { status: 500 });

  // 如果金额发生变化，且存在日期范围，则同步更新该范围内已自动生成的支出记录
  if (amount !== undefined && String(amount) !== (existing as Record<string, unknown>).amount && newStartDate) {
    const updateQuery = supabase
      .from('expense_records')
      .update({
        amount: newAmount,
        updated_at: new Date().toISOString(),
      })
      .eq('fixed_expense_id', id)
      .eq('is_auto_generated', true)
      .gte('expense_date', newStartDate);

    if (newEndDate) {
      void updateQuery.lte('expense_date', newEndDate);
    }
    await updateQuery;
  }

  return NextResponse.json<ApiResponse>({ success: true, data });
}

/**
 * DELETE /api/settings/fixed-expenses/[id]
 * 软删除固定支出
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = getCurrentUser(request);
  if (!user) return unauthorized();

  const roleCheck = requireRoles(user, CAN_MANAGE_CANTEEN);
  if (!roleCheck.ok) return roleCheck.response;

  const { id } = await params;
  const supabase = getSupabaseClient();

  const { error } = await supabase
    .from('fixed_expenses')
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq('id', id);

  if (error) return NextResponse.json<ApiResponse>({ success: false, error: error.message }, { status: 500 });
  return NextResponse.json<ApiResponse>({ success: true });
}
