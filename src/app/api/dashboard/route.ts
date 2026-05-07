import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { getCurrentUser, unauthorized } from '@/lib/auth/guard';
import type { ApiResponse } from '@/lib/auth/types';

function localDate(): string {
  return new Date().toLocaleDateString('sv-SE');
}

/**
 * GET /api/dashboard?date=YYYY-MM-DD&range=7d|30d
 */
export async function GET(request: NextRequest) {
  const user = getCurrentUser(request);
  if (!user) return unauthorized();

  const { searchParams } = new URL(request.url);
  const dateStr = searchParams.get('date') || localDate();
  const range = searchParams.get('range') || '7d';

  const supabase = getSupabaseClient();

  // Compute date ranges
  const endDate = new Date(dateStr + 'T00:00:00');
  const days = range === '30d' ? 30 : 7;
  const startDate = new Date(endDate);
  startDate.setDate(startDate.getDate() - days + 1);

  // This week (Mon-Sun) and this month ranges
  const today = new Date(dateStr + 'T00:00:00');
  const dayOfWeek = today.getDay();
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const weekStart = new Date(today);
  weekStart.setDate(today.getDate() + mondayOffset);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);

  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0);

  const fmt = (d: Date) => d.toLocaleDateString('sv-SE');

  // Get canteen IDs the user can access
  let canteenIds: string[] = [];
  if (user.role_code === 'SYSTEM_DEVELOPER') {
    const { data } = await supabase.from('canteens').select('id').eq('is_active', true);
    canteenIds = (data || []).map((c: { id: string }) => c.id);
  } else if (user.role_code === 'COMPANY_MANAGER') {
    const { data } = await supabase.from('canteens').select('id').eq('company_id', user.org_id).eq('is_active', true);
    canteenIds = (data || []).map((c: { id: string }) => c.id);
  } else if (user.role_code === 'CANTEEN_MANAGER') {
    canteenIds = user.org_id ? [user.org_id] : [];
  } else if (user.role_code === 'STALL_MANAGER') {
    // Get the canteen of the stall manager's stall
    const { data: stall } = await supabase.from('stalls').select('canteen_id').eq('id', user.org_id).maybeSingle();
    canteenIds = stall ? [stall.canteen_id] : [];
  }

  if (canteenIds.length === 0) {
    canteenIds = ['__none__'];
  }

  try {
    // ---- KPI: total revenue & expense for the selected range ----
    const [revRes, expRes] = await Promise.all([
      supabase.from('revenue_records').select('amount').in('canteen_id', canteenIds).eq('is_active', true).gte('record_date', fmt(startDate)).lte('record_date', fmt(endDate)),
      supabase.from('expense_records').select('amount').in('canteen_id', canteenIds).eq('is_active', true).gte('expense_date', fmt(startDate)).lte('expense_date', fmt(endDate)),
    ]);

    const totalRevenue = (revRes.data || []).reduce((s: number, r: Record<string, unknown>) => s + Number(r.amount || 0), 0);
    const totalExpense = (expRes.data || []).reduce((s: number, r: Record<string, unknown>) => s + Number(r.amount || 0), 0);
    const grossProfit = totalRevenue - totalExpense;
    const grossMargin = totalRevenue > 0 ? ((grossProfit / totalRevenue) * 100).toFixed(1) : '0.0';

    // ---- Today KPIs ----
    const todayStr = fmt(today);
    const [todayRevRes, todayExpRes] = await Promise.all([
      supabase.from('revenue_records').select('amount').in('canteen_id', canteenIds).eq('is_active', true).eq('record_date', todayStr),
      supabase.from('expense_records').select('amount').in('canteen_id', canteenIds).eq('is_active', true).eq('expense_date', todayStr),
    ]);
    const todayRevenue = (todayRevRes.data || []).reduce((s: number, r: Record<string, unknown>) => s + Number(r.amount || 0), 0);
    const todayExpense = (todayExpRes.data || []).reduce((s: number, r: Record<string, unknown>) => s + Number(r.amount || 0), 0);
    const todayGrossProfit = todayRevenue - todayExpense;

    // ---- Weekly KPIs ----
    const [weekRevRes, weekExpRes] = await Promise.all([
      supabase.from('revenue_records').select('amount').in('canteen_id', canteenIds).eq('is_active', true).gte('record_date', fmt(weekStart)).lte('record_date', fmt(weekEnd)),
      supabase.from('expense_records').select('amount').in('canteen_id', canteenIds).eq('is_active', true).gte('expense_date', fmt(weekStart)).lte('expense_date', fmt(weekEnd)),
    ]);

    const weekRevenue = (weekRevRes.data || []).reduce((s: number, r: Record<string, unknown>) => s + Number(r.amount || 0), 0);
    const weekExpense = (weekExpRes.data || []).reduce((s: number, r: Record<string, unknown>) => s + Number(r.amount || 0), 0);
    const weekGrossProfit = weekRevenue - weekExpense;

    // ---- Monthly KPIs ----
    const [monthRevRes, monthExpRes] = await Promise.all([
      supabase.from('revenue_records').select('amount').in('canteen_id', canteenIds).eq('is_active', true).gte('record_date', fmt(monthStart)).lte('record_date', fmt(monthEnd)),
      supabase.from('expense_records').select('amount').in('canteen_id', canteenIds).eq('is_active', true).gte('expense_date', fmt(monthStart)).lte('expense_date', fmt(monthEnd)),
    ]);

    const monthRevenue = (monthRevRes.data || []).reduce((s: number, r: Record<string, unknown>) => s + Number(r.amount || 0), 0);
    const monthExpense = (monthExpRes.data || []).reduce((s: number, r: Record<string, unknown>) => s + Number(r.amount || 0), 0);
    const monthGrossProfit = monthRevenue - monthExpense;

    // ---- Canteen revenue breakdown ----
    const { data: canteenRevData } = await supabase
      .from('revenue_records')
      .select('canteen_id, amount, canteens(name)')
      .in('canteen_id', canteenIds)
      .eq('is_active', true)
      .gte('record_date', fmt(startDate))
      .lte('record_date', fmt(endDate));

    const canteenRevenueMap = new Map<string, { name: string; amount: number }>();
    for (const r of (canteenRevData || [])) {
      const cName = ((r as Record<string, unknown>).canteens as unknown as { name: string } | null)?.name || '未知';
      const existing = canteenRevenueMap.get((r as Record<string, unknown>).canteen_id as string);
      if (existing) {
        existing.amount += Number((r as Record<string, unknown>).amount || 0);
      } else {
        canteenRevenueMap.set((r as Record<string, unknown>).canteen_id as string, { name: cName, amount: Number((r as Record<string, unknown>).amount || 0) });
      }
    }
    const canteen_comparison = Array.from(canteenRevenueMap.values());

    // ---- Stall ranking ----
    const { data: stallRevData } = await supabase
      .from('revenue_records')
      .select('stall_id, amount, stalls(name)')
      .in('canteen_id', canteenIds)
      .eq('is_active', true)
      .gte('record_date', fmt(startDate))
      .lte('record_date', fmt(endDate));

    const stallMap = new Map<string, { name: string; amount: number }>();
    for (const r of (stallRevData || [])) {
      const sName = ((r as Record<string, unknown>).stalls as unknown as { name: string } | null)?.name || '未知';
      const existing = stallMap.get((r as Record<string, unknown>).stall_id as string);
      if (existing) {
        existing.amount += Number((r as Record<string, unknown>).amount || 0);
      } else {
        stallMap.set((r as Record<string, unknown>).stall_id as string, { name: sName, amount: Number((r as Record<string, unknown>).amount || 0) });
      }
    }
    const stall_ranking = Array.from(stallMap.values()).sort((a, b) => b.amount - a.amount);

    // ---- Revenue trend (daily) ----
    const revenueTrendMap = new Map<string, number>();
    for (let i = 0; i < days; i++) {
      const d = new Date(startDate);
      d.setDate(d.getDate() + i);
      revenueTrendMap.set(fmt(d), 0);
    }

    const { data: trendData } = await supabase
      .from('revenue_records')
      .select('record_date, amount')
      .in('canteen_id', canteenIds)
      .eq('is_active', true)
      .gte('record_date', fmt(startDate))
      .lte('record_date', fmt(endDate));

    for (const r of (trendData || [])) {
      const date = (r as Record<string, unknown>).record_date as string;
      const amount = Number((r as Record<string, unknown>).amount || 0);
      revenueTrendMap.set(date, (revenueTrendMap.get(date) || 0) + amount);
    }
    const revenue_trend = Array.from(revenueTrendMap.entries()).map(([date, amount]) => ({ date, amount: amount.toFixed(2) }));

    // ---- Expense composition ----
    const { data: expCompData } = await supabase
      .from('expense_records')
      .select('category, amount')
      .in('canteen_id', canteenIds)
      .eq('is_active', true)
      .gte('expense_date', fmt(startDate))
      .lte('expense_date', fmt(endDate));

    const expCompMap = new Map<string, number>();
    for (const r of (expCompData || [])) {
      const cat = (r as Record<string, unknown>).category as string;
      const amount = Number((r as Record<string, unknown>).amount || 0);
      expCompMap.set(cat, (expCompMap.get(cat) || 0) + amount);
    }
    const expense_breakdown = Array.from(expCompMap.entries()).map(([category, amount]) => ({ category, amount: amount.toFixed(2) }));

    // ---- Daily detail for table ----
    const { data: dailyDetailRaw } = await supabase
      .from('revenue_records')
      .select('canteen_id, record_date, amount, canteens(name)')
      .in('canteen_id', canteenIds)
      .eq('is_active', true)
      .gte('record_date', fmt(startDate))
      .lte('record_date', fmt(endDate));

    const dailyDetailMap = new Map<string, { canteen_name: string; revenue: number }>();
    for (const r of (dailyDetailRaw || [])) {
      const cName = ((r as Record<string, unknown>).canteens as unknown as { name: string }[] | null)?.[0]?.name || '未知';
      const date = (r as Record<string, unknown>).record_date as string;
      const amount = Number((r as Record<string, unknown>).amount || 0);
      const key = `${date}_${(r as Record<string, unknown>).canteen_id}`;
      const existing = dailyDetailMap.get(key);
      if (existing) {
        existing.revenue += amount;
      } else {
        dailyDetailMap.set(key, { canteen_name: cName, revenue: amount });
      }
    }

    const { data: dailyExpRaw } = await supabase
      .from('expense_records')
      .select('canteen_id, expense_date, amount')
      .in('canteen_id', canteenIds)
      .eq('is_active', true)
      .gte('expense_date', fmt(startDate))
      .lte('expense_date', fmt(endDate));

    const dailyExpMap = new Map<string, number>();
    for (const r of (dailyExpRaw || [])) {
      const key = `${(r as Record<string, unknown>).expense_date}_${(r as Record<string, unknown>).canteen_id}`;
      dailyExpMap.set(key, (dailyExpMap.get(key) || 0) + Number((r as Record<string, unknown>).amount || 0));
    }

    const daily_detail = Array.from(dailyDetailMap.entries()).map(([key, val]) => {
      const [date] = key.split('_');
      const expense = dailyExpMap.get(key) || 0;
      return { date, ...val, expense, profit: val.revenue - expense };
    }).sort((a, b) => b.date.localeCompare(a.date));

    // ---- Profit trend (daily) ----
    const profitTrendMap = new Map<string, { revenue: number; expense: number; profit: number }>();
    for (let i = 0; i < days; i++) {
      const d = new Date(startDate);
      d.setDate(d.getDate() + i);
      profitTrendMap.set(fmt(d), { revenue: 0, expense: 0, profit: 0 });
    }

    for (const r of (trendData || [])) {
      const date = (r as Record<string, unknown>).record_date as string;
      const amount = Number((r as Record<string, unknown>).amount || 0);
      const existing = profitTrendMap.get(date);
      if (existing) existing.revenue += amount;
    }

    for (const r of (dailyExpRaw || [])) {
      const date = (r as Record<string, unknown>).expense_date as string;
      const amount = Number((r as Record<string, unknown>).amount || 0);
      const existing = profitTrendMap.get(date);
      if (existing) existing.expense += amount;
    }

    for (const [, val] of profitTrendMap) {
      val.profit = val.revenue - val.expense;
    }

    const profit_trend = Array.from(profitTrendMap.entries()).map(([date, val]) => ({
      date,
      revenue: val.revenue.toFixed(2),
      expense: val.expense.toFixed(2),
      profit: val.profit.toFixed(2),
    }));

    // ---- Per-canteen KPIs (for COMPANY_MANAGER view) ----
    const perCanteenKpi: Array<{
      canteen_id: string;
      canteen_name: string;
      today_revenue: number;
      today_expense: number;
      today_gross_profit: number;
      month_revenue: number;
      month_expense: number;
      month_gross_profit: number;
    }> = [];

    if (user.role_code === 'COMPANY_MANAGER' || user.role_code === 'SYSTEM_DEVELOPER') {
      // Fetch canteen names
      const { data: canteenNameData } = await supabase.from('canteens').select('id, name').in('id', canteenIds.filter(id => id !== '__none__'));
      const canteenNameMap = new Map((canteenNameData || []).map((c: Record<string, unknown>) => [c.id as string, c.name as string]));

      for (const cid of canteenIds) {
        if (cid === '__none__') continue;
        const cName = canteenNameMap.get(cid) || canteenRevenueMap.get(cid)?.name || '未知';

        const [cTodayRev, cTodayExp, cMonthRev, cMonthExp] = await Promise.all([
          supabase.from('revenue_records').select('amount').eq('canteen_id', cid).eq('is_active', true).eq('record_date', todayStr),
          supabase.from('expense_records').select('amount').eq('canteen_id', cid).eq('is_active', true).eq('expense_date', todayStr),
          supabase.from('revenue_records').select('amount').eq('canteen_id', cid).eq('is_active', true).gte('record_date', fmt(monthStart)).lte('record_date', fmt(monthEnd)),
          supabase.from('expense_records').select('amount').eq('canteen_id', cid).eq('is_active', true).gte('expense_date', fmt(monthStart)).lte('expense_date', fmt(monthEnd)),
        ]);

        const tRev = (cTodayRev.data || []).reduce((s: number, r: Record<string, unknown>) => s + Number(r.amount || 0), 0);
        const tExp = (cTodayExp.data || []).reduce((s: number, r: Record<string, unknown>) => s + Number(r.amount || 0), 0);
        const mRev = (cMonthRev.data || []).reduce((s: number, r: Record<string, unknown>) => s + Number(r.amount || 0), 0);
        const mExp = (cMonthExp.data || []).reduce((s: number, r: Record<string, unknown>) => s + Number(r.amount || 0), 0);

        perCanteenKpi.push({
          canteen_id: cid,
          canteen_name: cName,
          today_revenue: tRev,
          today_expense: tExp,
          today_gross_profit: tRev - tExp,
          month_revenue: mRev,
          month_expense: mExp,
          month_gross_profit: mRev - mExp,
        });
      }
    }

    return NextResponse.json<ApiResponse>({
      success: true,
      data: {
        role_code: user.role_code,
        stall_id: user.role_code === 'STALL_MANAGER' ? user.org_id : null,
        kpi: {
          today_revenue: todayRevenue.toFixed(2),
          today_expense: todayExpense.toFixed(2),
          today_gross_profit: todayGrossProfit.toFixed(2),
          total_revenue: totalRevenue.toFixed(2),
          total_expense: totalExpense.toFixed(2),
          gross_profit: grossProfit.toFixed(2),
          gross_margin: grossMargin,
          week_revenue: weekRevenue.toFixed(2),
          week_expense: weekExpense.toFixed(2),
          week_gross_profit: weekGrossProfit.toFixed(2),
          month_revenue: monthRevenue.toFixed(2),
          month_expense: monthExpense.toFixed(2),
          month_gross_profit: monthGrossProfit.toFixed(2),
        },
        per_canteen_kpi: perCanteenKpi,
        canteen_comparison,
        stall_ranking,
        revenue_trend,
        expense_breakdown,
        daily_detail,
        profit_trend,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : '仪表盘查询失败';
    return NextResponse.json<ApiResponse>(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
