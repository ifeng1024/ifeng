import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { getCurrentUser, requireRoles } from '@/lib/auth/guard';
import { RoleCode } from '@/lib/auth/constants';

/** 导出数据为 CSV（兼容 Excel 打开） */
export async function GET(request: NextRequest) {
  const user = getCurrentUser(request);
  // 档口负责人无导出权限
  const roleCheck = requireRoles(user, [RoleCode.SYSTEM_DEVELOPER, RoleCode.COMPANY_MANAGER, RoleCode.CANTEEN_MANAGER]);
  if (!roleCheck.ok) return roleCheck.response;

  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'revenue'; // revenue | expense
    const canteen_id = searchParams.get('canteen_id');
    const start_date = searchParams.get('start_date');
    const end_date = searchParams.get('end_date');

    const client = getSupabaseClient();
    const BOM = '\uFEFF'; // UTF-8 BOM for Excel

    if (type === 'revenue') {
      let query = client
        .from('revenue_records')
        .select('canteen_id, stall_id, record_date, order_count, amount, note, created_at, canteens(name), stalls(name), meal_types(name), revenue_types(name)')
        .eq('is_active', true)
        .order('record_date', { ascending: false });

      if (roleCheck.user.role_code === RoleCode.CANTEEN_MANAGER) {
        query = query.eq('canteen_id', roleCheck.user.org_id);
      } else if (roleCheck.user.role_code === RoleCode.COMPANY_MANAGER) {
        const { data: canteens } = await client.from('canteens').select('id').eq('company_id', roleCheck.user.org_id);
        const ids = (canteens || []).map((c: { id: string }) => c.id);
        query = query.in('canteen_id', ids.length > 0 ? ids : ['__none__']);
      }
      if (canteen_id) query = query.eq('canteen_id', canteen_id);
      if (start_date) query = query.gte('record_date', start_date);
      if (end_date) query = query.lte('record_date', end_date);

      const { data, error } = await query;
      if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });

      const header = '营业日期,食堂,档口,餐别,营收类型,订单数,金额,备注\n';
      const rows = (data || []).map((r: Record<string, unknown>) => {
        const canteen = (r.canteens as { name: string } | null)?.name || '';
        const stall = (r.stalls as { name: string } | null)?.name || '';
        const meal = (r.meal_types as { name: string } | null)?.name || '';
        const revType = (r.revenue_types as { name: string } | null)?.name || '';
        return `${r.record_date},${canteen},${stall},${meal},${revType},${r.order_count},${r.amount},${(r.note as string || '').replace(/,/g, '，')}`;
      }).join('\n');

      const csv = BOM + header + rows;
      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename=revenue_${new Date().toISOString().slice(0, 10)}.csv`,
        },
      });
    }

    if (type === 'expense') {
      let query = client
        .from('expense_records')
        .select('canteen_id, expense_date, category, amount, note, is_auto_generated, canteens(name)')
        .eq('is_active', true)
        .order('expense_date', { ascending: false });

      if (roleCheck.user.role_code === RoleCode.CANTEEN_MANAGER) {
        query = query.eq('canteen_id', roleCheck.user.org_id);
      } else if (roleCheck.user.role_code === RoleCode.COMPANY_MANAGER) {
        const { data: canteens } = await client.from('canteens').select('id').eq('company_id', roleCheck.user.org_id);
        const ids = (canteens || []).map((c: { id: string }) => c.id);
        query = query.in('canteen_id', ids.length > 0 ? ids : ['__none__']);
      }
      if (canteen_id) query = query.eq('canteen_id', canteen_id);
      if (start_date) query = query.gte('expense_date', start_date);
      if (end_date) query = query.lte('expense_date', end_date);

      const { data, error } = await query;
      if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });

      const header = '支出日期,食堂,支出类别,金额,是否自动生成,备注\n';
      const rows = (data || []).map((r: Record<string, unknown>) => {
        const canteen = (r.canteens as { name: string } | null)?.name || '';
        return `${r.expense_date},${canteen},${r.category},${r.amount},${r.is_auto_generated ? '是' : '否'},${(r.note as string || '').replace(/,/g, '，')}`;
      }).join('\n');

      const csv = BOM + header + rows;
      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename=expense_${new Date().toISOString().slice(0, 10)}.csv`,
        },
      });
    }

    return NextResponse.json({ success: false, error: '不支持的导出类型' }, { status: 400 });
  } catch (err) {
    const message = err instanceof Error ? err.message : '导出失败';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
