import { pgTable, serial, varchar, boolean, timestamp, index, text, integer, numeric, date } from "drizzle-orm/pg-core"
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
		contact_name: varchar("contact_name", { length: 64 }),
		contact_phone: varchar("contact_phone", { length: 20 }),
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
 * 隶属于食堂，支持外送/外卖标记
 */
export const stalls = pgTable(
	"stalls",
	{
		id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
		canteen_id: varchar("canteen_id", { length: 36 }).notNull().references(() => canteens.id, { onDelete: "cascade" }),
		name: varchar("name", { length: 128 }).notNull(),
		manager_id: varchar("manager_id", { length: 36 }), // 档口负责人 user id
		has_delivery: boolean("has_delivery").default(false).notNull(), // 是否有外送
		has_takeout: boolean("has_takeout").default(false).notNull(), // 是否有外卖
		contact_name: varchar("contact_name", { length: 64 }),
		contact_phone: varchar("contact_phone", { length: 20 }),
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
/**
 * 餐别表
 * 隶属于食堂，营收录入时的餐别下拉数据源
 */
export const meal_types = pgTable(
	"meal_types",
	{
		id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
		canteen_id: varchar("canteen_id", { length: 36 }).notNull().references(() => canteens.id, { onDelete: "cascade" }),
		name: varchar("name", { length: 64 }).notNull(),
		is_active: boolean("is_active").default(true).notNull(),
		created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
		updated_at: timestamp("updated_at", { withTimezone: true }),
	},
	(table) => [
		index("meal_types_canteen_id_idx").on(table.canteen_id),
		index("meal_types_is_active_idx").on(table.is_active),
	]
);

/**
 * 营收类型表
 * 隶属于食堂，营收录入时的类型下拉数据源
 */
export const revenue_types = pgTable(
	"revenue_types",
	{
		id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
		canteen_id: varchar("canteen_id", { length: 36 }).notNull().references(() => canteens.id, { onDelete: "cascade" }),
		name: varchar("name", { length: 64 }).notNull(),
		is_active: boolean("is_active").default(true).notNull(),
		created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
		updated_at: timestamp("updated_at", { withTimezone: true }),
	},
	(table) => [
		index("revenue_types_canteen_id_idx").on(table.canteen_id),
		index("revenue_types_is_active_idx").on(table.is_active),
	]
);

/**
 * 用户表
 * role_code 决定用户角色，org_id 为多态关联
 * expires_at: 账号有效期截止日期，仅对公司负责人直接设置，食堂/档口负责人自动继承公司有效期
 * is_disabled: 开发者手动禁用标记
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
		role_code: varchar("role_code", { length: 32 }).notNull(),
		org_id: varchar("org_id", { length: 36 }),
		is_active: boolean("is_active").default(true).notNull(),
		is_disabled: boolean("is_disabled").default(false).notNull(),
		expires_at: timestamp("expires_at", { withTimezone: true }),
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

/**
 * 公司系统参数表
 * 开发者为每个公司设置的系统级参数
 */
export const company_params = pgTable(
	"company_params",
	{
		id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
		company_id: varchar("company_id", { length: 36 }).notNull().references(() => companies.id, { onDelete: "cascade" }).unique(),
		max_canteens: integer("max_canteens").default(10).notNull(), // 允许开设的食堂总数
		account_expires_at: timestamp("account_expires_at", { withTimezone: true }), // 公司账号有效期，级联至下属所有用户
		created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
		updated_at: timestamp("updated_at", { withTimezone: true }),
	},
	(table) => [
		index("company_params_company_id_idx").on(table.company_id),
	]
);

/**
 * 营收记录表
 * 每日各档口的营收数据
 * 唯一约束：同一档口+同一日期+同一餐别 不可重复
 */
export const revenue_records = pgTable(
	"revenue_records",
	{
		id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
		canteen_id: varchar("canteen_id", { length: 36 }).notNull().references(() => canteens.id, { onDelete: "cascade" }),
		stall_id: varchar("stall_id", { length: 36 }).notNull().references(() => stalls.id, { onDelete: "cascade" }),
		meal_type_id: varchar("meal_type_id", { length: 36 }).notNull().references(() => meal_types.id, { onDelete: "restrict" }),
		record_date: date("record_date").notNull(), // 营业日期
		order_count: integer("order_count").default(0).notNull(), // 订单数
		amount: numeric("amount", { precision: 12, scale: 2 }).notNull().default('0'), // 金额（元）
		note: text("note"), // 备注
		created_by: varchar("created_by", { length: 36 }), // 创建人 user id
		is_active: boolean("is_active").default(true).notNull(),
		created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
		updated_at: timestamp("updated_at", { withTimezone: true }),
	},
	(table) => [
		index("revenue_records_canteen_id_idx").on(table.canteen_id),
		index("revenue_records_stall_id_idx").on(table.stall_id),
		index("revenue_records_record_date_idx").on(table.record_date),
		index("revenue_records_created_by_idx").on(table.created_by),
	]
);

/**
 * 支出类别枚举
 * 食材采购、电费、水费、人工、房租、折旧、其他
 */

/**
 * 支出记录表
 * 每日各项支出，食材采购可关联商品信息
 */
export const expense_records = pgTable(
	"expense_records",
	{
		id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
		canteen_id: varchar("canteen_id", { length: 36 }).notNull().references(() => canteens.id, { onDelete: "cascade" }),
		expense_date: date("expense_date").notNull(), // 支出日期
		category: varchar("category", { length: 32 }).notNull(), // 支出类别
		amount: numeric("amount", { precision: 12, scale: 2 }).notNull().default('0'), // 金额（元）
		note: text("note"), // 备注
		is_auto_generated: boolean("is_auto_generated").default(false).notNull(), // 是否由固定支出自动生成
		fixed_expense_id: varchar("fixed_expense_id", { length: 36 }), // 关联固定支出ID
		stall_id: varchar("stall_id", { length: 36 }), // 关联档口（可选）
		is_daily_repeat: boolean("is_daily_repeat").default(false).notNull(), // 是否当月每天重复
		repeat_group_id: varchar("repeat_group_id", { length: 36 }), // 重复组ID，同组数据同步修改
		product_category_id: varchar("product_category_id", { length: 36 }), // 食材品类（仅食材采购）
		product_id: varchar("product_id", { length: 36 }), // 食材名称（仅食材采购）
		quantity: numeric("quantity", { precision: 12, scale: 2 }), // 数量（仅食材采购）
		unit_price: numeric("unit_price", { precision: 12, scale: 2 }), // 单价（仅食材采购）
		product_spec_id: varchar("product_spec_id", { length: 36 }), // 规格（仅食材采购）
		created_by: varchar("created_by", { length: 36 }), // 创建人 user id
		is_active: boolean("is_active").default(true).notNull(),
		created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
		updated_at: timestamp("updated_at", { withTimezone: true }),
	},
	(table) => [
		index("expense_records_canteen_id_idx").on(table.canteen_id),
		index("expense_records_expense_date_idx").on(table.expense_date),
		index("expense_records_category_idx").on(table.category),
		index("expense_records_created_by_idx").on(table.created_by),
		index("expense_records_stall_id_idx").on(table.stall_id),
		index("expense_records_repeat_group_id_idx").on(table.repeat_group_id),
	]
);

/**
 * 供应商表
 */
export const suppliers = pgTable(
	"suppliers",
	{
		id: varchar({ length: 36 }).primaryKey(),
		companyId: varchar("company_id", { length: 36 }).notNull(),
		name: varchar({ length: 100 }).notNull(),
		contactPerson: varchar("contact_person", { length: 50 }),
		contactPhone: varchar("contact_phone", { length: 20 }),
		address: varchar({ length: 200 }),
		note: text(),
		isActive: boolean("is_active").default(true).notNull(),
		createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
		updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }),
	},
	(table) => [
		index("suppliers_company_id_idx").on(table.companyId),
	]
);

