import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { getCurrentUser, requireRoles, checkCanteenAccess, CAN_MANAGE_CANTEEN, unauthorized } from '@/lib/auth/guard';
import type { ApiResponse } from '@/lib/auth/types';

/**
 * GET /api/settings/fixed-expenses?canteen_id=xxx
 */
export async function GET(request: NextRequest) {
  const user = getCurrentUser(request);
  if (!user) return unauthorized();

  const roleCheck = requireRoles(user, CAN_MANAGE_CANTEEN);
  if (!roleCheck.ok) return roleCheck.response;

  const { searchParams } = new URL(request.url);
  const canteenId = searchParams.get('canteen_id');
  if (!canteenId) {
    return NextResponse.json<ApiResponse>({ success: false, error: '缺少食堂ID' }, { status: 400 });
  }

  const access = await checkCanteenAccess(roleCheck.user, canteenId);
  if (!access.ok) return access.response;

  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('fixed_expenses')
    .select('*')
    .eq('canteen_id', canteenId)
    .eq('is_active', true)
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json<ApiResponse>({ success: false, error: error.message }, { status: 500 });
  return NextResponse.json<ApiResponse>({ success: true, data });
}

/**
 * POST /api/settings/fixed-expenses
 * 创建固定支出，自动在起止日期范围内生成支出记录（每日金额 = 月金额 / 当月天数）
 */
export async function POST(request: NextRequest) {
  const user = getCurrentUser(request);
  if (!user) return unauthorized();

  const roleCheck = requireRoles(user, CAN_MANAGE_CANTEEN);
  if (!roleCheck.ok) return roleCheck.response;

  const body = (await request.json()) as Record<string, unknown>;
  const { canteen_id, name, amount, start_date, end_date } = body;

  if (!canteen_id || !name || amount === undefined || !start_date || !end_date) {
    return NextResponse.json<ApiResponse>(
      { success: false, error: '食堂、费用名称、金额、起止日期为必填项' },
      { status: 400 }
    );
  }

  const access = await checkCanteenAccess(roleCheck.user, canteen_id as string);
  if (!access.ok) return access.response;

  const supabase = getSupabaseClient();

  // Create fixed expense record
  const { data: fixedExpense, error: feError } = await supabase
    .from('fixed_expenses')
    .insert({
      canteen_id: canteen_id as string,
      type: name as string, // Store the name in 'type' field for backward compat
      amount: String(amount),
      start_date: start_date as string,
      end_date: end_date as string,
    })
    .select()
    .single();

  if (feError) {
    return NextResponse.json<ApiResponse>(
      { success: false, error: `创建失败: ${feError.message}` },
      { status: 500 }
    );
  }

  // Auto-generate expense records within date range
  // Daily amount = monthly amount / days in the month of each date
  const sDate = new Date(start_date as string + 'T00:00:00');
  const eDate = new Date(end_date as string + 'T00:00:00');
  const monthlyAmount = Number(amount);
  const records: Record<string, unknown>[] = [];

  const current = new Date(sDate);
  while (current <= eDate) {
    const year = current.getFullYear();
    const month = current.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const dailyAmount = (monthlyAmount / daysInMonth).toFixed(2);
    const dateStr = current.toISOString().slice(0, 10);

    records.push({
      canteen_id: canteen_id as string,
      expense_date: dateStr,
      category: name as string,
      amount: dailyAmount,
      is_auto_generated: true,
      fixed_expense_id: (fixedExpense as Record<string, unknown>).id,
      created_by: roleCheck.user.user_id,
    });

    current.setDate(current.getDate() + 1);
  }

  // Insert records in batches
  if (records.length > 0) {
    const batchSize = 100;
    for (let i = 0; i < records.length; i += batchSize) {
      const batch = records.slice(i, i + batchSize);
      const { error: batchError } = await supabase
        .from('expense_records')
        .insert(batch);
      if (batchError) {
        console.error('Batch insert error:', batchError.message);
      }
    }
  }

  return NextResponse.json<ApiResponse>({ success: true, data: fixedExpense }, { status: 201 });
}
