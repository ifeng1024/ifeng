import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { getCurrentUser, unauthorized } from '@/lib/auth/guard';
import type { ApiResponse, DbCanteen } from '@/lib/auth/types';
import { RoleCode } from '@/lib/auth/constants';

/**
 * GET /api/dropdown/canteens
 * 按当前用户权限返回可访问的食堂列表（用于下拉选择）
 *
 * 权限规则：
 * - SYSTEM_DEVELOPER: 返回所有食堂
 * - COMPANY_MANAGER: 返回该公司下所有食堂
 * - CANTEEN_MANAGER: 仅返回自己管理的食堂（只有一个选项）
 * - STALL_MANAGER: 仅返回自己所属的食堂（锁定不可改）
 * - REGULAR_USER: 无食堂
 */
export async function GET(request: NextRequest) {
  const currentUser = getCurrentUser(request);
  if (!currentUser) return unauthorized();

  try {
    const client = getSupabaseClient();

    if (currentUser.role_code === RoleCode.SYSTEM_DEVELOPER) {
      const { data, error } = await client
        .from('canteens')
        .select('id, company_id, name')
        .eq('is_active', true)
        .order('name');

      if (error) {
        return NextResponse.json<ApiResponse>(
          { success: false, error: `查询食堂失败: ${error.message}` },
          { status: 500 }
        );
      }

      return NextResponse.json<ApiResponse>({ success: true, data: data || [] });
    }

    if (currentUser.role_code === RoleCode.COMPANY_MANAGER) {
      const { data, error } = await client
        .from('canteens')
        .select('id, company_id, name')
        .eq('company_id', currentUser.org_id!)
        .eq('is_active', true)
        .order('name');

      if (error) {
        return NextResponse.json<ApiResponse>(
          { success: false, error: `查询食堂失败: ${error.message}` },
          { status: 500 }
        );
      }

      return NextResponse.json<ApiResponse>({ success: true, data: data || [] });
    }

    if (currentUser.role_code === RoleCode.CANTEEN_MANAGER) {
      const { data, error } = await client
        .from('canteens')
        .select('id, company_id, name')
        .eq('id', currentUser.org_id!)
        .eq('is_active', true)
        .maybeSingle();

      if (error) {
        return NextResponse.json<ApiResponse>(
          { success: false, error: `查询食堂失败: ${error.message}` },
          { status: 500 }
        );
      }

      return NextResponse.json<ApiResponse>({
        success: true,
        data: data ? [data] : [],
      });
    }

    if (currentUser.role_code === RoleCode.STALL_MANAGER) {
      // 先查档口所属食堂
      const { data: stall, error: stallError } = await client
        .from('stalls')
        .select('canteen_id')
        .eq('id', currentUser.org_id!)
        .maybeSingle();

      if (stallError || !stall) {
        return NextResponse.json<ApiResponse>({ success: true, data: [] });
      }

      const { data, error } = await client
        .from('canteens')
        .select('id, company_id, name')
        .eq('id', stall.canteen_id)
        .eq('is_active', true)
        .maybeSingle();

      if (error) {
        return NextResponse.json<ApiResponse>(
          { success: false, error: `查询食堂失败: ${error.message}` },
          { status: 500 }
        );
      }

      return NextResponse.json<ApiResponse>({
        success: true,
        data: data ? [data] : [],
      });
    }

    // REGULAR_USER 无食堂
    return NextResponse.json<ApiResponse>({ success: true, data: [] });
  } catch (err) {
    const message = err instanceof Error ? err.message : '查询食堂失败';
    return NextResponse.json<ApiResponse>(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
