import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { getCurrentUser, checkCanteenAccess, unauthorized } from '@/lib/auth/guard';
import type { ApiResponse } from '@/lib/auth/types';
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

    const client = getSupabaseClient();

    // STALL_MANAGER only sees their own stall
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

    // For other roles: if canteen_id provided, filter by it
    if (canteenId) {
      const accessCheck = await checkCanteenAccess(currentUser, canteenId);
      if (!accessCheck.ok) return accessCheck.response;

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
    }

    // No canteen_id: return all stalls accessible to the user
    let canteenIds: string[] = [];
    if (currentUser.role_code === RoleCode.SYSTEM_DEVELOPER) {
      const { data } = await client.from('canteens').select('id').eq('is_active', true);
      canteenIds = (data || []).map((c: { id: string }) => c.id);
    } else if (currentUser.role_code === RoleCode.COMPANY_MANAGER) {
      const { data } = await client.from('canteens').select('id').eq('company_id', currentUser.org_id!).eq('is_active', true);
      canteenIds = (data || []).map((c: { id: string }) => c.id);
    } else if (currentUser.role_code === RoleCode.CANTEEN_MANAGER) {
      canteenIds = currentUser.org_id ? [currentUser.org_id] : [];
    }

    if (canteenIds.length === 0) {
      return NextResponse.json<ApiResponse>({ success: true, data: [] });
    }

    const { data, error } = await client
      .from('stalls')
      .select('id, canteen_id, name')
      .in('canteen_id', canteenIds)
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
