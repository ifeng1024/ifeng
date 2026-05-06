import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { getCurrentUser, requireRoles } from '@/lib/auth/guard';
import { CAN_MANAGE_CANTEEN } from '@/lib/auth/constants';
import type { ApiResponse } from '@/lib/auth/types';

/**
 * PUT /api/settings/products/[id]
 * 编辑商品
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const currentUser = getCurrentUser(request);
  const roleCheck = requireRoles(currentUser, CAN_MANAGE_CANTEEN);
  if (!roleCheck.ok) return roleCheck.response;

  const { id } = await params;
  const body = (await request.json()) as { name?: string };
  const { name } = body;
  if (!name) return NextResponse.json<ApiResponse>({ success: false, error: '商品名称为必填项' }, { status: 400 });

  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from('products')
    .update({ name, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('is_active', true)
    .select()
    .single();

  if (error) return NextResponse.json<ApiResponse>({ success: false, error: error.message }, { status: 500 });
  return NextResponse.json<ApiResponse>({ success: true, data });
}

/**
 * DELETE /api/settings/products/[id]
 * 软删除商品
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const currentUser = getCurrentUser(request);
  const roleCheck = requireRoles(currentUser, CAN_MANAGE_CANTEEN);
  if (!roleCheck.ok) return roleCheck.response;

  const { id } = await params;
  const supabase = getSupabaseClient();

  const { error } = await supabase
    .from('products')
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq('id', id);

  if (error) return NextResponse.json<ApiResponse>({ success: false, error: error.message }, { status: 500 });
  return NextResponse.json<ApiResponse>({ success: true, data: { message: '已删除' } });
}
