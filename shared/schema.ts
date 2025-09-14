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
  serial,
  unique,
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

// Domains table for crawler system
export const domains = pgTable("domains", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  domain: text("domain").notNull().unique(),
  status: varchar("status").notNull().default("pending"), // pending, active, blocked, error
  robotsTxt: text("robots_txt"),
  robotsFetchedAt: timestamp("robots_fetched_at"),
  sitemapUrls: text("sitemap_urls").array(),
  crawlDelayMs: integer("crawl_delay_ms").default(1000),
  lastCrawledAt: timestamp("last_crawled_at"),
  priority: integer("priority").default(50),
  errorCount: integer("error_count").default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Pages table for crawled content
export const pages = pgTable(
  "pages",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    domainId: varchar("domain_id").references(() => domains.id).notNull(),
    url: text("url").notNull().unique(), // normalized URL
    httpStatus: integer("http_status"),
    contentHash: text("content_hash"),
    title: text("title"),
    description: text("description"),
    textContent: text("text_content"),
    meta: jsonb("meta"), // page metadata, headers, etc.
    lang: varchar("lang"),
    category: varchar("category"),
    lastFetchedAt: timestamp("last_fetched_at").defaultNow(),
    etag: text("etag"),
    lastModified: timestamp("last_modified"),
    titleTsv: text("title_tsv"), // computed tsvector for full-text search
    bodyTsv: text("body_tsv"), // computed tsvector for full-text search
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    index("idx_pages_domain_id").on(table.domainId),
    index("idx_pages_url").on(table.url),
    index("idx_pages_last_fetched").on(table.lastFetchedAt),
    // Full-text search indexes will be created manually with SQL triggers
  ],
);

// Links table for page relationships
export const links = pgTable(
  "links",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    fromPageId: varchar("from_page_id").references(() => pages.id).notNull(),
    toUrl: text("to_url").notNull(), // normalized target URL
    nofollow: boolean("nofollow").default(false),
    discoveredAt: timestamp("discovered_at").defaultNow(),
  },
  (table) => [
    index("idx_links_from_page").on(table.fromPageId),
    index("idx_links_to_url").on(table.toUrl),
    unique("unique_link").on(table.fromPageId, table.toUrl),
  ],
);

// Crawl queue for scheduling
export const crawlQueue = pgTable(
  "crawl_queue",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    domainId: varchar("domain_id").references(() => domains.id).notNull(),
    url: text("url").notNull(), // normalized URL to crawl
    priority: integer("priority").default(50),
    scheduledAt: timestamp("scheduled_at").defaultNow(),
    attempts: integer("attempts").default(0),
    reason: varchar("reason").notNull(), // seed, sitemap, link
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    index("idx_crawl_queue_priority").on(table.priority),
    index("idx_crawl_queue_scheduled").on(table.scheduledAt),
    index("idx_crawl_queue_domain").on(table.domainId),
    unique("unique_crawl_queue_url").on(table.url),
  ],
);

// Fetch log for performance tracking
export const fetchLog = pgTable(
  "fetch_log",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    pageId: varchar("page_id").references(() => pages.id),
    url: text("url").notNull(),
    startedAt: timestamp("started_at").notNull(),
    finishedAt: timestamp("finished_at"),
    bytes: integer("bytes"),
    durationMs: integer("duration_ms"),
    error: text("error"),
    httpStatus: integer("http_status"),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    index("idx_fetch_log_page_id").on(table.pageId),
    index("idx_fetch_log_started_at").on(table.startedAt),
    index("idx_fetch_log_url").on(table.url),
  ],
);

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

// Crawler relations
export const domainsRelations = relations(domains, ({ many }) => ({
  pages: many(pages),
  crawlQueue: many(crawlQueue),
}));

export const pagesRelations = relations(pages, ({ one, many }) => ({
  domain: one(domains, {
    fields: [pages.domainId],
    references: [domains.id],
  }),
  outgoingLinks: many(links),
  fetchLogs: many(fetchLog),
}));

export const linksRelations = relations(links, ({ one }) => ({
  fromPage: one(pages, {
    fields: [links.fromPageId],
    references: [pages.id],
  }),
}));

export const crawlQueueRelations = relations(crawlQueue, ({ one }) => ({
  domain: one(domains, {
    fields: [crawlQueue.domainId],
    references: [domains.id],
  }),
}));

export const fetchLogRelations = relations(fetchLog, ({ one }) => ({
  page: one(pages, {
    fields: [fetchLog.pageId],
    references: [pages.id],
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

// New crawler table schemas
export const insertDomainSchema = createInsertSchema(domains).pick({
  domain: true,
  status: true,
  robotsTxt: true,
  sitemapUrls: true,
  crawlDelayMs: true,
  priority: true,
}).extend({
  domain: z.string().url("Must be a valid domain URL"),
  status: z.enum(["pending", "active", "blocked", "error"]).default("pending"),
  crawlDelayMs: z.number().min(0).max(60000).default(1000),
  priority: z.number().min(0).max(100).default(50),
});

export const insertPageSchema = createInsertSchema(pages).pick({
  domainId: true,
  url: true,
  httpStatus: true,
  contentHash: true,
  title: true,
  description: true,
  textContent: true,
  meta: true,
  lang: true,
  category: true,
  etag: true,
  lastModified: true,
}).extend({
  url: z.string().url("Must be a valid URL"),
  httpStatus: z.number().min(100).max(599).optional(),
  title: z.string().max(500).optional(),
  description: z.string().max(1000).optional(),
});

export const insertLinkSchema = createInsertSchema(links).pick({
  fromPageId: true,
  toUrl: true,
  nofollow: true,
}).extend({
  toUrl: z.string().url("Must be a valid URL"),
  nofollow: z.boolean().default(false),
});

export const insertCrawlQueueSchema = createInsertSchema(crawlQueue).pick({
  domainId: true,
  url: true,
  priority: true,
  reason: true,
}).extend({
  url: z.string().url("Must be a valid URL"),
  priority: z.number().min(0).max(100).default(50),
  reason: z.enum(["seed", "sitemap", "link"]),
});

export const insertFetchLogSchema = createInsertSchema(fetchLog).pick({
  pageId: true,
  url: true,
  startedAt: true,
  finishedAt: true,
  bytes: true,
  durationMs: true,
  error: true,
  httpStatus: true,
}).extend({
  url: z.string().url("Must be a valid URL"),
  startedAt: z.date(),
  bytes: z.number().min(0).optional(),
  durationMs: z.number().min(0).optional(),
  httpStatus: z.number().min(100).max(599).optional(),
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

// New crawler types
export type InsertDomain = z.infer<typeof insertDomainSchema>;
export type Domain = typeof domains.$inferSelect;
export type InsertPage = z.infer<typeof insertPageSchema>;
export type Page = typeof pages.$inferSelect;
export type InsertLink = z.infer<typeof insertLinkSchema>;
export type Link = typeof links.$inferSelect;
export type InsertCrawlQueue = z.infer<typeof insertCrawlQueueSchema>;
export type CrawlQueue = typeof crawlQueue.$inferSelect;
export type InsertFetchLog = z.infer<typeof insertFetchLogSchema>;
export type FetchLog = typeof fetchLog.$inferSelect;
