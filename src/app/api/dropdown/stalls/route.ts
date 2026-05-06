import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { getCurrentUser, checkCanteenAccess, unauthorized } from '@/lib/auth/guard';
import type { ApiResponse, DbStall } from '@/lib/auth/types';
import { RoleCode } from '@/lib/auth/constants';

/**
 * GET /api/dropdown/stalls?canteen_id=xxx
 * 根据食堂ID查询档口列表（用于下拉选择，按权限过滤）
 *
 * 权限规则：
 * - SYSTEM_DEVELOPER / COMPANY_MANAGER / CANTEEN_MANAGER: 返回该食堂下所有档口
 * - STALL_MANAGER: 仅返回自己所在档口
 */
export async function GET(request: NextRequest) {
  const currentUser = getCurrentUser(request);
  if (!currentUser) return unauthorized();

  try {
    const { searchParams } = new URL(request.url);
    const canteenId = searchParams.get('canteen_id');

    if (!canteenId) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: '食堂ID不能为空' },
        { status: 400 }
      );
    }

    // 校验食堂归属权
    const accessCheck = await checkCanteenAccess(currentUser, canteenId);
    if (!accessCheck.ok) return accessCheck.response;

    const client = getSupabaseClient();

    // STALL_MANAGER 只能看自己的档口
    if (currentUser.role_code === RoleCode.STALL_MANAGER) {
      const { data, error } = await client
        .from('stalls')
        .select('id, canteen_id, name')
        .eq('id', currentUser.org_id!)
        .eq('is_active', true)
        .maybeSingle();

      if (error) {
        return NextResponse.json<ApiResponse>(
          { success: false, error: `查询档口失败: ${error.message}` },
          { status: 500 }
        );
      }

      return NextResponse.json<ApiResponse>({
        success: true,
        data: data ? [data] : [],
      });
    }

    // 其他角色：返回该食堂下所有档口
    const { data, error } = await client
      .from('stalls')
      .select('id, canteen_id, name')
      .eq('canteen_id', canteenId)
      .eq('is_active', true)
      .order('name');

    if (error) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: `查询档口失败: ${error.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json<ApiResponse>({ success: true, data: data || [] });
  } catch (err) {
    const message = err instanceof Error ? err.message : '查询档口失败';
    return NextResponse.json<ApiResponse>(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
