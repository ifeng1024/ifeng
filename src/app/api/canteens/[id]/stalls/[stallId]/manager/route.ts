import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { getCurrentUser, requireRoles, checkCanteenAccess, CAN_MANAGE_STALL } from '@/lib/auth/guard';
import type { ApiResponse, AssignStallManagerRequest, DbStall } from '@/lib/auth/types';

/**
 * PUT /api/canteens/[id]/stalls/[stallId]/manager
 * 指定档口负责人
 * 权限：SYSTEM_DEVELOPER 全局，CANTEEN_MANAGER 仅自己食堂下的档口
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; stallId: string }> }
) {
  const currentUser = getCurrentUser(request);
  const roleCheck = requireRoles(currentUser, CAN_MANAGE_STALL);
  if (!roleCheck.ok) return roleCheck.response;

  const { id: canteenId, stallId } = await params;

  // 校验食堂归属权
  const accessCheck = await checkCanteenAccess(roleCheck.user, canteenId);
  if (!accessCheck.ok) return accessCheck.response;

  try {
    const body = (await request.json()) as AssignStallManagerRequest;

    if (!body.user_id) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'user_id 不能为空' },
        { status: 400 }
      );
    }

    const client = getSupabaseClient();

    // 确认档口存在且属于该食堂
    const { data: stall, error: stallError } = await client
      .from('stalls')
      .select('id, canteen_id')
      .eq('id', stallId)
      .eq('canteen_id', canteenId)
      .maybeSingle();

    if (stallError || !stall) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: '档口不存在或不属于该食堂' },
        { status: 404 }
      );
    }

    // 确认目标用户存在且角色为档口负责人
    const { data: targetUser, error: userError } = await client
      .from('users')
      .select('id, role_code, is_active')
      .eq('id', body.user_id)
      .maybeSingle();

    if (userError || !targetUser) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: '目标用户不存在' },
        { status: 404 }
      );
    }

    if (!targetUser.is_active) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: '目标用户已被禁用' },
        { status: 400 }
      );
    }

    if (targetUser.role_code !== 'STALL_MANAGER') {
      return NextResponse.json<ApiResponse>(
        { success: false, error: '目标用户角色不是档口负责人' },
        { status: 400 }
      );
    }

    // 更新档口的 manager_id
    const { data, error } = await client
      .from('stalls')
      .update({ manager_id: body.user_id })
      .eq('id', stallId)
      .select()
      .single();

    if (error) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: `指定负责人失败: ${error.message}` },
        { status: 500 }
      );
    }

    // 同步更新用户的 org_id 指向该档口
    await client
      .from('users')
      .update({ org_id: stallId })
      .eq('id', body.user_id);

    return NextResponse.json<ApiResponse>({
      success: true,
      data: data as DbStall,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : '指定负责人失败';
    return NextResponse.json<ApiResponse>(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
