import jwt, { type SignOptions } from 'jsonwebtoken';
import type { AuthTokenPayload } from './types';

const JWT_SECRET = process.env.JWT_SECRET || 'canteen-mgmt-jwt-secret-key-change-in-production';
const JWT_EXPIRES_IN = (process.env.JWT_EXPIRES_IN || '24h') as jwt.SignOptions['expiresIn'];

/**
 * 签发 JWT Token
 */
export function signToken(payload: AuthTokenPayload): string {
  const options: SignOptions = { expiresIn: JWT_EXPIRES_IN };
  return jwt.sign(payload as object, JWT_SECRET, options);
}

/**
 * 验证 JWT Token
 * 返回解码后的 payload 或 null（token 无效/过期时）
 */
export function verifyToken(token: string): AuthTokenPayload | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as AuthTokenPayload;
    return decoded;
  } catch {
    return null;
  }
}

/**
 * 从 Authorization header 中提取 Bearer token
 */
export function extractBearerToken(authHeader: string | null): string | null {
  if (!authHeader) return null;
  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') return null;
  return parts[1];
}
