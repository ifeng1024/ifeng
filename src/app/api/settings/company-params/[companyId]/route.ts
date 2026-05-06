import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { getCurrentUser, requireRoles } from '@/lib/auth/guard';
import { RoleCode } from '@/lib/auth/constants';

/** 获取公司系统参数 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ companyId: string }> }
) {
  const user = getCurrentUser(request);
  const roleCheck = requireRoles(user, [RoleCode.SYSTEM_DEVELOPER, RoleCode.COMPANY_MANAGER]);
  if (!roleCheck.ok) return roleCheck.response;

  try {
    const { companyId } = await params;
    const client = getSupabaseClient();

    const { data, error } = await client
      .from('company_params')
      .select('*')
      .eq('company_id', companyId)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    // 如果还没有参数记录，返回默认值
    if (!data) {
      return NextResponse.json({
        success: true,
        data: { company_id: companyId, max_canteens: 10, account_expires_at: null },
      });
    }

    return NextResponse.json({ success: true, data });
  } catch (err) {
    const message = err instanceof Error ? err.message : '查询失败';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

/** 更新公司系统参数 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ companyId: string }> }
) {
  const user = getCurrentUser(request);
  // 只有开发者可以设置公司系统参数
  const roleCheck = requireRoles(user, [RoleCode.SYSTEM_DEVELOPER]);
  if (!roleCheck.ok) return roleCheck.response;

  try {
    const { companyId } = await params;
    const body = await request.json();
    const client = getSupabaseClient();

    const upsertData: Record<string, unknown> = {
      company_id: companyId,
      updated_at: new Date().toISOString(),
    };
    if (body.max_canteens !== undefined) upsertData.max_canteens = body.max_canteens;
    if (body.account_expires_at !== undefined) upsertData.account_expires_at = body.account_expires_at || null;

    const { data, error } = await client
      .from('company_params')
      .upsert(upsertData, { onConflict: 'company_id' })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, data });
  } catch (err) {
    const message = err instanceof Error ? err.message : '更新失败';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
