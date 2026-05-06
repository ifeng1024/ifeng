import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { getCurrentUser, requireRoles, checkCanteenAccess } from '@/lib/auth/guard';
import { RoleCode } from '@/lib/auth/constants';

/** 获取固定支出列表 */
export async function GET(request: NextRequest) {
  const user = getCurrentUser(request);
  const roleCheck = requireRoles(user, [RoleCode.SYSTEM_DEVELOPER, RoleCode.COMPANY_MANAGER]);
  if (!roleCheck.ok) return roleCheck.response;

  try {
    const { searchParams } = new URL(request.url);
    const canteen_id = searchParams.get('canteen_id');
    const client = getSupabaseClient();

    let query = client
      .from('fixed_expenses')
      .select('id, canteen_id, category, amount, note, is_active, created_at, canteens(name)')
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (canteen_id) {
      const canteenCheck = await checkCanteenAccess(roleCheck.user, canteen_id);
      if (!canteenCheck.ok) return canteenCheck.response;
      query = query.eq('canteen_id', canteen_id);
    } else if (roleCheck.user.role_code === RoleCode.COMPANY_MANAGER) {
      const { data: canteens } = await client.from('canteens').select('id').eq('company_id', roleCheck.user.org_id);
      const ids = (canteens || []).map((c: { id: string }) => c.id);
      query = query.in('canteen_id', ids.length > 0 ? ids : ['__none__']);
    }

    const { data, error } = await query;
    if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    return NextResponse.json({ success: true, data });
  } catch (err) {
    const message = err instanceof Error ? err.message : '查询失败';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

/** 创建固定支出 */
export async function POST(request: NextRequest) {
  const user = getCurrentUser(request);
  const roleCheck = requireRoles(user, [RoleCode.SYSTEM_DEVELOPER, RoleCode.COMPANY_MANAGER]);
  if (!roleCheck.ok) return roleCheck.response;

  try {
    const body = await request.json();
    const { canteen_id, category, amount, note } = body;

    if (!canteen_id || !category || amount == null) {
      return NextResponse.json({ success: false, error: '缺少必填字段' }, { status: 400 });
    }

    const canteenCheck = await checkCanteenAccess(roleCheck.user, canteen_id);
    if (!canteenCheck.ok) return canteenCheck.response;

    const client = getSupabaseClient();
    const { data, error } = await client
      .from('fixed_expenses')
      .insert({
        canteen_id,
        category,
        amount: String(amount),
        note: note || null,
        created_by: roleCheck.user.user_id,
      })
      .select()
      .single();

    if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    return NextResponse.json({ success: true, data }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : '创建失败';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
