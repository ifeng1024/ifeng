import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { getCurrentUser, requireRoles, unauthorized } from '@/lib/auth/guard';
import { CAN_MANAGE_CANTEEN } from '@/lib/auth/constants';
import type { ApiResponse } from '@/lib/auth/types';

/**
 * GET /api/settings/products/specs?product_id=xxx
 * 查询商品规格列表
 */
export async function GET(request: NextRequest) {
  const user = getCurrentUser(request);
  if (!user) return unauthorized();

  const supabase = getSupabaseClient();
  const { searchParams } = new URL(request.url);
  const productId = searchParams.get('product_id');

  if (!productId) return NextResponse.json<ApiResponse>({ success: true, data: [] });

  const { data, error } = await supabase
    .from('product_specs')
    .select('id, product_id, name, is_active, created_at')
    .eq('product_id', productId)
    .eq('is_active', true)
    .order('name');

  if (error) return NextResponse.json<ApiResponse>({ success: false, error: error.message }, { status: 500 });
  return NextResponse.json<ApiResponse>({ success: true, data });
}

/**
 * POST /api/settings/products/specs
 * 创建商品规格
 */
export async function POST(request: NextRequest) {
  const currentUser = getCurrentUser(request);
  const roleCheck = requireRoles(currentUser, CAN_MANAGE_CANTEEN);
  if (!roleCheck.ok) return roleCheck.response;

  const body = (await request.json()) as { product_id?: string; name?: string };
  const { product_id, name } = body;
  if (!product_id || !name) {
    return NextResponse.json<ApiResponse>({ success: false, error: '商品和规格名称为必填项' }, { status: 400 });
  }

  const supabase = getSupabaseClient();

  // 同一商品下规格名称唯一
  const { data: existing } = await supabase
    .from('product_specs')
    .select('id')
    .eq('product_id', product_id)
    .eq('name', name)
    .eq('is_active', true)
    .maybeSingle();

  if (existing) return NextResponse.json<ApiResponse>({ success: false, error: '该规格名称已存在' }, { status: 409 });

  const { data, error } = await supabase
    .from('product_specs')
    .insert({ product_id, name })
    .select()
    .single();

  if (error) return NextResponse.json<ApiResponse>({ success: false, error: error.message }, { status: 500 });
  return NextResponse.json<ApiResponse>({ success: true, data });
}
