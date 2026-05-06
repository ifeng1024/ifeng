import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { getCurrentUser, requireRoles, checkCanteenAccess, unauthorized } from '@/lib/auth/guard';
import { CAN_MANAGE_MEAL_TYPE, RoleCode } from '@/lib/auth/constants';
import type { ApiResponse, CreateMealTypeRequest, DbMealType } from '@/lib/auth/types';

/**
 * POST /api/meal-types
 * 创建餐别
 * 权限：SYSTEM_DEVELOPER 全局，COMPANY_MANAGER / CANTEEN_MANAGER 仅自己管辖范围
 */
export async function POST(request: NextRequest) {
  const currentUser = getCurrentUser(request);
  const roleCheck = requireRoles(currentUser, CAN_MANAGE_MEAL_TYPE);
  if (!roleCheck.ok) return roleCheck.response;

  try {
    const body = (await request.json()) as CreateMealTypeRequest;

    if (!body.canteen_id?.trim()) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: '食堂ID不能为空' },
        { status: 400 }
      );
    }

    if (!body.name?.trim()) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: '餐别名称不能为空' },
        { status: 400 }
      );
    }

    // 校验食堂归属权
    const accessCheck = await checkCanteenAccess(roleCheck.user, body.canteen_id);
    if (!accessCheck.ok) return accessCheck.response;

    const client = getSupabaseClient();

    // 检查同一食堂下是否已存在同名餐别（仅 is_active=true）
    const { data: existing, error: checkError } = await client
      .from('meal_types')
      .select('id')
      .eq('canteen_id', body.canteen_id)
      .eq('name', body.name.trim())
      .eq('is_active', true)
      .maybeSingle();

    if (checkError) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: `查询失败: ${checkError.message}` },
        { status: 500 }
      );
    }

    if (existing) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: '该食堂下已存在同名餐别' },
        { status: 409 }
      );
    }

    // 创建餐别
    const { data, error } = await client
      .from('meal_types')
      .insert({
        canteen_id: body.canteen_id,
        name: body.name.trim(),
      })
      .select()
      .single();

    if (error) {
      // 处理数据库层面的唯一约束冲突
      if (error.code === '23505') {
        return NextResponse.json<ApiResponse>(
          { success: false, error: '该食堂下已存在同名餐别' },
          { status: 409 }
        );
      }
      return NextResponse.json<ApiResponse>(
        { success: false, error: `创建餐别失败: ${error.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json<ApiResponse>(
      { success: true, data: data as DbMealType },
      { status: 201 }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : '创建餐别失败';
    return NextResponse.json<ApiResponse>(
      { success: false, error: message },
      { status: 500 }
    );
  }
}

/**
 * GET /api/meal-types?canteen_id=xxx
 * 查询餐别列表
 * - 不传 canteen_id：管理员返回所有，其他人返回自己管辖范围
 * - 传 canteen_id：按权限校验后返回该食堂的餐别
 */
export async function GET(request: NextRequest) {
  const currentUser = getCurrentUser(request);
  if (!currentUser) return unauthorized();

  try {
    const { searchParams } = new URL(request.url);
    const canteenId = searchParams.get('canteen_id');

    const client = getSupabaseClient();
    let query = client
      .from('meal_types')
      .select('*')
      .eq('is_active', true)
      .order('created_at', { ascending: true });

    if (canteenId) {
      // 指定食堂：需校验归属权
      const accessCheck = await checkCanteenAccess(currentUser, canteenId);
      if (!accessCheck.ok) return accessCheck.response;

      query = query.eq('canteen_id', canteenId);
    } else {
      // 未指定食堂：按角色权限过滤
      if (currentUser.role_code === RoleCode.COMPANY_MANAGER) {
        // 公司负责人：查询自己公司下所有食堂的餐别
        const { data: canteens } = await client
          .from('canteens')
          .select('id')
          .eq('company_id', currentUser.org_id!);
        if (!canteens?.length) {
          return NextResponse.json<ApiResponse>({ success: true, data: [] });
        }
        query = query.in('canteen_id', canteens.map((c) => c.id));
      } else if (currentUser.role_code === RoleCode.CANTEEN_MANAGER) {
        // 食堂负责人：仅自己食堂
        query = query.eq('canteen_id', currentUser.org_id!);
      } else if (currentUser.role_code === RoleCode.STALL_MANAGER) {
        // 档口负责人：查自己所属食堂
        const { data: stall } = await client
          .from('stalls')
          .select('canteen_id')
          .eq('id', currentUser.org_id!)
          .maybeSingle();
        if (!stall) {
          return NextResponse.json<ApiResponse>({ success: true, data: [] });
        }
        query = query.eq('canteen_id', stall.canteen_id);
      }
      // SYSTEM_DEVELOPER 不做过滤，返回所有
    }

    const { data, error } = await query;

    if (error) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: `查询餐别失败: ${error.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json<ApiResponse>({
      success: true,
      data: (data || []) as DbMealType[],
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : '查询餐别失败';
    return NextResponse.json<ApiResponse>(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
