import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { getCurrentUser, requireRoles, checkCompanyAccess, CAN_MANAGE_CANTEEN, unauthorized } from '@/lib/auth/guard';
import type { ApiResponse } from '@/lib/auth/types';

/**
 * POST /api/companies/[id]/canteens
 * 在指定公司下创建食堂
 * 权限：SYSTEM_DEVELOPER 全局，COMPANY_MANAGER 仅自己公司
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const currentUser = getCurrentUser(request);
  const roleCheck = requireRoles(currentUser, CAN_MANAGE_CANTEEN);
  if (!roleCheck.ok) return roleCheck.response;

  const { id: companyId } = await params;

  const accessCheck = await checkCompanyAccess(roleCheck.user, companyId);
  if (!accessCheck.ok) return accessCheck.response;

  try {
    const body = (await request.json()) as Record<string, unknown>;

    if (!body.name || !String(body.name).trim()) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: '食堂名称不能为空' },
        { status: 400 }
      );
    }

    const client = getSupabaseClient();
    const { data: company, error: companyError } = await client
      .from('companies')
      .select('id')
      .eq('id', companyId)
      .maybeSingle();

    if (companyError || !company) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: '公司不存在' },
        { status: 404 }
      );
    }

    const insertData: Record<string, unknown> = {
      company_id: companyId,
      name: String(body.name).trim(),
    };
    if (body.address) insertData.address = body.address;
    if (body.contact_name) insertData.contact_name = body.contact_name;
    if (body.contact_phone) insertData.contact_phone = body.contact_phone;
    if (body.manager_id) insertData.manager_id = body.manager_id;

    const { data, error } = await client
      .from('canteens')
      .insert(insertData)
      .select()
      .single();

    if (error) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: `创建食堂失败: ${error.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json<ApiResponse>(
      { success: true, data },
      { status: 201 }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : '创建食堂失败';
    return NextResponse.json<ApiResponse>(
      { success: false, error: message },
      { status: 500 }
    );
  }
}

/**
 * GET /api/companies/[id]/canteens
 * 获取指定公司下的食堂列表，包含负责人信息
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const currentUser = getCurrentUser(request);
  if (!currentUser) return unauthorized();

  const { id: companyId } = await params;

  const accessCheck = await checkCompanyAccess(currentUser, companyId);
  if (!accessCheck.ok) return accessCheck.response;

  try {
    const client = getSupabaseClient();
    const { data, error } = await client
      .from('canteens')
      .select('id, company_id, name, address, contact_name, contact_phone, manager_id, is_active, created_at')
      .eq('company_id', companyId)
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: `查询失败: ${error.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json<ApiResponse>({ success: true, data });
  } catch (err) {
    const message = err instanceof Error ? err.message : '查询失败';
    return NextResponse.json<ApiResponse>(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
