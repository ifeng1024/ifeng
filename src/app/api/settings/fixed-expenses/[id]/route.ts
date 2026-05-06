import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { getCurrentUser, requireRoles, checkCanteenAccess } from '@/lib/auth/guard';
import { RoleCode } from '@/lib/auth/constants';

/** 更新固定支出 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = getCurrentUser(request);
  const roleCheck = requireRoles(user, [RoleCode.SYSTEM_DEVELOPER, RoleCode.COMPANY_MANAGER]);
  if (!roleCheck.ok) return roleCheck.response;

  try {
    const { id } = await params;
    const body = await request.json();
    const client = getSupabaseClient();

    const { data: existing } = await client
      .from('fixed_expenses')
      .select('canteen_id')
      .eq('id', id)
      .eq('is_active', true)
      .maybeSingle();

    if (!existing) {
      return NextResponse.json({ success: false, error: '记录不存在' }, { status: 404 });
    }

    const canteenCheck = await checkCanteenAccess(roleCheck.user, existing.canteen_id);
    if (!canteenCheck.ok) return canteenCheck.response;

    const updateFields: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (body.category !== undefined) updateFields.category = body.category;
    if (body.amount !== undefined) updateFields.amount = String(body.amount);
    if (body.note !== undefined) updateFields.note = body.note || null;

    const { data, error } = await client
      .from('fixed_expenses')
      .update(updateFields)
      .eq('id', id)
      .select()
      .single();

    if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    return NextResponse.json({ success: true, data });
  } catch (err) {
    const message = err instanceof Error ? err.message : '更新失败';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

/** 删除固定支出（软删除） */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = getCurrentUser(request);
  const roleCheck = requireRoles(user, [RoleCode.SYSTEM_DEVELOPER, RoleCode.COMPANY_MANAGER]);
  if (!roleCheck.ok) return roleCheck.response;

  try {
    const { id } = await params;
    const client = getSupabaseClient();

    const { data: existing } = await client
      .from('fixed_expenses')
      .select('canteen_id')
      .eq('id', id)
      .eq('is_active', true)
      .maybeSingle();

    if (!existing) {
      return NextResponse.json({ success: false, error: '记录不存在' }, { status: 404 });
    }

    const canteenCheck = await checkCanteenAccess(roleCheck.user, existing.canteen_id);
    if (!canteenCheck.ok) return canteenCheck.response;

    const { error } = await client
      .from('fixed_expenses')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('id', id);

    if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : '删除失败';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