/**
 * 固定支出表
 * 由公司负责人预设，支持起始/结束时间，系统自动在日期范围内生成支出记录
 */
export const fixed_expenses = pgTable(
	"fixed_expenses",
	{
		id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
		canteen_id: varchar("canteen_id", { length: 36 }).notNull().references(() => canteens.id, { onDelete: "cascade" }),
		category: varchar("category", { length: 64 }).notNull(), // 支出类别（用户自定义）
		amount: numeric("amount", { precision: 12, scale: 2 }).notNull().default('0'), // 每日金额
		start_date: date("start_date"), // 起始日期
		end_date: date("end_date"), // 结束日期
		note: text("note"), // 备注
		is_active: boolean("is_active").default(true).notNull(),
		created_by: varchar("created_by", { length: 36 }),
		created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
		updated_at: timestamp("updated_at", { withTimezone: true }),
	},
	(table) => [
		index("fixed_expenses_canteen_id_idx").on(table.canteen_id),
		index("fixed_expenses_is_active_idx").on(table.is_active),
	]
);

/**
 * 操作日志表
 * 记录关键操作，供开发者审计
 */
export const operation_logs = pgTable(
	"operation_logs",
	{
		id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
		user_id: varchar("user_id", { length: 36 }), // 操作人
		username: varchar("username", { length: 64 }), // 操作人用户名（冗余，便于查询）
		action: varchar("action", { length: 64 }).notNull(), // 操作类型：LOGIN / CREATE / UPDATE / DELETE / EXPORT 等
		detail: text("detail"), // 操作详情 JSON
		ip: varchar("ip", { length: 45 }), // 操作IP
		created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
	},
	(table) => [
		index("operation_logs_user_id_idx").on(table.user_id),
		index("operation_logs_action_idx").on(table.action),
		index("operation_logs_created_at_idx").on(table.created_at),
	]
);

