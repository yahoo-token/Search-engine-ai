import {
  users,
  searchQueries,
  crawledSites,
  tokenTransactions,
  domains,
  pages,
  crawlQueue,
  links,
  fetchLog,
  type User,
  type InsertUser,
  type SearchQuery,
  type InsertSearchQuery,
  type CrawledSite,
  type InsertCrawledSite,
  type TokenTransaction,
  type Domain,
  type InsertDomain,
  type Page,
  type InsertPage,
  type CrawlQueue,
  type InsertCrawlQueue,
  type Link,
  type InsertLink,
  type FetchLog,
  type InsertFetchLog,
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, like, ilike, and, asc, lte, gte, isNull, sql } from "drizzle-orm";
import session from "express-session";
import connectPg from "connect-pg-simple";

const PostgresSessionStore = connectPg(session);

export interface IStorage {
  // User operations
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUserBalance(userId: string, balance: string): Promise<void>;

  // Search operations
  createSearchQuery(query: InsertSearchQuery & { userId: string; aiResponse?: string; tokensEarned?: string }): Promise<SearchQuery>;
  getSearchHistory(userId: string): Promise<SearchQuery[]>;
  
  // Crawled sites operations
  createCrawledSite(site: InsertCrawledSite): Promise<CrawledSite>;
  searchCrawledSites(query: string, category?: string): Promise<CrawledSite[]>;
  updateSiteRanking(siteId: string, ranking: number): Promise<void>;
  
  // Token operations
  createTokenTransaction(transaction: {
    userId: string;
    type: string;
    amount: string;
    reason?: string;
    searchQueryId?: string;
  }): Promise<TokenTransaction>;
  getUserTokenTransactions(userId: string): Promise<TokenTransaction[]>;

  // Crawler domain operations
  createDomain(domain: InsertDomain): Promise<Domain>;
  getDomain(domain: string): Promise<Domain | undefined>;
  getDomainById(id: string): Promise<Domain | undefined>;
  updateDomain(id: string, updates: Partial<InsertDomain>): Promise<void>;
  listDomains(status?: string, limit?: number): Promise<Domain[]>;
  updateDomainStatus(id: string, status: string): Promise<void>;
  incrementDomainErrorCount(id: string): Promise<void>;
  resetDomainErrorCount(id: string): Promise<void>;

  // Crawler page operations
  createPage(page: InsertPage): Promise<Page>;
  getPage(url: string): Promise<Page | undefined>;
  getPageById(id: string): Promise<Page | undefined>;
  updatePage(id: string, updates: Partial<InsertPage>): Promise<void>;
  getPagesByDomain(domainId: string, limit?: number): Promise<Page[]>;
  searchPages(query: string, limit?: number): Promise<Page[]>;

  // Crawler queue operations
  addToCrawlQueue(item: InsertCrawlQueue): Promise<CrawlQueue>;
  getNextCrawlItems(limit?: number): Promise<CrawlQueue[]>;
  removeCrawlQueueItem(id: string): Promise<void>;
  incrementCrawlAttempts(id: string): Promise<void>;
  getCrawlQueueStats(): Promise<{ pending: number; total: number }>;

  // Link operations
  saveLinks(links: InsertLink[]): Promise<void>;
  getLinksFromPage(pageId: string): Promise<Link[]>;
  getLinksToUrl(url: string): Promise<Link[]>;

  // Fetch log operations
  createFetchLog(log: InsertFetchLog): Promise<FetchLog>;
  getFetchLogsByPage(pageId: string, limit?: number): Promise<FetchLog[]>;
  getRecentFetchLogs(limit?: number): Promise<FetchLog[]>;
  getFetchStats(since?: Date): Promise<{
    totalFetches: number;
    successfulFetches: number;
    avgResponseTime: number;
    totalBytes: number;
  }>;

  sessionStore: session.Store;
}

export class DatabaseStorage implements IStorage {
  sessionStore: session.Store;

