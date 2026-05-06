import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { getCurrentUser, requireRoles, checkCanteenAccess, CAN_MANAGE_CANTEEN, unauthorized } from '@/lib/auth/guard';
import type { ApiResponse } from '@/lib/auth/types';

/**
 * PUT /api/settings/fixed-expenses/[id]
 * 编辑固定支出。若金额改变，级联更新起止日期范围内的自动生成记录。
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
  const { name, amount, start_date, end_date } = body;

  const supabase = getSupabaseClient();

  // Check existing fixed expense
  const { data: existing, error: fetchError } = await supabase
    .from('fixed_expenses')
    .select('*')
    .eq('id', id)
    .single();

  if (fetchError || !existing) {
    return NextResponse.json<ApiResponse>({ success: false, error: '固定支出不存在' }, { status: 404 });
  }

  const access = await checkCanteenAccess(roleCheck.user, (existing as Record<string, unknown>).canteen_id as string);
  if (!access.ok) return access.response;

  const updateData: Record<string, unknown> = {};
  if (name !== undefined) updateData.type = name;
  if (amount !== undefined) updateData.amount = String(amount);
  if (start_date !== undefined) updateData.start_date = start_date;
  if (end_date !== undefined) updateData.end_date = end_date;

  const { data: updated, error: updateError } = await supabase
    .from('fixed_expenses')
    .update(updateData)
    .eq('id', id)
    .select()
    .single();

  if (updateError) {
    return NextResponse.json<ApiResponse>({ success: false, error: `更新失败: ${updateError.message}` }, { status: 500 });
  }

  // If amount or date range changed, cascade update auto-generated expense records
  const newName = (name !== undefined ? name : (existing as Record<string, unknown>).type) as string;
  const newAmount = Number(amount !== undefined ? amount : (existing as Record<string, unknown>).amount);
  const newStartDate = (start_date !== undefined ? start_date : (existing as Record<string, unknown>).start_date) as string;
  const newEndDate = (end_date !== undefined ? end_date : (existing as Record<string, unknown>).end_date) as string;

  if (amount !== undefined || start_date !== undefined || end_date !== undefined || name !== undefined) {
    // Delete old auto-generated records
    await supabase
      .from('expense_records')
      .delete()
      .eq('fixed_expense_id', id)
      .eq('is_auto_generated', true);

    // Regenerate records with new amount and date range
    const sDate = new Date(newStartDate + 'T00:00:00');
    const eDate = new Date(newEndDate + 'T00:00:00');
    const records: Record<string, unknown>[] = [];

    const current = new Date(sDate);
    while (current <= eDate) {
      const year = current.getFullYear();
      const month = current.getMonth();
      const daysInMonth = new Date(year, month + 1, 0).getDate();
      const dailyAmount = (newAmount / daysInMonth).toFixed(2);
      const dateStr = current.toISOString().slice(0, 10);

      records.push({
        canteen_id: (existing as Record<string, unknown>).canteen_id,
        expense_date: dateStr,
        category: newName,
        amount: dailyAmount,
        is_auto_generated: true,
        fixed_expense_id: id,
        created_by: roleCheck.user.user_id,
      });

      current.setDate(current.getDate() + 1);
    }

    if (records.length > 0) {
      const batchSize = 100;
      for (let i = 0; i < records.length; i += batchSize) {
        const batch = records.slice(i, i + batchSize);
        await supabase.from('expense_records').insert(batch);
      }
    }
  }

  return NextResponse.json<ApiResponse>({ success: true, data: updated });
}

/**
 * DELETE /api/settings/fixed-expenses/[id]
 * 删除固定支出，同时删除对应的自动生成支出记录
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

  const { data: existing, error: fetchError } = await supabase
    .from('fixed_expenses')
    .select('canteen_id')
    .eq('id', id)
    .single();

  if (fetchError || !existing) {
    return NextResponse.json<ApiResponse>({ success: false, error: '固定支出不存在' }, { status: 404 });
  }

  const access = await checkCanteenAccess(roleCheck.user, (existing as Record<string, unknown>).canteen_id as string);
  if (!access.ok) return access.response;

  // Delete auto-generated expense records first
  await supabase
    .from('expense_records')
    .delete()
    .eq('fixed_expense_id', id)
    .eq('is_auto_generated', true);

  // Soft delete fixed expense
  const { error } = await supabase
    .from('fixed_expenses')
    .update({ is_active: false })
    .eq('id', id);

  if (error) {
    return NextResponse.json<ApiResponse>({ success: false, error: `删除失败: ${error.message}` }, { status: 500 });
  }

  return NextResponse.json<ApiResponse>({ success: true, data: null });
}
