import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { getCurrentUser, requireRoles, checkStallAccess, CAN_MANAGE_STALL, unauthorized } from '@/lib/auth/guard';
import type { ApiResponse } from '@/lib/auth/types';

/**
 * PUT /api/stalls/[id]
 * 编辑档口信息（名称、外送、外卖、联系人）
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const currentUser = getCurrentUser(request);
  const roleCheck = requireRoles(currentUser, CAN_MANAGE_STALL);
  if (!roleCheck.ok) return roleCheck.response;

  const { id: stallId } = await params;
  const accessCheck = await checkStallAccess(roleCheck.user, stallId);
  if (!accessCheck.ok) return accessCheck.response;

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const client = getSupabaseClient();

    const updateData: Record<string, unknown> = {};
    if (body.name !== undefined) updateData.name = String(body.name).trim();
    if (body.has_delivery !== undefined) updateData.has_delivery = !!body.has_delivery;
    if (body.has_takeout !== undefined) updateData.has_takeout = !!body.has_takeout;
    if (body.contact_name !== undefined) updateData.contact_name = body.contact_name || null;
    if (body.contact_phone !== undefined) updateData.contact_phone = body.contact_phone || null;
    if (body.manager_id !== undefined) updateData.manager_id = body.manager_id || null;

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json<ApiResponse>({ success: false, error: '没有可更新的字段' }, { status: 400 });
    }

    const { data, error } = await client
      .from('stalls')
      .update(updateData)
      .eq('id', stallId)
      .select()
      .single();

    if (error) {
      return NextResponse.json<ApiResponse>({ success: false, error: `更新失败: ${error.message}` }, { status: 500 });
    }

    return NextResponse.json<ApiResponse>({ success: true, data });
  } catch (err) {
    const message = err instanceof Error ? err.message : '更新档口失败';
    return NextResponse.json<ApiResponse>({ success: false, error: message }, { status: 500 });
  }
}

/**
 * DELETE /api/stalls/[id]
 * 软删除档口
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const currentUser = getCurrentUser(request);
  const roleCheck = requireRoles(currentUser, CAN_MANAGE_STALL);
  if (!roleCheck.ok) return roleCheck.response;

  const { id: stallId } = await params;
  const accessCheck = await checkStallAccess(roleCheck.user, stallId);
  if (!accessCheck.ok) return accessCheck.response;

  try {
    const client = getSupabaseClient();
    const { error } = await client
      .from('stalls')
      .update({ is_active: false })
      .eq('id', stallId);

    if (error) {
      return NextResponse.json<ApiResponse>({ success: false, error: `删除失败: ${error.message}` }, { status: 500 });
    }

    return NextResponse.json<ApiResponse>({ success: true, data: { message: '已删除' } });
  } catch (err) {
    const message = err instanceof Error ? err.message : '删除档口失败';
    return NextResponse.json<ApiResponse>({ success: false, error: message }, { status: 500 });
  }
}

/**
 * GET /api/stalls/[id]
 * 获取单个档口详情
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const currentUser = getCurrentUser(request);
  if (!currentUser) return unauthorized();

  const { id: stallId } = await params;
  const accessCheck = await checkStallAccess(currentUser, stallId);
  if (!accessCheck.ok) return accessCheck.response;

  try {
    const client = getSupabaseClient();
    const { data, error } = await client
      .from('stalls')
      .select('id, canteen_id, name, manager_id, has_delivery, has_takeout, contact_name, contact_phone, is_active, created_at')
      .eq('id', stallId)
      .maybeSingle();

    if (error || !data) {
      return NextResponse.json<ApiResponse>({ success: false, error: '档口不存在' }, { status: 404 });
    }

    return NextResponse.json<ApiResponse>({ success: true, data });
  } catch (err) {
    const message = err instanceof Error ? err.message : '查询失败';
    return NextResponse.json<ApiResponse>({ success: false, error: message }, { status: 500 });
  }
}
