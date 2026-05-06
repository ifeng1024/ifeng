import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { getCurrentUser, requireRoles } from '@/lib/auth/guard';
import { CAN_MANAGE_MEAL_TYPE } from '@/lib/auth/constants';
import type { ApiResponse, UpdateMealTypeRequest, DbMealType } from '@/lib/auth/types';

/**
 * 辅助函数：校验当前用户是否有权操作指定餐别
 * 通过餐别 → 食堂 → 公司的链路做归属校验
 */
async function checkMealTypeAccess(
  user: { user_id: string; role_code: string; org_id: string | null },
  mealTypeId: string
): Promise<{ ok: true; mealType: DbMealType } | { ok: false; response: NextResponse }> {
  const client = getSupabaseClient();
  const { data: mealType, error } = await client
    .from('meal_types')
    .select('*')
    .eq('id', mealTypeId)
    .maybeSingle() as { data: DbMealType | null; error: unknown };

  if (error || !mealType) {
    return {
      ok: false,
      response: NextResponse.json<ApiResponse>(
        { success: false, error: '餐别不存在' },
        { status: 404 }
      ),
    };
  }

  // 复用食堂归属校验
  const { checkCanteenAccess } = await import('@/lib/auth/guard');
  const canteenCheck = await checkCanteenAccess(
    user as Parameters<typeof checkCanteenAccess>[0],
    mealType.canteen_id
  );
  if (!canteenCheck.ok) {
    return { ok: false, response: canteenCheck.response };
  }

  return { ok: true, mealType };
}

/**
 * GET /api/meal-types/[id]
 * 获取单个餐别详情
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
  const accessCheck = await checkMealTypeAccess(currentUser, id);
  if (!accessCheck.ok) return accessCheck.response;

  return NextResponse.json<ApiResponse>({
    success: true,
    data: accessCheck.mealType,
  });
}

/**
 * PUT /api/meal-types/[id]
 * 更新餐别
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const currentUser = getCurrentUser(request);
  const roleCheck = requireRoles(currentUser, CAN_MANAGE_MEAL_TYPE);
  if (!roleCheck.ok) return roleCheck.response;

  const { id } = await params;
  const accessCheck = await checkMealTypeAccess(roleCheck.user, id);
  if (!accessCheck.ok) return accessCheck.response;

  try {
    const body = (await request.json()) as UpdateMealTypeRequest;
    const client = getSupabaseClient();

    // 如果修改了名称，需要检查唯一性
    if (body.name !== undefined && body.name.trim() !== accessCheck.mealType.name) {
      if (!body.name.trim()) {
        return NextResponse.json<ApiResponse>(
          { success: false, error: '餐别名称不能为空' },
          { status: 400 }
        );
      }

      const { data: existing } = await client
        .from('meal_types')
        .select('id')
        .eq('canteen_id', accessCheck.mealType.canteen_id)
        .eq('name', body.name.trim())
        .eq('is_active', true)
        .maybeSingle();

      if (existing) {
        return NextResponse.json<ApiResponse>(
          { success: false, error: '该食堂下已存在同名餐别' },
          { status: 409 }
        );
      }
    }

    const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (body.name !== undefined) updateData.name = body.name.trim();
    if (body.is_active !== undefined) updateData.is_active = body.is_active;

    const { data, error } = await client
      .from('meal_types')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json<ApiResponse>(
          { success: false, error: '该食堂下已存在同名餐别' },
          { status: 409 }
        );
      }
      return NextResponse.json<ApiResponse>(
        { success: false, error: `更新餐别失败: ${error.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json<ApiResponse>({
      success: true,
      data: data as DbMealType,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : '更新餐别失败';
    return NextResponse.json<ApiResponse>(
      { success: false, error: message },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/meal-types/[id]
 * 软删除餐别（将 is_active 设为 false）
 * 如果已有营收记录引用，提示无法删除
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const currentUser = getCurrentUser(request);
  const roleCheck = requireRoles(currentUser, CAN_MANAGE_MEAL_TYPE);
  if (!roleCheck.ok) return roleCheck.response;

  const { id } = await params;
  const accessCheck = await checkMealTypeAccess(roleCheck.user, id);
  if (!accessCheck.ok) return accessCheck.response;

  try {
    const client = getSupabaseClient();

    // TODO: 当营收记录表创建后，取消注释以下引用校验
    // const { data: revenueRecords } = await client
    //   .from('revenue_records')
    //   .select('id')
    //   .eq('meal_type_id', id)
    //   .limit(1);
    // if (revenueRecords && revenueRecords.length > 0) {
    //   return NextResponse.json<ApiResponse>(
    //     { success: false, error: '该餐别已被使用，无法删除' },
    //     { status: 409 }
    //   );
    // }

    // 软删除
    const { error } = await client
      .from('meal_types')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('id', id);

    if (error) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: `删除餐别失败: ${error.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json<ApiResponse>({
      success: true,
      data: { id, is_active: false },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : '删除餐别失败';
    return NextResponse.json<ApiResponse>(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
