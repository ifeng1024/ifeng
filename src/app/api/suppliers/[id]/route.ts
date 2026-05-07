import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { getCurrentUser, unauthorized } from '@/lib/auth/guard';
import type { ApiResponse } from '@/lib/auth/types';

/**
 * PUT /api/suppliers/[id] - 编辑供应商
 * DELETE /api/suppliers/[id] - 删除供应商
 */
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = getCurrentUser(request);
  if (!user) return unauthorized();

  const { id } = await params;
  const supabase = getSupabaseClient();

  try {
    const body = await request.json();
    const { name, contact_person, contact_phone, address, note } = body;

    const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (name !== undefined) updateData.name = name;
    if (contact_person !== undefined) updateData.contact_person = contact_person;
    if (contact_phone !== undefined) updateData.contact_phone = contact_phone;
    if (address !== undefined) updateData.address = address;
    if (note !== undefined) updateData.note = note;

    const { data, error } = await supabase.from('suppliers').update(updateData).eq('id', id).eq('is_active', true).select().single();

    if (error) return NextResponse.json<ApiResponse>({ success: false, error: error.message }, { status: 500 });
    if (!data) return NextResponse.json<ApiResponse>({ success: false, error: '供应商不存在' }, { status: 404 });

    return NextResponse.json<ApiResponse>({ success: true, data });
  } catch (err) {
    const message = err instanceof Error ? err.message : '编辑供应商失败';
    return NextResponse.json<ApiResponse>({ success: false, error: message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = getCurrentUser(request);
  if (!user) return unauthorized();

  const { id } = await params;
  const supabase = getSupabaseClient();

  try {
    const { error } = await supabase.from('suppliers').update({ is_active: false, updated_at: new Date().toISOString() }).eq('id', id);

    if (error) return NextResponse.json<ApiResponse>({ success: false, error: error.message }, { status: 500 });

    return NextResponse.json<ApiResponse>({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : '删除供应商失败';
    return NextResponse.json<ApiResponse>({ success: false, error: message }, { status: 500 });
  }
}
