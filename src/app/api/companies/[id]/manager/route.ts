import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { getCurrentUser, requireRoles } from '@/lib/auth/guard';
import type { ApiResponse, DbCompany } from '@/lib/auth/types';

/**
 * PUT /api/companies/[id]/manager
 * 指定公司负责人
 * 权限：仅 SYSTEM_DEVELOPER
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const currentUser = getCurrentUser(request);
  const roleCheck = requireRoles(currentUser, ['SYSTEM_DEVELOPER']);
  if (!roleCheck.ok) return roleCheck.response;

  const { id: companyId } = await params;

  try {
    const body = (await request.json()) as { user_id: string };

    if (!body.user_id) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'user_id 不能为空' },
        { status: 400 }
      );
    }

    const client = getSupabaseClient();

    // 确认公司存在
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

    // 确认目标用户存在且角色为公司负责人
    const { data: targetUser, error: userError } = await client
      .from('users')
      .select('id, role_code, is_active')
      .eq('id', body.user_id)
      .maybeSingle();

    if (userError || !targetUser) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: '目标用户不存在' },
        { status: 404 }
      );
    }

    if (!targetUser.is_active) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: '目标用户已被禁用' },
        { status: 400 }
      );
    }

    if (targetUser.role_code !== 'COMPANY_MANAGER') {
      return NextResponse.json<ApiResponse>(
        { success: false, error: '目标用户角色不是公司负责人' },
        { status: 400 }
      );
    }

    // 更新公司的 manager_id
    const { data, error } = await client
      .from('companies')
      .update({ manager_id: body.user_id })
      .eq('id', companyId)
      .select()
      .single();

    if (error) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: `指定负责人失败: ${error.message}` },
        { status: 500 }
      );
    }

    // 同步更新用户的 org_id 指向该公司
    await client
      .from('users')
      .update({ org_id: companyId })
      .eq('id', body.user_id);

    return NextResponse.json<ApiResponse>({
      success: true,
      data: data as DbCompany,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : '指定负责人失败';
    return NextResponse.json<ApiResponse>(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
