import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { getCurrentUser, requireRoles, checkCanteenAccess, checkStallAccess, CAN_ENTER_REVENUE, unauthorized } from '@/lib/auth/guard';
import type { ApiResponse } from '@/lib/auth/types';

/**
 * GET /api/revenue-records?canteen_id=xxx&stall_id=xxx&start_date=xxx&end_date=xxx
 * 查询营收记录列表，按权限过滤
 */
export async function GET(request: NextRequest) {
  const user = getCurrentUser(request);
  if (!user) return unauthorized();

  const supabase = getSupabaseClient();
  const { searchParams } = new URL(request.url);
  const canteenId = searchParams.get('canteen_id');
  const stallId = searchParams.get('stall_id');
  const startDate = searchParams.get('start_date');
  const endDate = searchParams.get('end_date');
  const page = parseInt(searchParams.get('page') || '1');
  const pageSize = parseInt(searchParams.get('page_size') || '50');

  let query = supabase
    .from('revenue_records')
    .select('id, canteen_id, stall_id, meal_type_id, record_date, order_count, amount, note, is_active, created_by, created_at, updated_at, stalls(name), canteens(name), meal_types(name)', { count: 'exact' })
    .eq('is_active', true)
    .order('record_date', { ascending: false })
    .order('created_at', { ascending: false })
    .range((page - 1) * pageSize, page * pageSize - 1);

  if (canteenId) query = query.eq('canteen_id', canteenId);
  if (stallId) query = query.eq('stall_id', stallId);
  if (startDate) query = query.gte('record_date', startDate);
  if (endDate) query = query.lte('record_date', endDate);

  // 权限过滤
  if (user.role_code === 'SYSTEM_DEVELOPER') {
    // 全局可见
  } else if (user.role_code === 'COMPANY_MANAGER') {
    if (canteenId) {
      const access = await checkCanteenAccess(user, canteenId);
      if (!access.ok) return access.response;
    } else {
      const { data: canteens } = await supabase.from('canteens').select('id').eq('company_id', user.org_id);
      if (canteens && canteens.length > 0) {
        query = query.in('canteen_id', canteens.map((c: { id: string }) => c.id));
      } else {
        return NextResponse.json<ApiResponse>({ success: true, data: { records: [], total: 0 } });
      }
    }
  } else if (user.role_code === 'CANTEEN_MANAGER') {
    query = query.eq('canteen_id', user.org_id);
  } else if (user.role_code === 'STALL_MANAGER') {
    query = query.eq('stall_id', user.org_id);
  } else {
    return NextResponse.json<ApiResponse>({ success: false, error: '无权查看营收数据' }, { status: 403 });
  }

  const { data, count, error } = await query;
  if (error) return NextResponse.json<ApiResponse>({ success: false, error: error.message }, { status: 500 });

  // 格式化返回数据，展开关联名称
  const formatted = (data || []).map((r: Record<string, unknown>) => ({
    ...r,
    stall_name: (r.stalls as Record<string, unknown>)?.name || null,
    canteen_name: (r.canteens as Record<string, unknown>)?.name || null,
    meal_type_name: (r.meal_types as Record<string, unknown>)?.name || null,
    stalls: undefined,
    canteens: undefined,
    meal_types: undefined,
  }));

  return NextResponse.json({ success: true, data: { records: formatted, total: count } });
}

/**
 * POST /api/revenue-records
 * 创建营收记录
 * 字段：canteen_id, stall_id, meal_type_id(必填), record_date, order_count, amount, note
 */
export async function POST(request: NextRequest) {
  const user = getCurrentUser(request);
  if (!user) return unauthorized();

  const roleCheck = requireRoles(user, CAN_ENTER_REVENUE);
  if (!roleCheck.ok) return roleCheck.response;

  const body = (await request.json()) as Record<string, unknown>;
  const { canteen_id, stall_id, meal_type_id, record_date, order_count, amount, note } = body;

  // 校验必填项
  if (!canteen_id || !stall_id || !meal_type_id || !record_date) {
    return NextResponse.json<ApiResponse>({ success: false, error: '食堂、档口、餐别和日期为必填项' }, { status: 400 });
  }

  // 权限校验：检查对该食堂的访问权
  const access = await checkCanteenAccess(roleCheck.user, canteen_id as string);
  if (!access.ok) return access.response;

  // 档口归属校验
  const stallAccess = await checkStallAccess(roleCheck.user, stall_id as string);
  if (!stallAccess.ok) return stallAccess.response;

  const supabase = getSupabaseClient();

  // 唯一性校验：同一档口+同一日期+同一餐别
  const { data: existing } = await supabase
    .from('revenue_records')
    .select('id, amount, order_count')
    .eq('stall_id', stall_id as string)
    .eq('record_date', record_date as string)
    .eq('meal_type_id', meal_type_id as string)
    .eq('is_active', true)
    .maybeSingle();

  if (existing) {
    // 覆盖更新
    const { data: updated, error } = await supabase
      .from('revenue_records')
      .update({
        order_count: (order_count as number) ?? 0,
        amount: String((amount as number) ?? 0),
        note: (note as string) || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', (existing as Record<string, unknown>).id as string)
      .select()
      .single();

    if (error) return NextResponse.json<ApiResponse>({ success: false, error: error.message }, { status: 500 });
    return NextResponse.json<ApiResponse>({ success: true, data: updated });
  }

  // 新增记录
  const { data, error } = await supabase
    .from('revenue_records')
    .insert({
      canteen_id: canteen_id as string,
      stall_id: stall_id as string,
      meal_type_id: meal_type_id as string,
      record_date: record_date as string,
      order_count: (order_count as number) ?? 0,
      amount: String((amount as number) ?? 0),
      note: (note as string) || null,
      created_by: roleCheck.user.user_id,
    })
    .select()
    .single();

  if (error) return NextResponse.json<ApiResponse>({ success: false, error: error.message }, { status: 500 });
  return NextResponse.json<ApiResponse>({ success: true, data }, { status: 201 });
}
