import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { getCurrentUser, requireRoles, checkCanteenAccess, CAN_MANAGE_CANTEEN, unauthorized } from '@/lib/auth/guard';
import type { ApiResponse } from '@/lib/auth/types';

/**
 * GET /api/settings/fixed-expenses?canteen_id=xxx
 * 查询固定支出列表
 */
export async function GET(request: NextRequest) {
  const user = getCurrentUser(request);
  if (!user) return unauthorized();

  const roleCheck = requireRoles(user, CAN_MANAGE_CANTEEN);
  if (!roleCheck.ok) return roleCheck.response;

  const { searchParams } = new URL(request.url);
  const canteenId = searchParams.get('canteen_id');
  const supabase = getSupabaseClient();

  let query = supabase
    .from('fixed_expenses')
    .select('id, canteen_id, category, amount, start_date, end_date, note, is_active, created_by, created_at')
    .eq('is_active', true)
    .order('created_at', { ascending: false });

  if (canteenId) {
    const access = await checkCanteenAccess(roleCheck.user, canteenId);
    if (!access.ok) return access.response;
    query = query.eq('canteen_id', canteenId);
  } else if (roleCheck.user.role_code !== 'SYSTEM_DEVELOPER') {
    // COMPANY_MANAGER: 查看其公司下所有食堂的固定支出
    const { data: canteens } = await supabase.from('canteens').select('id').eq('company_id', roleCheck.user.org_id);
    const ids = (canteens || []).map((c: { id: string }) => c.id);
    query = query.in('canteen_id', ids.length > 0 ? ids : ['__none__']);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json<ApiResponse>({ success: false, error: error.message }, { status: 500 });

  return NextResponse.json<ApiResponse>({ success: true, data });
}

/**
 * POST /api/settings/fixed-expenses
 * 创建固定支出
 * 字段：canteen_id, category(自定义), amount, note, start_date, end_date
 */
export async function POST(request: NextRequest) {
  const user = getCurrentUser(request);
  if (!user) return unauthorized();

  const roleCheck = requireRoles(user, CAN_MANAGE_CANTEEN);
  if (!roleCheck.ok) return roleCheck.response;

  const body = (await request.json()) as Record<string, unknown>;
  const { canteen_id, category, amount, note, start_date, end_date } = body;

  if (!canteen_id || !category || amount === undefined) {
    return NextResponse.json<ApiResponse>({ success: false, error: '食堂、费用类型和金额为必填项' }, { status: 400 });
  }

  const access = await checkCanteenAccess(roleCheck.user, canteen_id as string);
  if (!access.ok) return access.response;

  const supabase = getSupabaseClient();

  const insertData: Record<string, unknown> = {
    canteen_id: canteen_id as string,
    category: category as string,
    amount: String(amount),
    note: (note as string) || null,
    start_date: (start_date as string) || null,
    end_date: (end_date as string) || null,
    created_by: roleCheck.user.user_id,
  };

  const { data, error } = await supabase
    .from('fixed_expenses')
    .insert(insertData)
    .select()
    .single();

  if (error) return NextResponse.json<ApiResponse>({ success: false, error: error.message }, { status: 500 });

  // 自动生成起止范围内的支出记录
  const startDate = start_date as string | null;
  const endDate = end_date as string | null;
  if (startDate) {
    const today = new Date();
    const s = new Date(startDate);
    const e = endDate ? new Date(endDate) : null;
    const records: Record<string, unknown>[] = [];
    const current = new Date(s);
    while (current <= today && (!e || current <= e)) {
      records.push({
        canteen_id: canteen_id as string,
        expense_date: current.toISOString().slice(0, 10),
        category: category as string,
        amount: String(amount),
        note: ((note as string) || null),
        is_auto_generated: true,
        fixed_expense_id: (data as Record<string, unknown>).id,
        created_by: roleCheck.user.user_id,
      });
      current.setDate(current.getDate() + 1);
    }
    if (records.length > 0) {
      await supabase.from('expense_records').insert(records);
    }
  }

  return NextResponse.json<ApiResponse>({ success: true, data }, { status: 201 });
}
