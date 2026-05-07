import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser, unauthorized } from '@/lib/auth/guard';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import type { ApiResponse, DbUser } from '@/lib/auth/types';
import { RoleLabel, RoleCode } from '@/lib/auth/constants';

export async function GET(request: NextRequest) {
  const user = getCurrentUser(request);
  if (!user) {
    return unauthorized();
  }

  try {
    const client = getSupabaseClient();
    const { data, error } = await client
      .from('users')
      .select('id, username, real_name, phone, email, role_code, org_id, is_active, is_disabled, expires_at, created_at')
      .eq('id', user.user_id)
      .maybeSingle();

    if (error) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: `查询失败: ${error.message}` },
        { status: 500 }
      );
    }

    const dbUser = data as DbUser | null;
    if (!dbUser) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: '用户不存在' },
        { status: 404 }
      );
    }

    // Look up company name and org name based on role
    let company_name: string | null = null;
    let org_name: string | null = null;

    if (dbUser.role_code === RoleCode.COMPANY_MANAGER && dbUser.org_id) {
      const { data: company } = await client.from('companies').select('name').eq('id', dbUser.org_id).single();
      company_name = company?.name || null;
      org_name = company_name;
    } else if (dbUser.role_code === RoleCode.CANTEEN_MANAGER && dbUser.org_id) {
      const { data: canteen } = await client.from('canteens').select('name, company_id').eq('id', dbUser.org_id).single();
      org_name = canteen?.name || null;
      if (canteen?.company_id) {
        const { data: company } = await client.from('companies').select('name').eq('id', canteen.company_id).single();
        company_name = company?.name || null;
      }
    } else if (dbUser.role_code === RoleCode.STALL_MANAGER && dbUser.org_id) {
      const { data: stall } = await client.from('stalls').select('name, canteen_id').eq('id', dbUser.org_id).single();
      org_name = stall?.name || null;
      if (stall?.canteen_id) {
        const { data: canteen } = await client.from('canteens').select('name, company_id').eq('id', stall.canteen_id).single();
        if (canteen?.company_id) {
          const { data: company } = await client.from('companies').select('name').eq('id', canteen.company_id).single();
          company_name = company?.name || null;
        }
      }
    }

    return NextResponse.json<ApiResponse>({
      success: true,
      data: {
        id: dbUser.id,
        username: dbUser.username,
        real_name: dbUser.real_name,
        phone: dbUser.phone,
        email: dbUser.email,
        role_code: dbUser.role_code,
        role_label: RoleLabel[dbUser.role_code],
        org_id: dbUser.org_id,
        is_active: dbUser.is_active,
        is_disabled: dbUser.is_disabled,
        expires_at: dbUser.expires_at,
        created_at: dbUser.created_at,
        company_name,
        org_name,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : '查询失败';
    return NextResponse.json<ApiResponse>(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
