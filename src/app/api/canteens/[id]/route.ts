import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { getCurrentUser, requireRoles, checkCanteenAccess, CAN_MANAGE_CANTEEN, unauthorized } from '@/lib/auth/guard';
import type { ApiResponse } from '@/lib/auth/types';

/**
 * PUT /api/canteens/[id]
 * 编辑食堂信息（名称、地址、联系人、负责人）
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const currentUser = getCurrentUser(request);
  const roleCheck = requireRoles(currentUser, CAN_MANAGE_CANTEEN);
  if (!roleCheck.ok) return roleCheck.response;

  const { id: canteenId } = await params;
  const accessCheck = await checkCanteenAccess(roleCheck.user, canteenId);
  if (!accessCheck.ok) return accessCheck.response;

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const client = getSupabaseClient();

    const updateData: Record<string, unknown> = {};
    if (body.name !== undefined) updateData.name = String(body.name).trim();
    if (body.address !== undefined) updateData.address = body.address || null;
    if (body.contact_name !== undefined) updateData.contact_name = body.contact_name || null;
    if (body.contact_phone !== undefined) updateData.contact_phone = body.contact_phone || null;
    if (body.manager_id !== undefined) updateData.manager_id = body.manager_id || null;

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json<ApiResponse>({ success: false, error: '没有可更新的字段' }, { status: 400 });
    }

    const { data, error } = await client
      .from('canteens')
      .update(updateData)
      .eq('id', canteenId)
      .select()
      .single();

    if (error) {
      return NextResponse.json<ApiResponse>({ success: false, error: `更新失败: ${error.message}` }, { status: 500 });
    }

    return NextResponse.json<ApiResponse>({ success: true, data });
  } catch (err) {
    const message = err instanceof Error ? err.message : '更新食堂失败';
    return NextResponse.json<ApiResponse>({ success: false, error: message }, { status: 500 });
  }
}

/**
 * DELETE /api/canteens/[id]
 * 软删除食堂
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const currentUser = getCurrentUser(request);
  const roleCheck = requireRoles(currentUser, CAN_MANAGE_CANTEEN);
  if (!roleCheck.ok) return roleCheck.response;

  const { id: canteenId } = await params;
  const accessCheck = await checkCanteenAccess(roleCheck.user, canteenId);
  if (!accessCheck.ok) return accessCheck.response;

  try {
    const client = getSupabaseClient();
    const { error } = await client
      .from('canteens')
      .update({ is_active: false })
      .eq('id', canteenId);

    if (error) {
      return NextResponse.json<ApiResponse>({ success: false, error: `删除失败: ${error.message}` }, { status: 500 });
    }

    return NextResponse.json<ApiResponse>({ success: true, data: { message: '已删除' } });
  } catch (err) {
    const message = err instanceof Error ? err.message : '删除食堂失败';
    return NextResponse.json<ApiResponse>({ success: false, error: message }, { status: 500 });
  }
}

/**
 * GET /api/canteens/[id]
 * 获取单个食堂详情
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const currentUser = getCurrentUser(request);
  if (!currentUser) return unauthorized();

  const { id: canteenId } = await params;
  const accessCheck = await checkCanteenAccess(currentUser, canteenId);
  if (!accessCheck.ok) return accessCheck.response;

  try {
    const client = getSupabaseClient();
    const { data, error } = await client
      .from('canteens')
      .select('id, company_id, name, address, contact_name, contact_phone, manager_id, is_active, created_at')
      .eq('id', canteenId)
      .maybeSingle();

    if (error || !data) {
      return NextResponse.json<ApiResponse>({ success: false, error: '食堂不存在' }, { status: 404 });
    }

    // Lookup manager name separately
    let managerName: string | null = null;
    if (data.manager_id) {
      const { data: mgr } = await client
        .from('users')
        .select('real_name')
        .eq('id', data.manager_id)
        .maybeSingle();
      managerName = mgr?.real_name || null;
    }

    return NextResponse.json<ApiResponse>({ success: true, data: { ...data, manager_name: managerName } });
  } catch (err) {
    const message = err instanceof Error ? err.message : '查询失败';
    return NextResponse.json<ApiResponse>({ success: false, error: message }, { status: 500 });
  }
}
