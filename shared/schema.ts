import { sql } from "drizzle-orm";
import {
  pgTable,
  text,
  varchar,
  timestamp,
  integer,
  jsonb,
  index,
  boolean,
  decimal,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { relations } from "drizzle-orm";

// Session storage table for authentication
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

// Users table
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  email: text("email"),
  yhtBalance: decimal("yht_balance", { precision: 18, scale: 8 }).default("0"),
  walletAddress: text("wallet_address"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Search queries table
export const searchQueries = pgTable("search_queries", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id),
  query: text("query").notNull(),
  category: varchar("category").notNull().default("all"),
  results: jsonb("results"),
  aiResponse: text("ai_response"),
  tokensEarned: decimal("tokens_earned", { precision: 18, scale: 8 }).default("0"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Crawled websites table
export const crawledSites = pgTable("crawled_sites", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  url: text("url").notNull().unique(),
  title: text("title"),
  description: text("description"),
  content: text("content"),
  category: varchar("category").default("general"),
  favicon: text("favicon"),
  ranking: integer("ranking").default(0),
  lastCrawled: timestamp("last_crawled").defaultNow(),
  isActive: boolean("is_active").default(true),
  metadata: jsonb("metadata"),
});

// YHT token transactions table
export const tokenTransactions = pgTable("token_transactions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  type: varchar("type").notNull(), // "earned", "spent", "staked"
  amount: decimal("amount", { precision: 18, scale: 8 }).notNull(),
  reason: text("reason"),
  searchQueryId: varchar("search_query_id").references(() => searchQueries.id),
  transactionHash: text("transaction_hash"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  searchQueries: many(searchQueries),
  tokenTransactions: many(tokenTransactions),
}));

export const searchQueriesRelations = relations(searchQueries, ({ one, many }) => ({
  user: one(users, {
    fields: [searchQueries.userId],
    references: [users.id],
  }),
  tokenTransactions: many(tokenTransactions),
}));

export const tokenTransactionsRelations = relations(tokenTransactions, ({ one }) => ({
  user: one(users, {
    fields: [tokenTransactions.userId],
    references: [users.id],
  }),
  searchQuery: one(searchQueries, {
    fields: [tokenTransactions.searchQueryId],
    references: [searchQueries.id],
  }),
}));

// Zod schemas
export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
  email: true,
}).extend({
  username: z.string()
    .min(3, "Username must be at least 3 characters long")
    .max(50, "Username must be less than 50 characters")
    .regex(/^[a-zA-Z0-9_]+$/, "Username can only contain letters, numbers, and underscores")
    .trim(),
  password: z.string()
    .min(8, "Password must be at least 8 characters long")
    .max(100, "Password must be less than 100 characters"),
  email: z.string()
    .email("Please enter a valid email address")
    .optional()
    .or(z.literal(""))
    .transform(val => val === "" ? undefined : val),
});

export const loginSchema = z.object({
  username: z.string()
    .min(1, "Username is required")
    .trim(),
  password: z.string()
    .min(1, "Password is required"),
});

export const insertSearchQuerySchema = createInsertSchema(searchQueries).pick({
  query: true,
  category: true,
}).extend({
  query: z.string()
    .min(1, "Search query cannot be empty")
    .max(500, "Search query must be less than 500 characters")
    .trim(),
  category: z.string()
    .default("all")
    .refine(val => ["all", "shopping", "companies", "news", "saas", "cloud", "web3"].includes(val), 
      "Invalid search category"),
});

export const insertCrawledSiteSchema = createInsertSchema(crawledSites).pick({
  url: true,
  title: true,
  description: true,
  content: true,
  category: true,
});

// Types
export type InsertUser = z.infer<typeof insertUserSchema>;
export type LoginUser = z.infer<typeof loginSchema>;
export type User = typeof users.$inferSelect;
export type InsertSearchQuery = z.infer<typeof insertSearchQuerySchema>;
export type SearchQuery = typeof searchQueries.$inferSelect;
export type InsertCrawledSite = z.infer<typeof insertCrawledSiteSchema>;
export type CrawledSite = typeof crawledSites.$inferSelect;
export type TokenTransaction = typeof tokenTransactions.$inferSelect;
