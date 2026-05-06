import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { getCurrentUser, requireRoles } from '@/lib/auth/guard';
import { RoleCode } from '@/lib/auth/constants';

/** 仪表盘聚合数据 */
export async function GET(request: NextRequest) {
  const user = getCurrentUser(request);
  if (!user) {
    return NextResponse.json({ success: false, error: '未授权' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    // 使用本地时区日期，避免 UTC 偏差
    const localDate = new Date();
    const today = searchParams.get('date') || `${localDate.getFullYear()}-${String(localDate.getMonth() + 1).padStart(2, '0')}-${String(localDate.getDate()).padStart(2, '0')}`;
    const trend_days = parseInt(searchParams.get('trend_days') || '7');
    const canteen_id = searchParams.get('canteen_id');

    const client = getSupabaseClient();

    // 获取可见的食堂列表
    let canteenIds: string[] = [];
    if (user.role_code === RoleCode.CANTEEN_MANAGER) {
      canteenIds = [user.org_id!];
    } else if (user.role_code === RoleCode.STALL_MANAGER) {
      const { data: stall } = await client
        .from('stalls')
        .select('canteen_id')
        .eq('id', user.org_id)
        .maybeSingle();
      canteenIds = stall ? [stall.canteen_id] : [];
    } else if (user.role_code === RoleCode.COMPANY_MANAGER) {
      const { data: canteens } = await client
        .from('canteens')
        .select('id')
        .eq('company_id', user.org_id);
      canteenIds = (canteens || []).map((c: { id: string }) => c.id);
    } else {
      // SYSTEM_DEVELOPER: 看所有
      const { data: canteens } = await client
        .from('canteens')
        .select('id');
      canteenIds = (canteens || []).map((c: { id: string }) => c.id);
    }

    if (canteen_id) {
      canteenIds = canteenIds.filter(id => id === canteen_id);
    }

    if (canteenIds.length === 0) {
      return NextResponse.json({
        success: true,
        data: {
          kpi: { total_revenue: '0', total_expense: '0', gross_profit: '0', gross_margin: '0' },
          canteen_revenue: [],
          stall_ranking: [],
          revenue_trend: [],
          expense_composition: [],
          material_trend: [],
          daily_detail: [],
          profit_trend: [],
        },
      });
    }

    // 1. KPI 卡片 - 今日数据
    const { data: todayRevenue } = await client
      .from('revenue_records')
      .select('amount')
      .eq('is_active', true)
      .eq('record_date', today)
      .in('canteen_id', canteenIds);

    const { data: todayExpense } = await client
      .from('expense_records')
      .select('amount, category')
      .eq('is_active', true)
      .eq('expense_date', today)
      .in('canteen_id', canteenIds);

    const totalRevenue = (todayRevenue || []).reduce((sum: number, r: { amount: string }) => sum + parseFloat(r.amount || '0'), 0);
    const totalExpense = (todayExpense || []).reduce((sum: number, r: { amount: string }) => sum + parseFloat(r.amount || '0'), 0);
    const grossProfit = totalRevenue - totalExpense;
    const grossMargin = totalRevenue > 0 ? ((grossProfit / totalRevenue) * 100).toFixed(1) : '0';

    // 2. 食堂营收对比
    const { data: canteenRevenue } = await client
      .from('revenue_records')
      .select('canteen_id, amount, canteens(name)')
      .eq('is_active', true)
      .eq('record_date', today)
      .in('canteen_id', canteenIds);

    const canteenRevenueMap = new Map<string, { name: string; amount: number }>();
    (canteenRevenue || []).forEach((r: Record<string, unknown>) => {
      const canteenId = r.canteen_id as string;
      const existing = canteenRevenueMap.get(canteenId);
      const amt = parseFloat((r.amount as string) || '0');
      const canteens = r.canteens as { name: string } | { name: string }[] | null;
      const name = Array.isArray(canteens) ? canteens[0]?.name : (canteens as { name: string } | null)?.name || '未知';
      if (existing) {
        existing.amount += amt;
      } else {
        canteenRevenueMap.set(canteenId, { name, amount: amt });
      }
    });

    // 3. 档口营收排行 Top5
    const { data: stallRevenue } = await client
      .from('revenue_records')
      .select('stall_id, amount, stalls(name)')
      .eq('is_active', true)
      .eq('record_date', today)
      .in('canteen_id', canteenIds);

    const stallRevenueMap = new Map<string, { name: string; amount: number }>();
    (stallRevenue || []).forEach((r: Record<string, unknown>) => {
      const stallId = r.stall_id as string;
      const existing = stallRevenueMap.get(stallId);
      const amt = parseFloat((r.amount as string) || '0');
      const stalls = r.stalls as { name: string } | { name: string }[] | null;
      const name = Array.isArray(stalls) ? stalls[0]?.name : (stalls as { name: string } | null)?.name || '未知';
      if (existing) {
        existing.amount += amt;
      } else {
        stallRevenueMap.set(stallId, { name, amount: amt });
      }
    });
    const stallRanking = Array.from(stallRevenueMap.values())
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5);

    // 4. 营收趋势（近N天）
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - trend_days);
    const startDateStr = startDate.toISOString().slice(0, 10);

    const { data: trendData } = await client
      .from('revenue_records')
      .select('record_date, amount')
      .eq('is_active', true)
      .gte('record_date', startDateStr)
      .lte('record_date', today)
      .in('canteen_id', canteenIds);

    const revenueByDate = new Map<string, number>();
    (trendData || []).forEach((r: { record_date: string; amount: string }) => {
      const existing = revenueByDate.get(r.record_date) || 0;
      revenueByDate.set(r.record_date, existing + parseFloat(r.amount || '0'));
    });

    // 5. 支出构成
    const expenseByCategory = new Map<string, number>();
    (todayExpense || []).forEach((r: { amount: string; category: string }) => {
      const existing = expenseByCategory.get(r.category) || 0;
      expenseByCategory.set(r.category, existing + parseFloat(r.amount || '0'));
    });

    // 6. 食材领用趋势
    const { data: materialTrend } = await client
      .from('expense_records')
      .select('expense_date, amount, canteen_id, canteens(name)')
      .eq('is_active', true)
      .eq('category', '食材采购')
      .gte('expense_date', startDateStr)
      .lte('expense_date', today)
      .in('canteen_id', canteenIds);

    const materialByCanteenDate = new Map<string, Map<string, number>>();
    (materialTrend || []).forEach((r: Record<string, unknown>) => {
      const cId = r.canteen_id as string;
      if (!materialByCanteenDate.has(cId)) {
        materialByCanteenDate.set(cId, new Map());
      }
      const dateMap = materialByCanteenDate.get(cId)!;
      const ed = r.expense_date as string;
      dateMap.set(ed, (dateMap.get(ed) || 0) + parseFloat((r.amount as string) || '0'));
    });

    // 7. 当日明细
    const { data: dailyDetail } = await client
      .from('canteens')
      .select('id, name')
      .in('id', canteenIds);

    const dailyDetailResult = [];
    for (const c of dailyDetail || []) {
      const cRev = (canteenRevenue || [])
        .filter((r: { canteen_id: string }) => r.canteen_id === c.id)
        .reduce((sum: number, r: { amount: string }) => sum + parseFloat(r.amount || '0'), 0);
      const cExp = (todayExpense || [])
        .filter((r: { amount: string }) => true)
        .reduce((sum: number) => sum, 0); // simplified
      // Need to recalculate per-canteen expense
      const { data: canteenExpenseData } = await client
        .from('expense_records')
        .select('amount')
        .eq('is_active', true)
        .eq('expense_date', today)
        .eq('canteen_id', c.id);
      const cExpense = (canteenExpenseData || []).reduce((sum: number, r: { amount: string }) => sum + parseFloat(r.amount || '0'), 0);
      const cProfit = cRev - cExpense;
      const cMargin = cRev > 0 ? ((cProfit / cRev) * 100).toFixed(1) : '0';
      dailyDetailResult.push({
        canteen_id: c.id,
        canteen_name: c.name,
        revenue: cRev.toFixed(2),
        expense: cExpense.toFixed(2),
        gross_profit: cProfit.toFixed(2),
        gross_margin: cMargin,
      });
    }

    // 8. 毛利趋势
    const { data: expenseTrendData } = await client
      .from('expense_records')
      .select('expense_date, amount')
      .eq('is_active', true)
      .gte('expense_date', startDateStr)
      .lte('expense_date', today)
      .in('canteen_id', canteenIds);

    const expenseByDate = new Map<string, number>();
    (expenseTrendData || []).forEach((r: { expense_date: string; amount: string }) => {
      const existing = expenseByDate.get(r.expense_date) || 0;
      expenseByDate.set(r.expense_date, existing + parseFloat(r.amount || '0'));
    });

    // Build date range
    const allDates: string[] = [];
    const d = new Date(startDateStr);
    while (d.toISOString().slice(0, 10) <= today) {
      allDates.push(d.toISOString().slice(0, 10));
      d.setDate(d.getDate() + 1);
    }

    const profitTrend = allDates.map(date => ({
      date,
      revenue: (revenueByDate.get(date) || 0).toFixed(2),
      expense: (expenseByDate.get(date) || 0).toFixed(2),
      profit: ((revenueByDate.get(date) || 0) - (expenseByDate.get(date) || 0)).toFixed(2),
    }));

    return NextResponse.json({
      success: true,
      data: {
        kpi: {
          total_revenue: totalRevenue.toFixed(2),
          total_expense: totalExpense.toFixed(2),
          gross_profit: grossProfit.toFixed(2),
          gross_margin: grossMargin,
        },
        canteen_revenue: Array.from(canteenRevenueMap.values()),
        stall_ranking: stallRanking,
        revenue_trend: allDates.map(date => ({
          date,
          amount: (revenueByDate.get(date) || 0).toFixed(2),
        })),
        expense_composition: Array.from(expenseByCategory.entries()).map(([category, amount]) => ({
          category,
          amount: amount.toFixed(2),
        })),
        material_trend: Array.from(materialByCanteenDate.entries()).map(([canteenId, dateMap]) => {
          const canteen = (dailyDetail || []).find((c: { id: string }) => c.id === canteenId);
          return {
            canteen_name: canteen?.name || '未知',
            data: allDates.map(date => ({
              date,
              amount: (dateMap.get(date) || 0).toFixed(2),
            })),
          };
        }),
        daily_detail: dailyDetailResult,
        profit_trend: profitTrend,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : '查询失败';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
