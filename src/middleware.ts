import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { jwtVerify } from 'jose';

const JWT_SECRET = process.env.JWT_SECRET || 'canteen-mgmt-jwt-secret-key-change-in-production';

/**
 * Next.js 中间件：API 路由的 JWT 认证拦截
 * 
 * 使用 jose（Edge Runtime 兼容）验证 JWT Token
 * 
 * 白名单路由（无需认证）：
 * - /api/auth/login
 * - /api/auth/setup
 * 
 * 其他 /api/* 路由均需要携带有效的 Bearer Token
 */
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 仅拦截 /api/ 路径
  if (!pathname.startsWith('/api/')) {
    return NextResponse.next();
  }

  // 白名单：无需认证的路由
  const publicRoutes = ['/api/auth/login', '/api/auth/setup'];
  if (publicRoutes.some((route) => pathname === route || pathname.startsWith(route + '/'))) {
    return NextResponse.next();
  }

  // 提取 Bearer Token
  const authHeader = request.headers.get('authorization');
  if (!authHeader) {
    return NextResponse.json(
      { success: false, error: '未授权，请先登录' },
      { status: 401 }
    );
  }

  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    return NextResponse.json(
      { success: false, error: 'Token 格式错误' },
      { status: 401 }
    );
  }

  const token = parts[1];

  try {
    // 使用 jose 验证 JWT（Edge Runtime 兼容）
    const secret = new TextEncoder().encode(JWT_SECRET);
    const { payload } = await jwtVerify(token, secret);

    // 将用户信息注入请求头，供后续 route handler 使用
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set('x-user-id', (payload.user_id as string) || '');
    requestHeaders.set('x-user-role', (payload.role_code as string) || '');
    requestHeaders.set('x-user-org-id', (payload.org_id as string) || '');
    requestHeaders.set('x-user-username', (payload.username as string) || '');

    return NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    });
  } catch {
    return NextResponse.json(
      { success: false, error: 'Token 无效或已过期' },
      { status: 401 }
    );
  }
}

export const config = {
  matcher: ['/api/:path*'],
};
