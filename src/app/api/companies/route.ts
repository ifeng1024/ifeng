import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { getCurrentUser, requireRoles, CAN_CREATE_COMPANY, unauthorized } from '@/lib/auth/guard';
import type { ApiResponse, CreateCompanyRequest, DbCompany } from '@/lib/auth/types';

/**
 * POST /api/companies
 * 创建公司（仅系统开发者）
 */
export async function POST(request: NextRequest) {
  const currentUser = getCurrentUser(request);
  const roleCheck = requireRoles(currentUser, CAN_CREATE_COMPANY);
  if (!roleCheck.ok) return roleCheck.response;

  try {
    const body = (await request.json()) as CreateCompanyRequest;

    if (!body.name?.trim()) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: '公司名称不能为空' },
        { status: 400 }
      );
    }

    const client = getSupabaseClient();
    const insertData: Record<string, unknown> = {
      name: body.name.trim(),
    };
    if (body.address) insertData.address = body.address;
    if (body.contact_phone) insertData.contact_phone = body.contact_phone;
    if (body.manager_id) insertData.manager_id = body.manager_id;

    const { data, error } = await client
      .from('companies')
      .insert(insertData)
      .select()
      .single();

    if (error) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: `创建公司失败: ${error.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json<ApiResponse>(
      { success: true, data: data as DbCompany },
      { status: 201 }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : '创建公司失败';
    return NextResponse.json<ApiResponse>(
      { success: false, error: message },
      { status: 500 }
    );
  }
}

/**
 * GET /api/companies
 * 获取公司列表
 * - SYSTEM_DEVELOPER: 所有公司
 * - COMPANY_MANAGER: 自己的公司
 * - 其他角色: 通过组织关系反查
 */
export async function GET(request: NextRequest) {
  const currentUser = getCurrentUser(request);
  if (!currentUser) return unauthorized();

  const client = getSupabaseClient();

  try {
    // 系统开发者可查看所有公司
    if (currentUser.role_code === 'SYSTEM_DEVELOPER') {
      const { data, error } = await client
        .from('companies')
        .select('id, name, address, contact_phone, manager_id, is_active, created_at')
        .order('created_at', { ascending: false });

      if (error) {
        return NextResponse.json<ApiResponse>(
          { success: false, error: `查询失败: ${error.message}` },
          { status: 500 }
        );
      }

      return NextResponse.json<ApiResponse>({ success: true, data });
    }

    // 公司负责人只能看自己的公司
    if (currentUser.role_code === 'COMPANY_MANAGER' && currentUser.org_id) {
      const { data, error } = await client
        .from('companies')
        .select('id, name, address, contact_phone, manager_id, is_active, created_at')
        .eq('id', currentUser.org_id)
        .maybeSingle();

      if (error) {
        return NextResponse.json<ApiResponse>(
          { success: false, error: `查询失败: ${error.message}` },
          { status: 500 }
        );
      }

      return NextResponse.json<ApiResponse>({ success: true, data: data ? [data] : [] });
    }

    // 食堂/档口负责人通过组织关系反查
    if (currentUser.role_code === 'CANTEEN_MANAGER' && currentUser.org_id) {
      const { data: canteen, error: canteenError } = await client
        .from('canteens')
        .select('company_id')
        .eq('id', currentUser.org_id)
        .maybeSingle();

      if (canteenError || !canteen) {
        return NextResponse.json<ApiResponse>({ success: true, data: [] });
      }

      const { data, error } = await client
        .from('companies')
        .select('id, name, address, contact_phone, manager_id, is_active, created_at')
        .eq('id', canteen.company_id)
        .maybeSingle();

      if (error) {
        return NextResponse.json<ApiResponse>(
          { success: false, error: `查询失败: ${error.message}` },
          { status: 500 }
        );
      }

      return NextResponse.json<ApiResponse>({ success: true, data: data ? [data] : [] });
    }

    // 档口负责人通过档口→食堂→公司反查
    if (currentUser.role_code === 'STALL_MANAGER' && currentUser.org_id) {
      const { data: stall } = await client
        .from('stalls')
        .select('canteen_id')
        .eq('id', currentUser.org_id)
        .maybeSingle();

      if (!stall) {
        return NextResponse.json<ApiResponse>({ success: true, data: [] });
      }

      const { data: canteen } = await client
        .from('canteens')
        .select('company_id')
        .eq('id', stall.canteen_id)
        .maybeSingle();

      if (!canteen) {
        return NextResponse.json<ApiResponse>({ success: true, data: [] });
      }

      const { data, error } = await client
        .from('companies')
        .select('id, name, address, contact_phone, manager_id, is_active, created_at')
        .eq('id', canteen.company_id)
        .maybeSingle();

      if (error) {
        return NextResponse.json<ApiResponse>(
          { success: false, error: `查询失败: ${error.message}` },
          { status: 500 }
        );
      }

      return NextResponse.json<ApiResponse>({ success: true, data: data ? [data] : [] });
    }

    // 普通用户暂不返回公司列表
    return NextResponse.json<ApiResponse>({ success: true, data: [] });
  } catch (err) {
    const message = err instanceof Error ? err.message : '查询失败';
    return NextResponse.json<ApiResponse>(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
