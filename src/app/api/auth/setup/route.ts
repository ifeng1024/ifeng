import { NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { hashPassword } from '@/lib/auth/password';
import type { ApiResponse } from '@/lib/auth/types';

/**
 * POST /api/auth/setup
 * 初始化种子数据：创建系统开发者账号 + 测试数据
 * 仅在数据库无用户时允许执行（防止重复初始化）
 */
export async function POST() {
  try {
    const client = getSupabaseClient();

    // 检查是否已有用户（防止重复初始化）
    const { data: existingUsers, error: checkError } = await client
      .from('users')
      .select('id')
      .limit(1);

    if (checkError) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: `检查失败: ${checkError.message}` },
        { status: 500 }
      );
    }

    if (existingUsers && existingUsers.length > 0) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: '系统已初始化，禁止重复执行' },
        { status: 400 }
      );
    }

    // 创建密码哈希
    const [
      devHash,
      companyManagerHash,
      canteenManagerHash,
      stallManagerHash,
      userHash,
    ] = await Promise.all([
      hashPassword('dev123456'),
      hashPassword('company123456'),
      hashPassword('canteen123456'),
      hashPassword('stall123456'),
      hashPassword('user123456'),
    ]);

    // 1. 创建公司
    const { data: company, error: companyError } = await client
      .from('companies')
      .insert({ name: '示例科技有限公司', address: '北京市海淀区中关村大街1号', contact_phone: '010-12345678' })
      .select()
      .single();

    if (companyError) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: `创建公司失败: ${companyError.message}` },
        { status: 500 }
      );
    }

    // 2. 创建食堂
    const { data: canteen, error: canteenError } = await client
      .from('canteens')
      .insert({ company_id: company.id, name: '总部一楼食堂', address: 'A栋1楼' })
      .select()
      .single();

    if (canteenError) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: `创建食堂失败: ${canteenError.message}` },
        { status: 500 }
      );
    }

    // 3. 创建档口
    const { data: stall, error: stallError } = await client
      .from('stalls')
      .insert({ canteen_id: canteen.id, name: '川味小炒档口' })
      .select()
      .single();

    if (stallError) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: `创建档口失败: ${stallError.message}` },
        { status: 500 }
      );
    }

    // 4. 创建用户（先创建不含 org_id 的用户，再回填）
    const usersToCreate = [
      { username: 'dev', password_hash: devHash, real_name: '系统开发者', role_code: 'SYSTEM_DEVELOPER', org_id: null },
      { username: 'company_mgr', password_hash: companyManagerHash, real_name: '公司负责人', role_code: 'COMPANY_MANAGER', org_id: company.id },
      { username: 'canteen_mgr', password_hash: canteenManagerHash, real_name: '食堂负责人', role_code: 'CANTEEN_MANAGER', org_id: canteen.id },
      { username: 'stall_mgr', password_hash: stallManagerHash, real_name: '档口负责人', role_code: 'STALL_MANAGER', org_id: stall.id },
      { username: 'user1', password_hash: userHash, real_name: '普通用户', role_code: 'REGULAR_USER', org_id: null },
    ];

    const { data: createdUsers, error: usersError } = await client
      .from('users')
      .insert(usersToCreate)
      .select();

    if (usersError) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: `创建用户失败: ${usersError.message}` },
        { status: 500 }
      );
    }

    // 5. 回填组织表的 manager_id
    const users = createdUsers as Array<{ id: string; role_code: string }>;
    const companyManager = users.find((u) => u.role_code === 'COMPANY_MANAGER');
    const canteenManager = users.find((u) => u.role_code === 'CANTEEN_MANAGER');
    const stallManager = users.find((u) => u.role_code === 'STALL_MANAGER');

    if (companyManager) {
      await client.from('companies').update({ manager_id: companyManager.id }).eq('id', company.id);
    }
    if (canteenManager) {
      await client.from('canteens').update({ manager_id: canteenManager.id }).eq('id', canteen.id);
    }
    if (stallManager) {
      await client.from('stalls').update({ manager_id: stallManager.id }).eq('id', stall.id);
    }

    return NextResponse.json<ApiResponse>({
      success: true,
      data: {
        message: '初始化完成',
        accounts: [
          { username: 'dev', password: 'dev123456', role: '系统开发者' },
          { username: 'company_mgr', password: 'company123456', role: '公司负责人' },
          { username: 'canteen_mgr', password: 'canteen123456', role: '食堂负责人' },
          { username: 'stall_mgr', password: 'stall123456', role: '档口负责人' },
          { username: 'user1', password: 'user123456', role: '普通用户' },
        ],
        company: { id: company.id, name: company.name },
        canteen: { id: canteen.id, name: canteen.name },
        stall: { id: stall.id, name: stall.name },
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : '初始化失败';
    return NextResponse.json<ApiResponse>(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
