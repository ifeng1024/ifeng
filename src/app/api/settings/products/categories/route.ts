import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { getCurrentUser, requireRoles, unauthorized } from '@/lib/auth/guard';
import { CAN_MANAGE_CANTEEN } from '@/lib/auth/constants';
import type { ApiResponse } from '@/lib/auth/types';

/**
 * GET /api/settings/products/categories?company_id=xxx
 * 查询商品大类列表
 */
export async function GET(request: NextRequest) {
  const user = getCurrentUser(request);
  if (!user) return unauthorized();

  const supabase = getSupabaseClient();
  const { searchParams } = new URL(request.url);
  const companyId = searchParams.get('company_id');

  let query = supabase
    .from('product_categories')
    .select('id, name, is_active, created_at')
    .eq('is_active', true)
    .order('name');

  if (user.role_code === 'SYSTEM_DEVELOPER') {
    if (companyId) query = query.eq('company_id', companyId);
  } else if (user.role_code === 'COMPANY_MANAGER') {
    query = query.eq('company_id', user.org_id);
  } else if (user.role_code === 'CANTEEN_MANAGER') {
    // 食堂负责人: 通过食堂查公司
    const { data: canteen } = await supabase.from('canteens').select('company_id').eq('id', user.org_id).maybeSingle();
    if (!canteen) return NextResponse.json<ApiResponse>({ success: false, error: '无法确定所属公司' }, { status: 400 });
    query = query.eq('company_id', canteen.company_id);
  } else if (user.role_code === 'STALL_MANAGER') {
    // 档口负责人: 通过档口→食堂→公司
    const { data: stall } = await supabase.from('stalls').select('canteen_id').eq('id', user.org_id).maybeSingle();
    if (!stall) return NextResponse.json<ApiResponse>({ success: false, error: '无法确定所属公司' }, { status: 400 });
    const { data: canteen } = await supabase.from('canteens').select('company_id').eq('id', stall.canteen_id).maybeSingle();
    if (!canteen) return NextResponse.json<ApiResponse>({ success: false, error: '无法确定所属公司' }, { status: 400 });
    query = query.eq('company_id', canteen.company_id);
  } else {
    return NextResponse.json<ApiResponse>({ success: false, error: '权限不足' }, { status: 403 });
  }

  const { data, error } = await query;
  if (error) return NextResponse.json<ApiResponse>({ success: false, error: error.message }, { status: 500 });
  return NextResponse.json<ApiResponse>({ success: true, data });
}

/**
 * POST /api/settings/products/categories
 * 创建商品大类
 */
export async function POST(request: NextRequest) {
  const currentUser = getCurrentUser(request);
  const roleCheck = requireRoles(currentUser, CAN_MANAGE_CANTEEN);
  if (!roleCheck.ok) return roleCheck.response;

  const body = (await request.json()) as { name?: string; company_id?: string };
  const { name } = body;
  if (!name) return NextResponse.json<ApiResponse>({ success: false, error: '大类名称为必填项' }, { status: 400 });

  const companyId = roleCheck.user.role_code === 'SYSTEM_DEVELOPER'
    ? body.company_id
    : roleCheck.user.org_id;

  if (!companyId) return NextResponse.json<ApiResponse>({ success: false, error: '公司ID为必填项' }, { status: 400 });

  const supabase = getSupabaseClient();

  // 同一公司下名称唯一
  const { data: existing } = await supabase
    .from('product_categories')
    .select('id')
    .eq('company_id', companyId)
    .eq('name', name)
    .eq('is_active', true)
    .maybeSingle();

  if (existing) return NextResponse.json<ApiResponse>({ success: false, error: '该大类名称已存在' }, { status: 409 });

  const { data, error } = await supabase
    .from('product_categories')
    .insert({ company_id: companyId, name })
    .select()
    .single();

  if (error) return NextResponse.json<ApiResponse>({ success: false, error: error.message }, { status: 500 });
  return NextResponse.json<ApiResponse>({ success: true, data });
}
