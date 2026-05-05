import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { getCurrentUser, requireRoles, checkCanteenAccess, CAN_MANAGE_STALL, unauthorized } from '@/lib/auth/guard';
import type { ApiResponse, CreateStallRequest, DbStall } from '@/lib/auth/types';

/**
 * POST /api/canteens/[id]/stalls
 * 在指定食堂下创建档口
 * 权限：SYSTEM_DEVELOPER 全局，CANTEEN_MANAGER 仅自己食堂
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const currentUser = getCurrentUser(request);
  const roleCheck = requireRoles(currentUser, CAN_MANAGE_STALL);
  if (!roleCheck.ok) return roleCheck.response;

  const { id: canteenId } = await params;

  // 校验食堂归属权
  const accessCheck = await checkCanteenAccess(roleCheck.user, canteenId);
  if (!accessCheck.ok) return accessCheck.response;

  try {
    const body = (await request.json()) as CreateStallRequest;

    if (!body.name?.trim()) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: '档口名称不能为空' },
        { status: 400 }
      );
    }

    const client = getSupabaseClient();

    // 创建档口
    const { data, error } = await client
      .from('stalls')
      .insert({
        canteen_id: canteenId,
        name: body.name.trim(),
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: `创建档口失败: ${error.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json<ApiResponse>(
      { success: true, data: data as DbStall },
      { status: 201 }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : '创建档口失败';
    return NextResponse.json<ApiResponse>(
      { success: false, error: message },
      { status: 500 }
    );
  }
}

/**
 * GET /api/canteens/[id]/stalls
 * 获取指定食堂下的档口列表
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const currentUser = getCurrentUser(request);
  if (!currentUser) return unauthorized();

  const { id: canteenId } = await params;

  // 校验食堂归属权
  const accessCheck = await checkCanteenAccess(currentUser, canteenId);
  if (!accessCheck.ok) return accessCheck.response;

  try {
    const client = getSupabaseClient();
    const { data, error } = await client
      .from('stalls')
      .select('id, canteen_id, name, manager_id, is_active, created_at')
      .eq('canteen_id', canteenId)
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: `查询失败: ${error.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json<ApiResponse>({ success: true, data });
  } catch (err) {
    const message = err instanceof Error ? err.message : '查询失败';
    return NextResponse.json<ApiResponse>(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
