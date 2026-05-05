/**
 * 角色代码枚举
 * 层级从高到低：SYSTEM_DEVELOPER > COMPANY_MANAGER > CANTEEN_MANAGER > STALL_MANAGER > REGULAR_USER
 */
export const RoleCode = {
  SYSTEM_DEVELOPER: 'SYSTEM_DEVELOPER',
  COMPANY_MANAGER: 'COMPANY_MANAGER',
  CANTEEN_MANAGER: 'CANTEEN_MANAGER',
  STALL_MANAGER: 'STALL_MANAGER',
  REGULAR_USER: 'REGULAR_USER',
} as const;

export type RoleCodeValue = (typeof RoleCode)[keyof typeof RoleCode];

/**
 * 角色层级（数值越小权限越高）
 */
export const RoleLevel: Record<RoleCodeValue, number> = {
  SYSTEM_DEVELOPER: 0,
  COMPANY_MANAGER: 1,
  CANTEEN_MANAGER: 2,
  STALL_MANAGER: 3,
  REGULAR_USER: 4,
};

/**
 * 角色中文名映射
 */
export const RoleLabel: Record<RoleCodeValue, string> = {
  SYSTEM_DEVELOPER: '系统开发者',
  COMPANY_MANAGER: '公司负责人',
  CANTEEN_MANAGER: '食堂负责人',
  STALL_MANAGER: '档口负责人',
  REGULAR_USER: '普通订餐用户',
};

/**
 * 角色与组织表的映射关系
 * 根据 role_code 确定 org_id 关联的实体表
 */
export const RoleOrgTable: Record<RoleCodeValue, string | null> = {
  SYSTEM_DEVELOPER: null,
  COMPANY_MANAGER: 'companies',
  CANTEEN_MANAGER: 'canteens',
  STALL_MANAGER: 'stalls',
  REGULAR_USER: null,
};

/**
 * 允许创建公司的角色
 */
export const CAN_CREATE_COMPANY: RoleCodeValue[] = [RoleCode.SYSTEM_DEVELOPER];

/**
 * 允许管理食堂的角色（创建食堂、指定食堂负责人）
 */
export const CAN_MANAGE_CANTEEN: RoleCodeValue[] = [RoleCode.SYSTEM_DEVELOPER, RoleCode.COMPANY_MANAGER];

/**
 * 允许管理档口的角色（创建档口、指定档口负责人）
 */
export const CAN_MANAGE_STALL: RoleCodeValue[] = [RoleCode.SYSTEM_DEVELOPER, RoleCode.CANTEEN_MANAGER];
