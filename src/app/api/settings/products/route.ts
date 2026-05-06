import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { getCurrentUser, requireRoles, unauthorized } from '@/lib/auth/guard';
import { CAN_MANAGE_CANTEEN } from '@/lib/auth/constants';
import type { ApiResponse } from '@/lib/auth/types';

/**
 * GET /api/settings/products?category_id=xxx
 * 查询商品列表（按大类筛选）
 */
export async function GET(request: NextRequest) {
  const user = getCurrentUser(request);
  if (!user) return unauthorized();

  const supabase = getSupabaseClient();
  const { searchParams } = new URL(request.url);
  const categoryId = searchParams.get('category_id');

  if (!categoryId) {
    return NextResponse.json<ApiResponse>({ success: true, data: [] });
  }

  const { data, error } = await supabase
    .from('products')
    .select('id, category_id, name, is_active, created_at')
    .eq('category_id', categoryId)
    .eq('is_active', true)
    .order('name');

  if (error) return NextResponse.json<ApiResponse>({ success: false, error: error.message }, { status: 500 });
  return NextResponse.json<ApiResponse>({ success: true, data });
}

/**
 * POST /api/settings/products
 * 创建商品
 */
export async function POST(request: NextRequest) {
  const currentUser = getCurrentUser(request);
  const roleCheck = requireRoles(currentUser, CAN_MANAGE_CANTEEN);
  if (!roleCheck.ok) return roleCheck.response;

  const body = (await request.json()) as { category_id?: string; name?: string };
  const { category_id, name } = body;
  if (!category_id || !name) {
    return NextResponse.json<ApiResponse>({ success: false, error: '大类和商品名称为必填项' }, { status: 400 });
  }

  const supabase = getSupabaseClient();

  // 同一大类下名称唯一
  const { data: existing } = await supabase
    .from('products')
    .select('id')
    .eq('category_id', category_id)
    .eq('name', name)
    .eq('is_active', true)
    .maybeSingle();

  if (existing) return NextResponse.json<ApiResponse>({ success: false, error: '该商品名称已存在' }, { status: 409 });

  const { data, error } = await supabase
    .from('products')
    .insert({ category_id, name })
    .select()
    .single();

  if (error) return NextResponse.json<ApiResponse>({ success: false, error: error.message }, { status: 500 });
  return NextResponse.json<ApiResponse>({ success: true, data });
}
