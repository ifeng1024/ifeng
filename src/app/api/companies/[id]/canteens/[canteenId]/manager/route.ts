import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { getCurrentUser, requireRoles, checkCompanyAccess, CAN_MANAGE_CANTEEN } from '@/lib/auth/guard';
import type { ApiResponse, AssignCanteenManagerRequest, DbCanteen } from '@/lib/auth/types';

/**
 * PUT /api/companies/[id]/canteens/[canteenId]/manager
 * 指定食堂负责人
 * 权限：SYSTEM_DEVELOPER 全局，COMPANY_MANAGER 仅自己公司下的食堂
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; canteenId: string }> }
) {
  const currentUser = getCurrentUser(request);
  const roleCheck = requireRoles(currentUser, CAN_MANAGE_CANTEEN);
  if (!roleCheck.ok) return roleCheck.response;

  const { id: companyId, canteenId } = await params;

  // 校验公司归属权
  const accessCheck = await checkCompanyAccess(roleCheck.user, companyId);
  if (!accessCheck.ok) return accessCheck.response;

  try {
    const body = (await request.json()) as AssignCanteenManagerRequest;

    if (!body.user_id) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'user_id 不能为空' },
        { status: 400 }
      );
    }

    const client = getSupabaseClient();

    // 确认食堂存在且属于该公司
    const { data: canteen, error: canteenError } = await client
      .from('canteens')
      .select('id, company_id')
      .eq('id', canteenId)
      .eq('company_id', companyId)
      .maybeSingle();

    if (canteenError || !canteen) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: '食堂不存在或不属于该公司' },
        { status: 404 }
      );
    }

    // 确认目标用户存在且角色为食堂负责人
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

    if (targetUser.role_code !== 'CANTEEN_MANAGER') {
      return NextResponse.json<ApiResponse>(
        { success: false, error: '目标用户角色不是食堂负责人' },
        { status: 400 }
      );
    }

    // 更新食堂的 manager_id
    const { data, error } = await client
      .from('canteens')
      .update({ manager_id: body.user_id })
      .eq('id', canteenId)
      .select()
      .single();

    if (error) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: `指定负责人失败: ${error.message}` },
        { status: 500 }
      );
    }

    // 同步更新用户的 org_id 指向该食堂
    await client
      .from('users')
      .update({ org_id: canteenId })
      .eq('id', body.user_id);

    return NextResponse.json<ApiResponse>({
      success: true,
      data: data as DbCanteen,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : '指定负责人失败';
    return NextResponse.json<ApiResponse>(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
