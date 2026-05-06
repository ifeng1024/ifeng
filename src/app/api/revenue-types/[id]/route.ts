import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { getCurrentUser, requireRoles } from '@/lib/auth/guard';
import { CAN_MANAGE_REVENUE_TYPE } from '@/lib/auth/constants';
import type { ApiResponse, UpdateRevenueTypeRequest, DbRevenueType } from '@/lib/auth/types';

/**
 * 辅助函数：校验当前用户是否有权操作指定营收类型
 */
async function checkRevenueTypeAccess(
  user: { user_id: string; role_code: string; org_id: string | null },
  revenueTypeId: string
): Promise<{ ok: true; revenueType: DbRevenueType } | { ok: false; response: NextResponse }> {
  const client = getSupabaseClient();
  const { data: revenueType, error } = await client
    .from('revenue_types')
    .select('*')
    .eq('id', revenueTypeId)
    .maybeSingle() as { data: DbRevenueType | null; error: unknown };

  if (error || !revenueType) {
    return {
      ok: false,
      response: NextResponse.json<ApiResponse>(
        { success: false, error: '营收类型不存在' },
        { status: 404 }
      ),
    };
  }

  const { checkCanteenAccess } = await import('@/lib/auth/guard');
  const canteenCheck = await checkCanteenAccess(
    user as Parameters<typeof checkCanteenAccess>[0],
    revenueType.canteen_id
  );
  if (!canteenCheck.ok) {
    return { ok: false, response: canteenCheck.response };
  }

  return { ok: true, revenueType };
}

/**
 * GET /api/revenue-types/[id]
 * 获取单个营收类型详情
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const currentUser = getCurrentUser(request);
  if (!currentUser) {
    return NextResponse.json<ApiResponse>(
      { success: false, error: '未授权，请先登录' },
      { status: 401 }
    );
  }

  const { id } = await params;
  const accessCheck = await checkRevenueTypeAccess(currentUser, id);
  if (!accessCheck.ok) return accessCheck.response;

  return NextResponse.json<ApiResponse>({
    success: true,
    data: accessCheck.revenueType,
  });
}

/**
 * PUT /api/revenue-types/[id]
 * 更新营收类型
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const currentUser = getCurrentUser(request);
  const roleCheck = requireRoles(currentUser, CAN_MANAGE_REVENUE_TYPE);
  if (!roleCheck.ok) return roleCheck.response;

  const { id } = await params;
  const accessCheck = await checkRevenueTypeAccess(roleCheck.user, id);
  if (!accessCheck.ok) return accessCheck.response;

  try {
    const body = (await request.json()) as UpdateRevenueTypeRequest;
    const client = getSupabaseClient();

    if (body.name !== undefined && body.name.trim() !== accessCheck.revenueType.name) {
      if (!body.name.trim()) {
        return NextResponse.json<ApiResponse>(
          { success: false, error: '营收类型名称不能为空' },
          { status: 400 }
        );
      }

      const { data: existing } = await client
        .from('revenue_types')
        .select('id')
        .eq('canteen_id', accessCheck.revenueType.canteen_id)
        .eq('name', body.name.trim())
        .eq('is_active', true)
        .maybeSingle();

      if (existing) {
        return NextResponse.json<ApiResponse>(
          { success: false, error: '该食堂下已存在同名营收类型' },
          { status: 409 }
        );
      }
    }

    const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (body.name !== undefined) updateData.name = body.name.trim();
    if (body.is_active !== undefined) updateData.is_active = body.is_active;

    const { data, error } = await client
      .from('revenue_types')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json<ApiResponse>(
          { success: false, error: '该食堂下已存在同名营收类型' },
          { status: 409 }
        );
      }
      return NextResponse.json<ApiResponse>(
        { success: false, error: `更新营收类型失败: ${error.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json<ApiResponse>({
      success: true,
      data: data as DbRevenueType,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : '更新营收类型失败';
    return NextResponse.json<ApiResponse>(
      { success: false, error: message },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/revenue-types/[id]
 * 软删除营收类型
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const currentUser = getCurrentUser(request);
  const roleCheck = requireRoles(currentUser, CAN_MANAGE_REVENUE_TYPE);
  if (!roleCheck.ok) return roleCheck.response;

  const { id } = await params;
  const accessCheck = await checkRevenueTypeAccess(roleCheck.user, id);
  if (!accessCheck.ok) return accessCheck.response;

  try {
    const client = getSupabaseClient();

    // TODO: 当营收记录表创建后，取消注释以下引用校验
    // const { data: revenueRecords } = await client
    //   .from('revenue_records')
    //   .select('id')
    //   .eq('revenue_type_id', id)
    //   .limit(1);
    // if (revenueRecords && revenueRecords.length > 0) {
    //   return NextResponse.json<ApiResponse>(
    //     { success: false, error: '该营收类型已被使用，无法删除' },
    //     { status: 409 }
    //   );
    // }

    const { error } = await client
      .from('revenue_types')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('id', id);

    if (error) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: `删除营收类型失败: ${error.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json<ApiResponse>({
      success: true,
      data: { id, is_active: false },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : '删除营收类型失败';
    return NextResponse.json<ApiResponse>(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
