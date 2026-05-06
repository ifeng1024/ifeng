import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { getCurrentUser, requireRoles, checkCanteenAccess, forbidden } from '@/lib/auth/guard';
import { RoleCode } from '@/lib/auth/constants';

const CAN_RECORD_EXPENSE = [RoleCode.SYSTEM_DEVELOPER, RoleCode.COMPANY_MANAGER, RoleCode.CANTEEN_MANAGER];

/** 创建支出记录 */
export async function POST(request: NextRequest) {
  const user = getCurrentUser(request);
  const roleCheck = requireRoles(user, CAN_RECORD_EXPENSE);
  if (!roleCheck.ok) return roleCheck.response;

  try {
    const body = await request.json();
    const { canteen_id, expense_date, category, amount, note } = body;

    if (!canteen_id || !expense_date || !category || amount == null) {
      return NextResponse.json({ success: false, error: '缺少必填字段' }, { status: 400 });
    }

    // 权限校验
    const canteenCheck = await checkCanteenAccess(roleCheck.user, canteen_id);
    if (!canteenCheck.ok) return canteenCheck.response;

    if (roleCheck.user.role_code === RoleCode.CANTEEN_MANAGER && roleCheck.user.org_id !== canteen_id) {
      return forbidden('只能为自己负责的食堂录入支出');
    }

    const client = getSupabaseClient();
    const { data, error } = await client
      .from('expense_records')
      .insert({
        canteen_id,
        expense_date,
        category,
        amount: String(amount),
        note: note || null,
        created_by: roleCheck.user.user_id,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ success: false, error: `创建失败: ${error.message}` }, { status: 500 });
    }
    return NextResponse.json({ success: true, data }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : '创建失败';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

/** 查询支出记录列表 */
export async function GET(request: NextRequest) {
  const user = getCurrentUser(request);
  const roleCheck = requireRoles(user, [RoleCode.SYSTEM_DEVELOPER, RoleCode.COMPANY_MANAGER, RoleCode.CANTEEN_MANAGER]);
  if (!roleCheck.ok) return roleCheck.response;

  try {
    const { searchParams } = new URL(request.url);
    const canteen_id = searchParams.get('canteen_id');
    const start_date = searchParams.get('start_date');
    const end_date = searchParams.get('end_date');
    const category = searchParams.get('category');
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = parseInt(searchParams.get('page_size') || '20');

    const client = getSupabaseClient();
    let query = client
      .from('expense_records')
      .select('id, canteen_id, expense_date, category, amount, note, is_auto_generated, fixed_expense_id, created_by, created_at, updated_at, canteens(name)', { count: 'exact' })
      .eq('is_active', true)
      .order('expense_date', { ascending: false })
      .range((page - 1) * pageSize, page * pageSize - 1);

    // 权限过滤
    if (roleCheck.user.role_code === RoleCode.CANTEEN_MANAGER) {
      query = query.eq('canteen_id', roleCheck.user.org_id);
    } else if (roleCheck.user.role_code === RoleCode.COMPANY_MANAGER) {
      const { data: canteens } = await client
        .from('canteens')
        .select('id')
        .eq('company_id', roleCheck.user.org_id);
      const canteenIds = (canteens || []).map((c: { id: string }) => c.id);
      query = query.in('canteen_id', canteenIds.length > 0 ? canteenIds : ['__none__']);
    }

    if (canteen_id) query = query.eq('canteen_id', canteen_id);
    if (start_date) query = query.gte('expense_date', start_date);
    if (end_date) query = query.lte('expense_date', end_date);
    if (category) query = query.eq('category', category);

    const { data, error, count } = await query;

    if (error) {
      return NextResponse.json({ success: false, error: `查询失败: ${error.message}` }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      data: { records: data, total: count, page, page_size: pageSize },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : '查询失败';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
