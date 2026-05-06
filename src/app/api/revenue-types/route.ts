import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { getCurrentUser, requireRoles, checkCanteenAccess, unauthorized } from '@/lib/auth/guard';
import { CAN_MANAGE_REVENUE_TYPE, RoleCode } from '@/lib/auth/constants';
import type { ApiResponse, CreateRevenueTypeRequest, DbRevenueType } from '@/lib/auth/types';

/**
 * POST /api/revenue-types
 * 创建营收类型
 * 权限：SYSTEM_DEVELOPER 全局，COMPANY_MANAGER / CANTEEN_MANAGER 仅自己管辖范围
 */
export async function POST(request: NextRequest) {
  const currentUser = getCurrentUser(request);
  const roleCheck = requireRoles(currentUser, CAN_MANAGE_REVENUE_TYPE);
  if (!roleCheck.ok) return roleCheck.response;

  try {
    const body = (await request.json()) as CreateRevenueTypeRequest;

    if (!body.canteen_id?.trim()) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: '食堂ID不能为空' },
        { status: 400 }
      );
    }

    if (!body.name?.trim()) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: '营收类型名称不能为空' },
        { status: 400 }
      );
    }

    // 校验食堂归属权
    const accessCheck = await checkCanteenAccess(roleCheck.user, body.canteen_id);
    if (!accessCheck.ok) return accessCheck.response;

    const client = getSupabaseClient();

    // 检查同一食堂下是否已存在同名营收类型
    const { data: existing, error: checkError } = await client
      .from('revenue_types')
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
        { success: false, error: '该食堂下已存在同名营收类型' },
        { status: 409 }
      );
    }

    const { data, error } = await client
      .from('revenue_types')
      .insert({
        canteen_id: body.canteen_id,
        name: body.name.trim(),
      })
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
        { success: false, error: `创建营收类型失败: ${error.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json<ApiResponse>(
      { success: true, data: data as DbRevenueType },
      { status: 201 }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : '创建营收类型失败';
    return NextResponse.json<ApiResponse>(
      { success: false, error: message },
      { status: 500 }
    );
  }
}

/**
 * GET /api/revenue-types?canteen_id=xxx
 * 查询营收类型列表
 */
export async function GET(request: NextRequest) {
  const currentUser = getCurrentUser(request);
  if (!currentUser) return unauthorized();

  try {
    const { searchParams } = new URL(request.url);
    const canteenId = searchParams.get('canteen_id');

    const client = getSupabaseClient();
    let query = client
      .from('revenue_types')
      .select('*')
      .eq('is_active', true)
      .order('created_at', { ascending: true });

    if (canteenId) {
      const accessCheck = await checkCanteenAccess(currentUser, canteenId);
      if (!accessCheck.ok) return accessCheck.response;

      query = query.eq('canteen_id', canteenId);
    } else {
      if (currentUser.role_code === RoleCode.COMPANY_MANAGER) {
        const { data: canteens } = await client
          .from('canteens')
          .select('id')
          .eq('company_id', currentUser.org_id!);
        if (!canteens?.length) {
          return NextResponse.json<ApiResponse>({ success: true, data: [] });
        }
        query = query.in('canteen_id', canteens.map((c) => c.id));
      } else if (currentUser.role_code === RoleCode.CANTEEN_MANAGER) {
        query = query.eq('canteen_id', currentUser.org_id!);
      } else if (currentUser.role_code === RoleCode.STALL_MANAGER) {
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
    }

    const { data, error } = await query;

    if (error) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: `查询营收类型失败: ${error.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json<ApiResponse>({
      success: true,
      data: (data || []) as DbRevenueType[],
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : '查询营收类型失败';
    return NextResponse.json<ApiResponse>(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
