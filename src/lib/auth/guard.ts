import { NextRequest, NextResponse } from 'next/server';
import { verifyToken, extractBearerToken } from './jwt';
import type { AuthTokenPayload } from './types';
import { RoleCode, RoleLevel, CAN_MANAGE_CANTEEN, CAN_MANAGE_STALL, CAN_CREATE_COMPANY, CAN_ENTER_REVENUE, CAN_ENTER_EXPENSE } from './constants';
import type { RoleCodeValue } from './constants';
import { getSupabaseClient } from '@/storage/database/supabase-client';

/**
 * 从请求中解析当前用户
 * 返回 JWT payload 或 null
 */
export function getCurrentUser(request: NextRequest): AuthTokenPayload | null {
  const authHeader = request.headers.get('authorization');
  const token = extractBearerToken(authHeader);
  if (!token) return null;
  return verifyToken(token);
}

/**
 * 构建未授权响应
 */
export function unauthorized(message = '未授权，请先登录'): NextResponse {
  return NextResponse.json({ success: false, error: message }, { status: 401 });
}

/**
 * 构建权限不足响应
 */
export function forbidden(message = '权限不足'): NextResponse {
  return NextResponse.json({ success: false, error: message }, { status: 403 });
}

/**
 * 角色校验：要求当前用户具有指定角色之一
 */
export function requireRoles(
  user: AuthTokenPayload | null,
  allowedRoles: RoleCodeValue[]
): { ok: true; user: AuthTokenPayload } | { ok: false; response: NextResponse } {
  if (!user) {
    return { ok: false, response: unauthorized() };
  }
  if (!allowedRoles.includes(user.role_code)) {
    return { ok: false, response: forbidden(`需要角色: ${allowedRoles.join(' / ')}`) };
  }
  return { ok: true, user };
}

/**
 * 角色层级校验：要求当前用户角色层级 <= 指定角色
 * 层级数值越小权限越高
 */
export function requireMinRole(
  user: AuthTokenPayload | null,
  maxLevel: number
): { ok: true; user: AuthTokenPayload } | { ok: false; response: NextResponse } {
  if (!user) {
    return { ok: false, response: unauthorized() };
  }
  const userLevel = RoleLevel[user.role_code];
  if (userLevel > maxLevel) {
    return { ok: false, response: forbidden('权限不足') };
  }
  return { ok: true, user };
}

/**
 * 校验公司归属权：当前用户是否有权操作指定公司
 * - SYSTEM_DEVELOPER: 全部公司
 * - COMPANY_MANAGER: 仅自己 org_id 对应的公司
 */
export async function checkCompanyAccess(
  user: AuthTokenPayload,
  companyId: string
): Promise<{ ok: true } | { ok: false; response: NextResponse }> {
  // 系统开发者拥有全局权限
  if (user.role_code === RoleCode.SYSTEM_DEVELOPER) {
    return { ok: true };
  }

  // 公司负责人只能操作自己的公司
  if (user.role_code === RoleCode.COMPANY_MANAGER) {
    if (user.org_id !== companyId) {
      return { ok: false, response: forbidden('无权操作该公司') };
    }
    return { ok: true };
  }

  // 食堂负责人和档口负责人需要通过食堂/档口反查公司
  if (user.role_code === RoleCode.CANTEEN_MANAGER) {
    const client = getSupabaseClient();
    const { data, error } = await client
      .from('canteens')
      .select('company_id')
      .eq('id', user.org_id)
      .maybeSingle();
    if (error || !data || data.company_id !== companyId) {
      return { ok: false, response: forbidden('无权操作该公司') };
    }
    return { ok: true };
  }

  if (user.role_code === RoleCode.STALL_MANAGER) {
    const client = getSupabaseClient();
    // 先查档口所属食堂，再查食堂所属公司
    const { data: stall, error: stallError } = await client
      .from('stalls')
      .select('canteen_id')
      .eq('id', user.org_id)
      .maybeSingle();
    if (stallError || !stall) {
      return { ok: false, response: forbidden('无权操作该公司') };
    }
    const { data: canteen, error: canteenError } = await client
      .from('canteens')
      .select('company_id')
      .eq('id', stall.canteen_id)
      .maybeSingle();
    if (canteenError || !canteen || canteen.company_id !== companyId) {
      return { ok: false, response: forbidden('无权操作该公司') };
    }
    return { ok: true };
  }

  return { ok: false, response: forbidden('无权操作该公司') };
}

