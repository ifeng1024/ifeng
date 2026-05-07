import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { getCurrentUser, unauthorized } from '@/lib/auth/guard';
import type { ApiResponse } from '@/lib/auth/types';

/**
 * GET /api/suppliers - 获取供应商列表
 * POST /api/suppliers - 创建供应商
 */
export async function GET(request: NextRequest) {
  const user = getCurrentUser(request);
  if (!user) return unauthorized();

  const supabase = getSupabaseClient();

  try {
    let companyId = '';
    if (user.role_code === 'COMPANY_MANAGER') {
      companyId = user.org_id!;
    } else if (user.role_code === 'CANTEEN_MANAGER' || user.role_code === 'STALL_MANAGER') {
      // Find company via canteen
      const canteenId = user.role_code === 'CANTEEN_MANAGER' ? user.org_id : null;
      if (canteenId) {
        const { data: canteen } = await supabase.from('canteens').select('company_id').eq('id', canteenId).maybeSingle();
        companyId = canteen?.company_id || '';
      } else {
        // STALL_MANAGER: find canteen via stall
        const { data: stall } = await supabase.from('stalls').select('canteen_id').eq('id', user.org_id!).maybeSingle();
        if (stall) {
          const { data: canteen } = await supabase.from('canteens').select('company_id').eq('id', stall.canteen_id).maybeSingle();
          companyId = canteen?.company_id || '';
        }
      }
    } else if (user.role_code === 'SYSTEM_DEVELOPER') {
      // Developer sees all
      const { data, error } = await supabase.from('suppliers').select('*').eq('is_active', true).order('name');
      if (error) return NextResponse.json<ApiResponse>({ success: false, error: error.message }, { status: 500 });
      return NextResponse.json<ApiResponse>({ success: true, data: data || [] });
    }

    if (!companyId) {
      return NextResponse.json<ApiResponse>({ success: true, data: [] });
    }

    const { data, error } = await supabase.from('suppliers').select('*').eq('company_id', companyId).eq('is_active', true).order('name');
    if (error) return NextResponse.json<ApiResponse>({ success: false, error: error.message }, { status: 500 });

    return NextResponse.json<ApiResponse>({ success: true, data: data || [] });
  } catch (err) {
    const message = err instanceof Error ? err.message : '查询供应商失败';
    return NextResponse.json<ApiResponse>({ success: false, error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const user = getCurrentUser(request);
  if (!user) return unauthorized();

  const supabase = getSupabaseClient();

  try {
    const body = await request.json();
    const { name, contact_person, contact_phone, address, note } = body;

    if (!name) {
      return NextResponse.json<ApiResponse>({ success: false, error: '供应商名称不能为空' }, { status: 400 });
    }

    // Get company_id
    let companyId = '';
    if (user.role_code === 'COMPANY_MANAGER') {
      companyId = user.org_id!;
    } else if (user.role_code === 'CANTEEN_MANAGER') {
      const { data: canteen } = await supabase.from('canteens').select('company_id').eq('id', user.org_id!).maybeSingle();
      companyId = canteen?.company_id || '';
    } else if (user.role_code === 'STALL_MANAGER') {
      const { data: stall } = await supabase.from('stalls').select('canteen_id').eq('id', user.org_id!).maybeSingle();
      if (stall) {
        const { data: canteen } = await supabase.from('canteens').select('company_id').eq('id', stall.canteen_id).maybeSingle();
        companyId = canteen?.company_id || '';
      }
    }

    if (!companyId) {
      return NextResponse.json<ApiResponse>({ success: false, error: '无法确定公司' }, { status: 400 });
    }

    const { data, error } = await supabase.from('suppliers').insert({
      company_id: companyId,
      name,
      contact_person: contact_person || null,
      contact_phone: contact_phone || null,
      address: address || null,
      note: note || null,
    }).select().single();

    if (error) return NextResponse.json<ApiResponse>({ success: false, error: error.message }, { status: 500 });

    return NextResponse.json<ApiResponse>({ success: true, data });
  } catch (err) {
    const message = err instanceof Error ? err.message : '创建供应商失败';
    return NextResponse.json<ApiResponse>({ success: false, error: message }, { status: 500 });
  }
}
