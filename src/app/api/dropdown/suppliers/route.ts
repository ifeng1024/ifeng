import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { getCurrentUser, unauthorized } from '@/lib/auth/guard';
import type { ApiResponse } from '@/lib/auth/types';

/**
 * GET /api/dropdown/suppliers
 * 返回供应商列表（用于下拉选择）
 */
export async function GET(request: NextRequest) {
  const currentUser = getCurrentUser(request);
  if (!currentUser) return unauthorized();

  try {
    const client = getSupabaseClient();
    let query = client.from('suppliers').select('id, name, contact_person, contact_phone').eq('is_active', true);

    // Filter by company
    if (currentUser.role_code === 'COMPANY_MANAGER') {
      query = query.eq('company_id', currentUser.org_id!);
    } else if (currentUser.role_code === 'CANTEEN_MANAGER') {
      // Find company_id from canteen
      const { data: canteen } = await client.from('canteens').select('company_id').eq('id', currentUser.org_id!).maybeSingle();
      if (canteen) query = query.eq('company_id', canteen.company_id);
      else return NextResponse.json<ApiResponse>({ success: true, data: [] });
    } else if (currentUser.role_code === 'STALL_MANAGER') {
      const { data: stall } = await client.from('stalls').select('canteen_id').eq('id', currentUser.org_id!).maybeSingle();
      if (stall) {
        const { data: canteen } = await client.from('canteens').select('company_id').eq('id', stall.canteen_id).maybeSingle();
        if (canteen) query = query.eq('company_id', canteen.company_id);
        else return NextResponse.json<ApiResponse>({ success: true, data: [] });
      } else return NextResponse.json<ApiResponse>({ success: true, data: [] });
    } else {
      // SYSTEM_DEVELOPER sees all
    }

    const { data, error } = await query.order('name');
    if (error) return NextResponse.json<ApiResponse>({ success: false, error: error.message }, { status: 500 });

    return NextResponse.json<ApiResponse>({ success: true, data: data || [] });
  } catch (e) {
    return NextResponse.json<ApiResponse>({ success: false, error: (e as Error).message }, { status: 500 });
  }
}
