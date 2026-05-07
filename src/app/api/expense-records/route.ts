import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { getCurrentUser, requireRoles, checkCanteenAccess, CAN_MANAGE_EXPENSE, unauthorized } from '@/lib/auth/guard';
import type { ApiResponse } from '@/lib/auth/types';

/**
 * GET /api/expense-records?canteen_id=xxx&start_date=xxx&end_date=xxx&category=xxx&stall_id=xxx&export=1
 * 查询支出记录列表，支持导出
 */
export async function GET(request: NextRequest) {
  const user = getCurrentUser(request);
  if (!user) return unauthorized();

  const supabase = getSupabaseClient();
  const { searchParams } = new URL(request.url);
  const canteenId = searchParams.get('canteen_id');
  const startDate = searchParams.get('start_date');
  const endDate = searchParams.get('end_date');
  const category = searchParams.get('category');
  const stallId = searchParams.get('stall_id');
  const isExport = searchParams.get('export') === '1';
  const page = parseInt(searchParams.get('page') || '1');
  const pageSize = parseInt(searchParams.get('page_size') || '50');

  let query = supabase
    .from('expense_records')
    .select('id, canteen_id, stall_id, expense_date, category, amount, note, is_auto_generated, fixed_expense_id, is_daily_repeat, repeat_group_id, product_category_id, product_id, quantity, unit_price, product_spec_id, is_active, created_by, created_at, updated_at, canteens(name), stalls(name)', { count: isExport ? undefined : 'exact' })
    .eq('is_active', true)
    .order('expense_date', { ascending: false })
    .order('created_at', { ascending: false });

  // Export: no pagination
  if (!isExport) {
    query = query.range((page - 1) * pageSize, page * pageSize - 1);
  }

  if (canteenId) query = query.eq('canteen_id', canteenId);
  if (startDate) query = query.gte('expense_date', startDate);
  if (endDate) query = query.lte('expense_date', endDate);
  if (category) query = query.eq('category', category);
  if (stallId) query = query.eq('stall_id', stallId);

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
    const { data: stall } = await supabase.from('stalls').select('canteen_id').eq('id', user.org_id).maybeSingle();
    if (stall) {
      query = query.eq('canteen_id', stall.canteen_id);
      if (!stallId) query = query.eq('stall_id', user.org_id);
    } else {
      return NextResponse.json<ApiResponse>({ success: true, data: { records: [], total: 0 } });
    }
  } else {
    return NextResponse.json<ApiResponse>({ success: false, error: '无权查看支出数据' }, { status: 403 });
  }

  const { data, count, error } = await query;
  if (error) return NextResponse.json<ApiResponse>({ success: false, error: error.message }, { status: 500 });

  // Collect product IDs for batch lookup
  const records = (data || []) as Record<string, unknown>[];
  const catIds = new Set<string>();
  const prodIds = new Set<string>();
  const specIds = new Set<string>();
  records.forEach(r => {
    if (r.product_category_id) catIds.add(r.product_category_id as string);
    if (r.product_id) prodIds.add(r.product_id as string);
    if (r.product_spec_id) specIds.add(r.product_spec_id as string);
  });

  // Batch lookup names
  const [catMap, prodMap, specMap] = await Promise.all([
    catIds.size > 0 ? supabase.from('product_categories').select('id, name').in('id', Array.from(catIds)) : { data: [] },
    prodIds.size > 0 ? supabase.from('products').select('id, name').in('id', Array.from(prodIds)) : { data: [] },
    specIds.size > 0 ? supabase.from('product_specs').select('id, name').in('id', Array.from(specIds)) : { data: [] },
  ]);

  const catNameMap = new Map((catMap.data || []).map((c: { id: string; name: string }) => [c.id, c.name]));
  const prodNameMap = new Map((prodMap.data || []).map((p: { id: string; name: string }) => [p.id, p.name]));
  const specNameMap = new Map((specMap.data || []).map((s: { id: string; name: string }) => [s.id, s.name]));

  const formatted: Record<string, unknown>[] = records.map(r => ({
    ...r,
    canteen_name: (r.canteens as Record<string, unknown>)?.name || null,
    stall_name: (r.stalls as Record<string, unknown>)?.name || null,
    product_category_name: r.product_category_id ? catNameMap.get(r.product_category_id as string) || null : null,
    product_name: r.product_id ? prodNameMap.get(r.product_id as string) || null : null,
    product_spec_name: r.product_spec_id ? specNameMap.get(r.product_spec_id as string) || null : null,
  }));

  // Export as CSV
  if (isExport) {
    const header = '日期,食堂,档口,类别,金额,备注,是否每天重复';
    const rows = formatted.map(r =>
      `${r.expense_date},${r.canteen_name || ''},${r.stall_name || ''},${r.category || ''},${r.amount},${(r.note || '').toString().replace(/,/g, '，')},${r.is_daily_repeat ? '是' : '否'}`
    );
    const csv = '\uFEFF' + header + '\n' + rows.join('\n');
    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename=expense_records_${startDate || 'all'}_${endDate || 'all'}.csv`,
      },
    });
  }

  return NextResponse.json({ success: true, data: { records: formatted, total: count } });
}

/**
 * POST /api/expense-records
 * 创建支出记录
 * 字段：canteen_id, expense_date, category, amount, note, stall_id(可选),
 *       is_daily_repeat(可选), product_category_id, product_id, quantity, unit_price, product_spec_id (仅食材采购)
 */
export async function POST(request: NextRequest) {
  const user = getCurrentUser(request);
  if (!user) return unauthorized();

  const roleCheck = requireRoles(user, CAN_MANAGE_EXPENSE);
  if (!roleCheck.ok) return roleCheck.response;

  const body = (await request.json()) as Record<string, unknown>;
  const {
    canteen_id, expense_date, category, amount, note,
    stall_id, is_daily_repeat,
    product_category_id, product_id, quantity, unit_price, product_spec_id,
  } = body;

  if (!canteen_id || !expense_date || !category || amount === undefined) {
    return NextResponse.json<ApiResponse>({ success: false, error: '食堂、日期、类别和金额为必填项' }, { status: 400 });
  }

  // 权限校验
  const access = await checkCanteenAccess(roleCheck.user, canteen_id as string);
  if (!access.ok) return access.response;

  const supabase = getSupabaseClient();

  const insertData: Record<string, unknown> = {
    canteen_id: canteen_id as string,
    expense_date: expense_date as string,
    category: category as string,
    amount: String(amount),
    note: (note as string) || null,
    stall_id: (stall_id as string) || null,
    is_daily_repeat: is_daily_repeat === true,
    created_by: roleCheck.user.user_id,
  };

  // 食材采购附加字段
  if ((category as string) === '食材采购') {
    if (product_category_id) insertData.product_category_id = product_category_id as string;
    if (product_id) insertData.product_id = product_id as string;
    if (quantity !== undefined) insertData.quantity = String(quantity);
    if (unit_price !== undefined) insertData.unit_price = String(unit_price);
    if (product_spec_id) insertData.product_spec_id = product_spec_id as string;
  }

  // Handle daily repeat: generate records for all days in the month
  if (is_daily_repeat === true) {
    const groupId = crypto.randomUUID();
    insertData.repeat_group_id = groupId;

    const dateStr = expense_date as string;
    const [year, month] = dateStr.split('-').map(Number);
    const daysInMonth = new Date(year, month, 0).getDate();

    const records: Record<string, unknown>[] = [];
    for (let day = 1; day <= daysInMonth; day++) {
      const d = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      records.push({
        ...insertData,
        expense_date: d,
      });
    }

    const { data, error } = await supabase
      .from('expense_records')
      .insert(records)
      .select();

    if (error) return NextResponse.json<ApiResponse>({ success: false, error: error.message }, { status: 500 });
    return NextResponse.json<ApiResponse>({ success: true, data: data?.[0] || null }, { status: 201 });
  }

  const { data, error } = await supabase
    .from('expense_records')
    .insert(insertData)
    .select()
    .single();

  if (error) return NextResponse.json<ApiResponse>({ success: false, error: error.message }, { status: 500 });
  return NextResponse.json<ApiResponse>({ success: true, data }, { status: 201 });
}
