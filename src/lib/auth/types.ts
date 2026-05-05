import type { RoleCodeValue } from './constants';

/**
 * Auth Token Payload 结构
 */
export interface AuthTokenPayload {
  user_id: string;
  username: string;
  role_code: RoleCodeValue;
  org_id: string | null;
}

/**
 * 登录请求体
 */
export interface LoginRequest {
  username: string;
  password: string;
}

/**
 * 登录响应体
 */
export interface LoginResponse {
  success: boolean;
  data?: {
    token: string;
    user: {
      id: string;
      username: string;
      real_name: string;
      role_code: RoleCodeValue;
      org_id: string | null;
    };
  };
  error?: string;
}

/**
 * 通用 API 响应
 */
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * 创建食堂请求体
 */
export interface CreateCanteenRequest {
  name: string;
  address?: string;
}

/**
 * 指定食堂负责人请求体
 */
export interface AssignCanteenManagerRequest {
  user_id: string;
}

/**
 * 创建档口请求体
 */
export interface CreateStallRequest {
  name: string;
}

/**
 * 指定档口负责人请求体
 */
export interface AssignStallManagerRequest {
  user_id: string;
}

/**
 * 创建公司请求体
 */
export interface CreateCompanyRequest {
  name: string;
  address?: string;
  contact_phone?: string;
  manager_id?: string;
}

/**
 * 数据库用户记录类型
 */
export interface DbUser {
  id: string;
  username: string;
  password_hash: string;
  real_name: string;
  phone: string | null;
  email: string | null;
  role_code: RoleCodeValue;
  org_id: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string | null;
}

/**
 * 数据库公司记录类型
 */
export interface DbCompany {
  id: string;
  name: string;
  address: string | null;
  contact_phone: string | null;
  manager_id: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string | null;
}

/**
 * 数据库食堂记录类型
 */
export interface DbCanteen {
  id: string;
  company_id: string;
  name: string;
  address: string | null;
  manager_id: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string | null;
}

/**
 * 数据库档口记录类型
 */
export interface DbStall {
  id: string;
  canteen_id: string;
  name: string;
  manager_id: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string | null;
}
