import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { getCurrentUser, requireRoles, CAN_CREATE_COMPANY, unauthorized } from '@/lib/auth/guard';
import type { ApiResponse } from '@/lib/auth/types';

/**
 * PUT /api/companies/[id]
 * 更新公司信息（名称、地址、联系电话）
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = getCurrentUser(request);
  if (!user) return unauthorized();

  const roleCheck = requireRoles(user, CAN_CREATE_COMPANY);
  if (!roleCheck.ok) return roleCheck.response;

  const { id } = await params;
  const body = (await request.json()) as Record<string, unknown>;

  const updateData: Record<string, unknown> = {};
  if (body.name !== undefined) updateData.name = body.name;
  if (body.address !== undefined) updateData.address = body.address;
  if (body.contact_phone !== undefined) updateData.contact_phone = body.contact_phone;

  if (Object.keys(updateData).length === 0) {
    return NextResponse.json<ApiResponse>({ success: false, error: '没有可更新的字段' }, { status: 400 });
  }

  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('companies')
    .update(updateData)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    return NextResponse.json<ApiResponse>({ success: false, error: `更新失败: ${error.message}` }, { status: 500 });
  }

  return NextResponse.json<ApiResponse>({ success: true, data });
}

/**
 * GET /api/companies/[id]
 * 获取单个公司详情
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = getCurrentUser(request);
  if (!user) return unauthorized();

  const { id } = await params;
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('companies')
    .select('id, name, address, contact_phone, manager_id, is_active, created_at')
    .eq('id', id)
    .maybeSingle();

  if (error || !data) {
    return NextResponse.json<ApiResponse>({ success: false, error: '公司不存在' }, { status: 404 });
  }

  return NextResponse.json<ApiResponse>({ success: true, data });
}
