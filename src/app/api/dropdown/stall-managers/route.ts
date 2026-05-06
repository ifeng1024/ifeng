import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { getCurrentUser, unauthorized } from '@/lib/auth/guard';
import { RoleCode } from '@/lib/auth/constants';
import type { ApiResponse } from '@/lib/auth/types';

/**
 * GET /api/dropdown/stall-managers?canteen_id=xxx
 * 获取档口负责人下拉列表（按权限过滤）
 */
export async function GET(request: NextRequest) {
  const user = getCurrentUser(request);
  if (!user) return unauthorized();

  try {
    const supabase = getSupabaseClient();
    const { searchParams } = new URL(request.url);
    const canteenId = searchParams.get('canteen_id');

    let query = supabase
      .from('users')
      .select('id, username, real_name, org_id')
      .eq('role_code', RoleCode.STALL_MANAGER)
      .eq('is_disabled', false)
      .order('real_name');

    // If canteen_id provided, filter by stall managers belonging to stalls under this canteen
    if (canteenId) {
      // Get stall IDs under this canteen
      const { data: stalls } = await supabase
        .from('stalls')
        .select('id')
        .eq('canteen_id', canteenId);

      if (stalls && stalls.length > 0) {
        const stallIds = stalls.map((s: { id: string }) => s.id);
        query = query.in('org_id', stallIds);
      } else {
        // No stalls under this canteen, return empty but also include unassigned
        query = query.is('org_id', null);
      }
    }

    // Also include unassigned stall managers
    const { data: assigned, error: err1 } = await query;
    const { data: unassigned, error: err2 } = await supabase
      .from('users')
      .select('id, username, real_name, org_id')
      .eq('role_code', RoleCode.STALL_MANAGER)
      .eq('is_disabled', false)
      .is('org_id', null)
      .order('real_name');

    if (err1 || err2) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: '查询失败' },
        { status: 500 }
      );
    }

    // Merge and deduplicate
    const map = new Map<string, { id: string; username: string; real_name: string | null; org_id: string | null }>();
    for (const u of [...(assigned || []), ...(unassigned || [])]) {
      if (!map.has(u.id)) map.set(u.id, u);
    }

    return NextResponse.json<ApiResponse>({
      success: true,
      data: Array.from(map.values()),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : '查询失败';
    return NextResponse.json<ApiResponse>(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