  constructor() {
    this.sessionStore = new PostgresSessionStore({
      conString: process.env.DATABASE_URL,
      createTableIfMissing: false,
      tableName: 'sessions',
    });
  }

  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(insertUser)
      .returning();
    return user;
  }

  async updateUserBalance(userId: string, balance: string): Promise<void> {
    await db
      .update(users)
      .set({ yhtBalance: balance, updatedAt: new Date() })
      .where(eq(users.id, userId));
  }

  async createSearchQuery(queryData: InsertSearchQuery & { userId: string; aiResponse?: string; tokensEarned?: string }): Promise<SearchQuery> {
    const [query] = await db
      .insert(searchQueries)
      .values(queryData)
      .returning();
    return query;
  }

  async getSearchHistory(userId: string): Promise<SearchQuery[]> {
    return await db
      .select()
      .from(searchQueries)
      .where(eq(searchQueries.userId, userId))
      .orderBy(desc(searchQueries.createdAt))
      .limit(50);
  }

  async createCrawledSite(site: InsertCrawledSite): Promise<CrawledSite> {
    const [crawledSite] = await db
      .insert(crawledSites)
      .values(site)
      .returning();
    return crawledSite;
  }

  async searchCrawledSites(query: string, category?: string): Promise<CrawledSite[]> {
    const conditions = [
      eq(crawledSites.isActive, true),
    ];

    if (category && category !== "all") {
      conditions.push(eq(crawledSites.category, category));
    }

    if (query) {
      conditions.push(
        ilike(crawledSites.title, `%${query}%`)
      );
    }

    return await db
      .select()
      .from(crawledSites)
      .where(and(...conditions))
      .orderBy(desc(crawledSites.ranking))
      .limit(20);
  }

  async updateSiteRanking(siteId: string, ranking: number): Promise<void> {
    await db
      .update(crawledSites)
      .set({ ranking })
      .where(eq(crawledSites.id, siteId));
  }

  async createTokenTransaction(transaction: {
    userId: string;
    type: string;
    amount: string;
    reason?: string;
    searchQueryId?: string;
  }): Promise<TokenTransaction> {
    const [tokenTransaction] = await db
      .insert(tokenTransactions)
      .values(transaction)
      .returning();
    return tokenTransaction;
  }

  async getUserTokenTransactions(userId: string): Promise<TokenTransaction[]> {
    return await db
      .select()
      .from(tokenTransactions)
      .where(eq(tokenTransactions.userId, userId))
      .orderBy(desc(tokenTransactions.createdAt))
      .limit(100);
  }

  // Crawler domain operations
  async createDomain(domainData: InsertDomain): Promise<Domain> {
    const [domain] = await db
      .insert(domains)
      .values(domainData)
      .returning();
    return domain;
  }

  async getDomain(domainName: string): Promise<Domain | undefined> {
    const [domain] = await db
      .select()
      .from(domains)
      .where(eq(domains.domain, domainName));
    return domain || undefined;
  }

  async getDomainById(id: string): Promise<Domain | undefined> {
    const [domain] = await db
      .select()
      .from(domains)
      .where(eq(domains.id, id));
    return domain || undefined;
  }

  async updateDomain(id: string, updates: Partial<InsertDomain>): Promise<void> {
    await db
      .update(domains)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(domains.id, id));
  }

  async listDomains(status?: string, limit: number = 100): Promise<Domain[]> {
    const conditions = [];
    if (status) {
      conditions.push(eq(domains.status, status));
    }

    return await db
      .select()
      .from(domains)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(domains.createdAt))
      .limit(limit);
  }

  async updateDomainStatus(id: string, status: string): Promise<void> {
    await db
      .update(domains)
      .set({ status, updatedAt: new Date() })
      .where(eq(domains.id, id));
  }

  async incrementDomainErrorCount(id: string): Promise<void> {
    await db
      .update(domains)
      .set({ 
        errorCount: sql`${domains.errorCount} + 1`,
        updatedAt: new Date()
      })
      .where(eq(domains.id, id));
  }

  async resetDomainErrorCount(id: string): Promise<void> {
    await db
      .update(domains)
      .set({ errorCount: 0, updatedAt: new Date() })
      .where(eq(domains.id, id));
  }

  // Crawler page operations
  async createPage(pageData: InsertPage): Promise<Page> {
    const [page] = await db
      .insert(pages)
      .values(pageData)
      .returning();
    return page;
  }

  async getPage(url: string): Promise<Page | undefined> {
    const [page] = await db
      .select()
      .from(pages)
      .where(eq(pages.url, url));
    return page || undefined;
  }

  async getPageById(id: string): Promise<Page | undefined> {
    const [page] = await db
      .select()
      .from(pages)
      .where(eq(pages.id, id));
    return page || undefined;
  }

  async updatePage(id: string, updates: Partial<InsertPage>): Promise<void> {
    await db
      .update(pages)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(pages.id, id));
  }

  async getPagesByDomain(domainId: string, limit: number = 50): Promise<Page[]> {
    return await db
      .select()
      .from(pages)
      .where(eq(pages.domainId, domainId))
      .orderBy(desc(pages.lastFetchedAt))
      .limit(limit);
  }

  async searchPages(query: string, limit: number = 20): Promise<Page[]> {
    return await db
      .select()
      .from(pages)
      .where(
        and(
          ilike(pages.title, `%${query}%`)
        )
      )
      .orderBy(desc(pages.lastFetchedAt))
      .limit(limit);
  }

  // Crawler queue operations
  async addToCrawlQueue(itemData: InsertCrawlQueue): Promise<CrawlQueue> {
    const [item] = await db
      .insert(crawlQueue)
      .values(itemData)
      .returning();
    return item;
  }

  async getNextCrawlItems(limit: number = 10): Promise<CrawlQueue[]> {
    return await db
      .select()
      .from(crawlQueue)
      .orderBy(desc(crawlQueue.priority), asc(crawlQueue.scheduledAt))
      .limit(limit);
  }

  async removeCrawlQueueItem(id: string): Promise<void> {
    await db
      .delete(crawlQueue)
      .where(eq(crawlQueue.id, id));
  }

  async incrementCrawlAttempts(id: string): Promise<void> {
    await db
      .update(crawlQueue)
      .set({ attempts: sql`${crawlQueue.attempts} + 1` })
      .where(eq(crawlQueue.id, id));
  }

  async getCrawlQueueStats(): Promise<{ pending: number; total: number }> {
    const [stats] = await db
      .select({
        pending: sql<number>`count(*)`,
        total: sql<number>`count(*)`
      })
      .from(crawlQueue);

    return {
      pending: stats?.pending || 0,
      total: stats?.total || 0
    };
  }

  // Link operations
  async saveLinks(linkData: InsertLink[]): Promise<void> {
    if (linkData.length === 0) return;
    
    await db
      .insert(links)
      .values(linkData)
      .onConflictDoNothing();
  }

  async getLinksFromPage(pageId: string): Promise<Link[]> {
    return await db
      .select()
      .from(links)
      .where(eq(links.fromPageId, pageId))
      .orderBy(asc(links.discoveredAt));
  }

  async getLinksToUrl(url: string): Promise<Link[]> {
    return await db
      .select()
      .from(links)
      .where(eq(links.toUrl, url))
      .orderBy(desc(links.discoveredAt));
  }

  // Fetch log operations
  async createFetchLog(logData: InsertFetchLog): Promise<FetchLog> {
    const [log] = await db
      .insert(fetchLog)
      .values(logData)
      .returning();
    return log;
  }

  async getFetchLogsByPage(pageId: string, limit: number = 20): Promise<FetchLog[]> {
    return await db
      .select()
      .from(fetchLog)
      .where(eq(fetchLog.pageId, pageId))
      .orderBy(desc(fetchLog.startedAt))
      .limit(limit);
  }

  async getRecentFetchLogs(limit: number = 50): Promise<FetchLog[]> {
    return await db
      .select()
      .from(fetchLog)
      .orderBy(desc(fetchLog.startedAt))
      .limit(limit);
  }

  async getFetchStats(since?: Date): Promise<{
    totalFetches: number;
    successfulFetches: number;
    avgResponseTime: number;
    totalBytes: number;
  }> {
    const conditions = [];
    if (since) {
      conditions.push(gte(fetchLog.startedAt, since));
    }

    const [stats] = await db
      .select({
        totalFetches: sql<number>`count(*)`,
        successfulFetches: sql<number>`count(*) filter (where ${fetchLog.httpStatus} >= 200 and ${fetchLog.httpStatus} < 300)`,
        avgResponseTime: sql<number>`avg(${fetchLog.durationMs})`,
        totalBytes: sql<number>`sum(${fetchLog.bytes})`
      })
      .from(fetchLog)
      .where(conditions.length > 0 ? and(...conditions) : undefined);

    return {
      totalFetches: stats?.totalFetches || 0,
      successfulFetches: stats?.successfulFetches || 0,
      avgResponseTime: Math.round(stats?.avgResponseTime || 0),
      totalBytes: stats?.totalBytes || 0
    };
  }
}

export const storage = new DatabaseStorage();