/**
 * 商品大类表
 * 隶属于公司，支出模块中食材采购的品类下拉数据源
 */
export const product_categories = pgTable(
	"product_categories",
	{
		id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
		company_id: varchar("company_id", { length: 36 }).notNull().references(() => companies.id, { onDelete: "cascade" }),
		name: varchar("name", { length: 64 }).notNull(),
		is_active: boolean("is_active").default(true).notNull(),
		created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
		updated_at: timestamp("updated_at", { withTimezone: true }),
	},
	(table) => [
		index("product_categories_company_id_idx").on(table.company_id),
	]
);

/**
 * 商品表
 * 隶属于商品大类
 */
export const products = pgTable(
	"products",
	{
		id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
		category_id: varchar("category_id", { length: 36 }).notNull().references(() => product_categories.id, { onDelete: "cascade" }),
		name: varchar("name", { length: 128 }).notNull(),
			note: text("note"),
		is_active: boolean("is_active").default(true).notNull(),
		created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
		updated_at: timestamp("updated_at", { withTimezone: true }),
	},
	(table) => [
		index("products_category_id_idx").on(table.category_id),
	]
);

/**
 * 商品规格表
 * 隶属于商品，如：斤、千克、箱、包等
 */
export const product_specs = pgTable(
	"product_specs",
	{
		id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
		product_id: varchar("product_id", { length: 36 }).notNull().references(() => products.id, { onDelete: "cascade" }),
		name: varchar("name", { length: 32 }).notNull(),
		is_active: boolean("is_active").default(true).notNull(),
			note: text("note"),
		created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
		updated_at: timestamp("updated_at", { withTimezone: true }),
	},
	(table) => [
		index("product_specs_product_id_idx").on(table.product_id),
	]
);
