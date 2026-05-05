import { pgTable, serial, varchar, boolean, timestamp, index, text } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"


// ==================== 系统表（禁止删除） ====================

export const healthCheck = pgTable("health_check", {
	id: serial().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
});

// ==================== 业务表 ====================

/**
 * 角色枚举值说明：
 * - SYSTEM_DEVELOPER: 系统开发者，全局最高权限
 * - COMPANY_MANAGER:  公司负责人，管理自己公司下的食堂
 * - CANTEEN_MANAGER:  食堂负责人，管理自己食堂下的档口
 * - STALL_MANAGER:    档口负责人，仅能填写自己档口的营收数据
 * - REGULAR_USER:     普通订餐用户
 */

/**
 * 公司表
 * 组织架构顶层：公司 → 食堂 → 档口
 */
export const companies = pgTable(
	"companies",
	{
		id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
		name: varchar("name", { length: 128 }).notNull(),
		address: varchar("address", { length: 256 }),
		contact_phone: varchar("contact_phone", { length: 20 }),
		manager_id: varchar("manager_id", { length: 36 }), // 公司负责人 user id
		is_active: boolean("is_active").default(true).notNull(),
		created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
		updated_at: timestamp("updated_at", { withTimezone: true }),
	},
	(table) => [
		index("companies_manager_id_idx").on(table.manager_id),
		index("companies_is_active_idx").on(table.is_active),
	]
);

/**
 * 食堂表
 * 隶属于公司，包含多个档口
 */
export const canteens = pgTable(
	"canteens",
	{
		id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
		company_id: varchar("company_id", { length: 36 }).notNull().references(() => companies.id, { onDelete: "cascade" }),
		name: varchar("name", { length: 128 }).notNull(),
		address: varchar("address", { length: 256 }),
		manager_id: varchar("manager_id", { length: 36 }), // 食堂负责人 user id
		is_active: boolean("is_active").default(true).notNull(),
		created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
		updated_at: timestamp("updated_at", { withTimezone: true }),
	},
	(table) => [
		index("canteens_company_id_idx").on(table.company_id),
		index("canteens_manager_id_idx").on(table.manager_id),
		index("canteens_is_active_idx").on(table.is_active),
	]
);

/**
 * 档口表
 * 隶属于食堂
 */
export const stalls = pgTable(
	"stalls",
	{
		id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
		canteen_id: varchar("canteen_id", { length: 36 }).notNull().references(() => canteens.id, { onDelete: "cascade" }),
		name: varchar("name", { length: 128 }).notNull(),
		manager_id: varchar("manager_id", { length: 36 }), // 档口负责人 user id
		is_active: boolean("is_active").default(true).notNull(),
		created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
		updated_at: timestamp("updated_at", { withTimezone: true }),
	},
	(table) => [
		index("stalls_canteen_id_idx").on(table.canteen_id),
		index("stalls_manager_id_idx").on(table.manager_id),
		index("stalls_is_active_idx").on(table.is_active),
	]
);

/**
 * 用户表
 * role_code 决定用户角色，org_id 为多态关联：
 * - COMPANY_MANAGER → org_id 指向 companies.id
 * - CANTEEN_MANAGER → org_id 指向 canteens.id
 * - STALL_MANAGER   → org_id 指向 stalls.id
 * - SYSTEM_DEVELOPER / REGULAR_USER → org_id 为 null
 */
export const users = pgTable(
	"users",
	{
		id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
		username: varchar("username", { length: 64 }).notNull().unique(),
		password_hash: text("password_hash").notNull(),
		real_name: varchar("real_name", { length: 64 }).notNull(),
		phone: varchar("phone", { length: 20 }),
		email: varchar("email", { length: 128 }),
		role_code: varchar("role_code", { length: 32 }).notNull(), // SYSTEM_DEVELOPER | COMPANY_MANAGER | CANTEEN_MANAGER | STALL_MANAGER | REGULAR_USER
		org_id: varchar("org_id", { length: 36 }), // 多态关联，根据 role_code 解析
		is_active: boolean("is_active").default(true).notNull(),
		created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
		updated_at: timestamp("updated_at", { withTimezone: true }),
	},
	(table) => [
		index("users_username_idx").on(table.username),
		index("users_role_code_idx").on(table.role_code),
		index("users_org_id_idx").on(table.org_id),
		index("users_is_active_idx").on(table.is_active),
	]
);
