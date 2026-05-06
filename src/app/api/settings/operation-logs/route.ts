import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { getCurrentUser, requireRoles } from '@/lib/auth/guard';
import { RoleCode } from '@/lib/auth/constants';

/** 查询操作日志 */
export async function GET(request: NextRequest) {
  const user = getCurrentUser(request);
  const roleCheck = requireRoles(user, [RoleCode.SYSTEM_DEVELOPER]);
  if (!roleCheck.ok) return roleCheck.response;

  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');
    const username = searchParams.get('username');
    const start_date = searchParams.get('start_date');
    const end_date = searchParams.get('end_date');
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = parseInt(searchParams.get('page_size') || '20');

    const client = getSupabaseClient();
    let query = client
      .from('operation_logs')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range((page - 1) * pageSize, page * pageSize - 1);

    if (action) query = query.eq('action', action);
    if (username) query = query.ilike('username', `%${username}%`);
    if (start_date) query = query.gte('created_at', start_date);
    if (end_date) query = query.lte('created_at', end_date);

    const { data, error, count } = await query;
    if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });

    return NextResponse.json({
      success: true,
      data: { records: data, total: count, page, page_size: pageSize },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : '查询失败';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