/**
 * 校验食堂归属权：当前用户是否有权操作指定食堂
 * - SYSTEM_DEVELOPER: 全局
 * - COMPANY_MANAGER: 自己公司下的食堂
 * - CANTEEN_MANAGER: 自己的食堂
 */
export async function checkCanteenAccess(
  user: AuthTokenPayload,
  canteenId: string
): Promise<{ ok: true; canteen: { id: string; company_id: string } } | { ok: false; response: NextResponse }> {
  const client = getSupabaseClient();

  // 先查出食堂信息
  const { data: canteen, error } = await client
    .from('canteens')
    .select('id, company_id')
    .eq('id', canteenId)
    .maybeSingle();
  if (error || !canteen) {
    return { ok: false, response: NextResponse.json({ success: false, error: '食堂不存在' }, { status: 404 }) };
  }

  // 系统开发者全局权限
  if (user.role_code === RoleCode.SYSTEM_DEVELOPER) {
    return { ok: true, canteen };
  }

  // 公司负责人：食堂必须属于自己公司
  if (user.role_code === RoleCode.COMPANY_MANAGER) {
    if (user.org_id !== canteen.company_id) {
      return { ok: false, response: forbidden('无权操作该食堂') };
    }
    return { ok: true, canteen };
  }

  // 食堂负责人：只能操作自己的食堂
  if (user.role_code === RoleCode.CANTEEN_MANAGER) {
    if (user.org_id !== canteenId) {
      return { ok: false, response: forbidden('无权操作该食堂') };
    }
    return { ok: true, canteen };
  }

  // 档口负责人：只能操作自己档口所属的食堂
  if (user.role_code === RoleCode.STALL_MANAGER) {
    const { data: stall, error: stallError } = await client
      .from('stalls')
      .select('canteen_id')
      .eq('id', user.org_id)
      .maybeSingle();
    if (stallError || !stall || stall.canteen_id !== canteenId) {
      return { ok: false, response: forbidden('无权操作该食堂') };
    }
    return { ok: true, canteen };
  }

  return { ok: false, response: forbidden('无权操作该食堂') };
}

/**
 * 校验档口归属权：当前用户是否有权操作指定档口
 * - SYSTEM_DEVELOPER: 全局
 * - COMPANY_MANAGER: 自己公司下食堂的档口
 * - CANTEEN_MANAGER: 自己食堂下的档口
 * - STALL_MANAGER: 仅自己的档口
 */
export async function checkStallAccess(
  user: AuthTokenPayload,
  stallId: string
): Promise<{ ok: true; stall: { id: string; canteen_id: string } } | { ok: false; response: NextResponse }> {
  const client = getSupabaseClient();

  const { data: stall, error } = await client
    .from('stalls')
    .select('id, canteen_id')
    .eq('id', stallId)
    .maybeSingle();
  if (error || !stall) {
    return { ok: false, response: NextResponse.json({ success: false, error: '档口不存在' }, { status: 404 }) };
  }

  // 系统开发者
  if (user.role_code === RoleCode.SYSTEM_DEVELOPER) {
    return { ok: true, stall };
  }

  // 档口负责人：只能操作自己的档口
  if (user.role_code === RoleCode.STALL_MANAGER) {
    if (user.org_id !== stallId) {
      return { ok: false, response: forbidden('无权操作该档口') };
    }
    return { ok: true, stall };
  }

  // 食堂负责人：档口必须在自己的食堂下
  if (user.role_code === RoleCode.CANTEEN_MANAGER) {
    if (user.org_id !== stall.canteen_id) {
      return { ok: false, response: forbidden('无权操作该档口') };
    }
    return { ok: true, stall };
  }

  // 公司负责人：需要通过食堂反查公司
  if (user.role_code === RoleCode.COMPANY_MANAGER) {
    const { data: canteen, error: canteenError } = await client
      .from('canteens')
      .select('company_id')
      .eq('id', stall.canteen_id)
      .maybeSingle();
    if (canteenError || !canteen || canteen.company_id !== user.org_id) {
      return { ok: false, response: forbidden('无权操作该档口') };
    }
    return { ok: true, stall };
  }

  return { ok: false, response: forbidden('无权操作该档口') };
}

// 导出角色权限常量，供 route handler 直接使用
export { CAN_CREATE_COMPANY, CAN_MANAGE_CANTEEN, CAN_MANAGE_STALL, CAN_ENTER_REVENUE, CAN_ENTER_EXPENSE };
