import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { getCurrentUser, requireRoles, checkCanteenAccess, checkStallAccess, forbidden } from '@/lib/auth/guard';
import { RoleCode } from '@/lib/auth/constants';

const CAN_RECORD_REVENUE = [RoleCode.SYSTEM_DEVELOPER, RoleCode.COMPANY_MANAGER, RoleCode.CANTEEN_MANAGER, RoleCode.STALL_MANAGER];

/** 创建营收记录 */
export async function POST(request: NextRequest) {
  const user = getCurrentUser(request);
  const roleCheck = requireRoles(user, CAN_RECORD_REVENUE);
  if (!roleCheck.ok) return roleCheck.response;

  try {
    const body = await request.json();
    const { canteen_id, stall_id, meal_type_id, revenue_type_id, record_date, order_count, amount, note } = body;

    if (!canteen_id || !stall_id || !record_date || amount == null) {
      return NextResponse.json({ success: false, error: '缺少必填字段' }, { status: 400 });
    }

    // 权限校验：食堂归属
    const canteenCheck = await checkCanteenAccess(roleCheck.user, canteen_id);
    if (!canteenCheck.ok) return canteenCheck.response;

    // 权限校验：档口归属
    const stallCheck = await checkStallAccess(roleCheck.user, stall_id);
    if (!stallCheck.ok) return stallCheck.response;

    // 档口负责人只能录入自己的档口
    if (roleCheck.user.role_code === RoleCode.STALL_MANAGER && roleCheck.user.org_id !== stall_id) {
      return forbidden('只能录入自己负责的档口数据');
    }

    // 食堂负责人只能录入自己食堂下的档口
    if (roleCheck.user.role_code === RoleCode.CANTEEN_MANAGER && roleCheck.user.org_id !== canteen_id) {
      return forbidden('只能录入自己负责的食堂数据');
    }

    const client = getSupabaseClient();

    // 唯一性校验：同一档口+同一日期+同一餐别+同一类型不可重复
    const { data: existing } = await client
      .from('revenue_records')
      .select('id, amount')
      .eq('stall_id', stall_id)
      .eq('record_date', record_date)
      .eq('meal_type_id', meal_type_id || null)
      .eq('revenue_type_id', revenue_type_id || null)
      .eq('is_active', true)
      .maybeSingle();

    if (existing) {
      // 覆盖更新
      const { data, error } = await client
        .from('revenue_records')
        .update({
          order_count: order_count ?? 0,
          amount: String(amount),
          note: note || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id)
        .select()
        .single();

      if (error) {
        return NextResponse.json({ success: false, error: `更新失败: ${error.message}` }, { status: 500 });
      }
      return NextResponse.json({ success: true, data, message: '数据已覆盖更新' });
    }

    // 新增
    const { data, error } = await client
      .from('revenue_records')
      .insert({
        canteen_id,
        stall_id,
        meal_type_id: meal_type_id || null,
        revenue_type_id: revenue_type_id || null,
        record_date,
        order_count: order_count ?? 0,
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

/** 查询营收记录列表 */
export async function GET(request: NextRequest) {
  const user = getCurrentUser(request);
  const roleCheck = requireRoles(user, CAN_RECORD_REVENUE);
  if (!roleCheck.ok) return roleCheck.response;

  try {
    const { searchParams } = new URL(request.url);
    const canteen_id = searchParams.get('canteen_id');
    const stall_id = searchParams.get('stall_id');
    const start_date = searchParams.get('start_date');
    const end_date = searchParams.get('end_date');
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = parseInt(searchParams.get('page_size') || '20');

    const client = getSupabaseClient();
    let query = client
      .from('revenue_records')
      .select('id, canteen_id, stall_id, meal_type_id, revenue_type_id, record_date, order_count, amount, note, created_by, created_at, updated_at, stalls(name), meal_types(name), revenue_types(name)', { count: 'exact' })
      .eq('is_active', true)
      .order('record_date', { ascending: false })
      .range((page - 1) * pageSize, page * pageSize - 1);

    // 权限过滤
    if (roleCheck.user.role_code === RoleCode.STALL_MANAGER) {
      query = query.eq('stall_id', roleCheck.user.org_id);
    } else if (roleCheck.user.role_code === RoleCode.CANTEEN_MANAGER) {
      query = query.eq('canteen_id', roleCheck.user.org_id);
    } else if (roleCheck.user.role_code === RoleCode.COMPANY_MANAGER) {
      // 查公司下所有食堂
      const { data: canteens } = await client
        .from('canteens')
        .select('id')
        .eq('company_id', roleCheck.user.org_id);
      const canteenIds = (canteens || []).map((c: { id: string }) => c.id);
      query = query.in('canteen_id', canteenIds.length > 0 ? canteenIds : ['__none__']);
    }

    if (canteen_id) query = query.eq('canteen_id', canteen_id);
    if (stall_id) query = query.eq('stall_id', stall_id);
    if (start_date) query = query.gte('record_date', start_date);
    if (end_date) query = query.lte('record_date', end_date);

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
