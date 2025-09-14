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
  searchCrawledSites(query: string, category?: string, options?: {
    limit?: number;
    offset?: number;
  }): Promise<{ results: CrawledSite[]; totalCount: number }>;
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

  // Full-text search operations
  searchPagesFullText(query: string, options?: {
    category?: string;
    limit?: number;
    offset?: number;
    includeRanking?: boolean;
    includeHeadlines?: boolean;
  }): Promise<{
    results: Array<Page & {
      rankScore?: number;
      headlineTitle?: string;
      headlineDescription?: string;
    }>;
    totalCount: number;
    searchStats?: {
      avgRankScore: number;
      topCategories: Array<{ category: string; count: number }>;
    };
  }>;

  // Content indexing operations
  indexPageContent(pageId: string, content: {
    title: string;
    description?: string;
    textContent?: string;
    category?: string;
    meta?: Record<string, any>;
  }): Promise<void>;

  // Hybrid search combining legacy and new systems
  searchContent(query: string, category?: string, options?: {
    limit?: number;
    offset?: number;
    includeRanking?: boolean;
    useFullText?: boolean;
  }): Promise<{
    results: Array<{
      id: string;
      url: string;
      title: string;
      description: string;
      category: string;
      ranking?: number;
      source: 'crawled_sites' | 'pages';
      rankScore?: number;
    }>;
    totalCount: number;
    searchStats?: {
      avgRankScore: number;
      topCategories: Array<{ category: string; count: number }>;
    };
  }>;

  // Popular/default results for homepage
  getPopularResults(options?: {
    limit?: number;
    category?: string;
  }): Promise<{
    results: Array<{
      id: string;
      url: string;
      title: string;
      description: string;
      category: string;
      ranking?: number;
      source: 'crawled_sites' | 'pages';
    }>;
    totalCount: number;
  }>;

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

  // Discovery operations
  addBatchToCrawlQueue(items: InsertCrawlQueue[]): Promise<CrawlQueue[]>;
  getCrawlQueueByReason(reason: string, limit?: number): Promise<CrawlQueue[]>;
  getDiscoveryStats(domainId?: string): Promise<{
    totalQueued: number;
    byReason: Record<string, number>;
    avgPriority: number;
    oldestItem: Date | null;
  }>;
  removeDuplicateCrawlQueueItems(domainId: string): Promise<number>;

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

  async searchCrawledSites(query: string, category?: string, options: {
    limit?: number;
    offset?: number;
  } = {}): Promise<{ results: CrawledSite[]; totalCount: number }> {
    const { limit = 20, offset = 0 } = options;
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

    // Get total count
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)` })
      .from(crawledSites)
      .where(and(...conditions));

    // Get paginated results
    const results = await db
      .select()
      .from(crawledSites)
      .where(and(...conditions))
      .orderBy(desc(crawledSites.ranking))
      .limit(limit)
      .offset(offset);

    return {
      results,
      totalCount: count
    };
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

  // Discovery operations
  async addBatchToCrawlQueue(items: InsertCrawlQueue[]): Promise<CrawlQueue[]> {
    if (items.length === 0) return [];
    
    return await db
      .insert(crawlQueue)
      .values(items)
      .onConflictDoNothing()
      .returning();
  }

  async getCrawlQueueByReason(reason: string, limit: number = 100): Promise<CrawlQueue[]> {
    return await db
      .select()
      .from(crawlQueue)
      .where(eq(crawlQueue.reason, reason))
      .orderBy(desc(crawlQueue.priority), asc(crawlQueue.scheduledAt))
      .limit(limit);
  }

  async getDiscoveryStats(domainId?: string): Promise<{
    totalQueued: number;
    byReason: Record<string, number>;
    avgPriority: number;
    oldestItem: Date | null;
  }> {
    const conditions = [];
    if (domainId) {
      conditions.push(eq(crawlQueue.domainId, domainId));
    }

    const [stats] = await db
      .select({
        totalQueued: sql<number>`count(*)`,
        avgPriority: sql<number>`avg(${crawlQueue.priority})`,
        oldestItem: sql<Date>`min(${crawlQueue.scheduledAt})`
      })
      .from(crawlQueue)
      .where(conditions.length > 0 ? and(...conditions) : undefined);

    // Get reason breakdown
    const reasonStats = await db
      .select({
        reason: crawlQueue.reason,
        count: sql<number>`count(*)`
      })
      .from(crawlQueue)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .groupBy(crawlQueue.reason);

    const byReason: Record<string, number> = {};
    reasonStats.forEach(stat => {
      byReason[stat.reason] = stat.count;
    });

    return {
      totalQueued: stats?.totalQueued || 0,
      byReason,
      avgPriority: Math.round(stats?.avgPriority || 0),
      oldestItem: stats?.oldestItem || null
    };
  }

  async removeDuplicateCrawlQueueItems(domainId: string): Promise<number> {
    // Remove duplicate URLs in crawl queue for a domain, keeping the highest priority one
    const result = await db.execute(sql`
      DELETE FROM ${crawlQueue} 
      WHERE ${crawlQueue.domainId} = ${domainId}
      AND ${crawlQueue.id} NOT IN (
        SELECT DISTINCT ON (${crawlQueue.url}) ${crawlQueue.id}
        FROM ${crawlQueue}
        WHERE ${crawlQueue.domainId} = ${domainId}
        ORDER BY ${crawlQueue.url}, ${crawlQueue.priority} DESC, ${crawlQueue.scheduledAt} ASC
      )
    `);
    
    return result.rowCount || 0;
  }

  // Full-text search operations
  async searchPagesFullText(query: string, options: {
    category?: string;
    limit?: number;
    offset?: number;
    includeRanking?: boolean;
    includeHeadlines?: boolean;
  } = {}): Promise<{
    results: Array<Page & {
      rankScore?: number;
      headlineTitle?: string;
      headlineDescription?: string;
    }>;
    totalCount: number;
    searchStats?: {
      avgRankScore: number;
      topCategories: Array<{ category: string; count: number }>;
    };
  }> {
    const {
      category,
      limit = 20,
      offset = 0,
      includeRanking = true,
      includeHeadlines = true
    } = options;

    if (!query || query.trim().length === 0) {
      return { results: [], totalCount: 0 };
    }

    try {
      // Use the PostgreSQL search function we created
      const searchResults = await db.execute(sql`
        SELECT * FROM search_pages_with_ranking(
          ${query},
          ${category || null},
          ${limit},
          ${offset}
        );
      `);

      const results = (searchResults.rows || []).map((row: any) => ({
        id: row.id,
        domainId: row.domain_id,
        url: row.url,
        httpStatus: null,
        contentHash: null,
        title: row.title,
        description: row.description,
        textContent: null,
        meta: {},
        lang: null,
        category: row.category,
        lastFetchedAt: row.last_fetched_at,
        etag: null,
        lastModified: null,
        titleTsv: null,
        bodyTsv: null,
        createdAt: null,
        updatedAt: null,
        ...(includeRanking && { rankScore: row.rank_score }),
        ...(includeHeadlines && {
          headlineTitle: row.headline_title,
          headlineDescription: row.headline_description
        })
      }));

      // Get total count
      const countResult = await db.execute(sql`
        SELECT COUNT(*) as total
        FROM pages p
        WHERE (
          p.title_tsv @@ plainto_tsquery('yht_web_content', ${query}) OR 
          p.body_tsv @@ plainto_tsquery('yht_web_content', ${query})
        )
        ${category && category !== 'all' ? sql`AND p.category = ${category}` : sql``}
      `);

      const totalCount = countResult.rows?.[0]?.total || 0;

      // Get search stats if requested
      let searchStats;
      if (includeRanking) {
        try {
          const statsResult = await db.execute(sql`
            SELECT * FROM get_search_stats(${query});
          `);
          
          if (statsResult.rows?.[0]) {
            const statsRow = statsResult.rows[0];
            searchStats = {
              avgRankScore: statsRow.avg_rank_score || 0,
              topCategories: statsRow.top_categories || []
            };
          }
        } catch (error) {
          console.warn('Failed to get search stats:', error);
        }
      }

      return {
        results,
        totalCount: Number(totalCount),
        searchStats
      };
    } catch (error) {
      console.error('Full-text search failed:', error);
      return { results: [], totalCount: 0 };
    }
  }

  // Content indexing operations
  async indexPageContent(pageId: string, content: {
    title: string;
    description?: string;
    textContent?: string;
    category?: string;
    meta?: Record<string, any>;
  }): Promise<void> {
    try {
      const updateData: any = {
        title: content.title,
        updatedAt: new Date()
      };

      if (content.description !== undefined) {
        updateData.description = content.description;
      }

      if (content.textContent !== undefined) {
        updateData.textContent = content.textContent;
      }

      if (content.category !== undefined) {
        updateData.category = content.category;
      }

      if (content.meta !== undefined) {
        updateData.meta = content.meta;
      }

      await db
        .update(pages)
        .set(updateData)
        .where(eq(pages.id, pageId));

      console.log(`Indexed content for page ${pageId}`);
    } catch (error) {
      console.error(`Failed to index content for page ${pageId}:`, error);
      throw error;
    }
  }

  // Hybrid search combining legacy and new systems
  async searchContent(query: string, category?: string, options: {
    limit?: number;
    offset?: number;
    includeRanking?: boolean;
    useFullText?: boolean;
  } = {}): Promise<{
    results: Array<{
      id: string;
      url: string;
      title: string;
      description: string;
      category: string;
      ranking?: number;
      source: 'crawled_sites' | 'pages';
      rankScore?: number;
    }>;
    totalCount: number;
    searchStats?: {
      avgRankScore: number;
      topCategories: Array<{ category: string; count: number }>;
    };
  }> {
    const {
      limit = 20,
      offset = 0,
      includeRanking = true,
      useFullText = true
    } = options;

    const results: Array<{
      id: string;
      url: string;
      title: string;
      description: string;
      category: string;
      ranking?: number;
      source: 'crawled_sites' | 'pages';
      rankScore?: number;
    }> = [];

    let totalCount = 0;
    let searchStats: { avgRankScore: number; topCategories: Array<{ category: string; count: number }>; } | undefined;

    try {
      // Search pages table with full-text search
      if (useFullText) {
        const pageResults = await this.searchPagesFullText(query, {
          category,
          limit: Math.ceil(limit * 0.7), // 70% from pages
          offset: Math.floor(offset * 0.7),
          includeRanking,
          includeHeadlines: false
        });

        results.push(...pageResults.results.map(page => ({
          id: page.id,
          url: page.url,
          title: page.title || '',
          description: page.description || '',
          category: page.category || 'general',
          source: 'pages' as const,
          rankScore: page.rankScore
        })));

        totalCount += pageResults.totalCount;
        searchStats = pageResults.searchStats;
      }

      // Search legacy crawled_sites table for remaining slots
      const remainingLimit = limit - results.length;
      const remainingOffset = Math.max(0, offset - results.length);
      
      if (remainingLimit > 0) {
        const legacyResults = await this.searchCrawledSites(query, category, {
          limit: remainingLimit,
          offset: remainingOffset
        });
        
        results.push(...legacyResults.results.map(site => ({
          id: site.id,
          url: site.url,
          title: site.title || '',
          description: site.description || '',
          category: site.category || 'general',
          ranking: site.ranking ?? undefined,
          source: 'crawled_sites' as const
        })));

        totalCount += legacyResults.totalCount;
      }

      // Sort by ranking/relevance
      results.sort((a, b) => {
        const aScore = a.rankScore ?? a.ranking ?? 0;
        const bScore = b.rankScore ?? b.ranking ?? 0;
        return bScore - aScore;
      });

      return {
        results: results.slice(0, limit),
        totalCount,
        searchStats
      };
    } catch (error) {
      console.error('Hybrid search failed:', error);
      // Fallback to legacy search
      const legacyResults = await this.searchCrawledSites(query, category, { limit, offset });
      return {
        results: legacyResults.results.map(site => ({
          id: site.id,
          url: site.url,
          title: site.title || '',
          description: site.description || '',
          category: site.category || 'general',
          ranking: site.ranking ?? undefined,
          source: 'crawled_sites' as const
        })),
        totalCount: legacyResults.totalCount
      };
    }
  }

  // Popular/default results for homepage
  async getPopularResults(options: {
    limit?: number;
    category?: string;
  } = {}): Promise<{
    results: Array<{
      id: string;
      url: string;
      title: string;
      description: string;
      category: string;
      ranking?: number;
      source: 'crawled_sites' | 'pages';
    }>;
    totalCount: number;
  }> {
    const { limit = 20, category } = options;

    try {
      // Get popular pages from both sources, prioritizing higher ranked content
      const results: Array<{
        id: string;
        url: string;
        title: string;
        description: string;
        category: string;
        ranking?: number;
        source: 'crawled_sites' | 'pages';
      }> = [];

      // Get top pages from pages table (based on recent activity and content)
      const pageConditions = [];
      if (category && category !== 'all') {
        pageConditions.push(eq(pages.category, category));
      }

      const topPages = await db
        .select()
        .from(pages)
        .where(pageConditions.length > 0 ? and(...pageConditions) : undefined)
        .orderBy(desc(pages.lastFetchedAt), desc(pages.createdAt))
        .limit(Math.ceil(limit * 0.6)); // 60% from pages

      results.push(...topPages.map(page => ({
        id: page.id,
        url: page.url,
        title: page.title || '',
        description: page.description || '',
        category: page.category || 'general',
        source: 'pages' as const
      })));

      // Get popular crawled sites for remaining slots
      const remainingLimit = limit - results.length;
      if (remainingLimit > 0) {
        const siteConditions = [eq(crawledSites.isActive, true)];
        if (category && category !== 'all') {
          siteConditions.push(eq(crawledSites.category, category));
        }

        const topSites = await db
          .select()
          .from(crawledSites)
          .where(and(...siteConditions))
          .orderBy(desc(crawledSites.ranking), desc(crawledSites.lastCrawled))
          .limit(remainingLimit);

        results.push(...topSites.map(site => ({
          id: site.id,
          url: site.url,
          title: site.title || '',
          description: site.description || '',
          category: site.category || 'general',
          ranking: site.ranking,
          source: 'crawled_sites' as const
        })));
      }

      // Get total count for pagination
      const totalPagesCount = await db
        .select({ count: sql<number>`count(*)` })
        .from(pages)
        .where(pageConditions.length > 0 ? and(...pageConditions) : undefined);

      const totalSitesCount = await db
        .select({ count: sql<number>`count(*)` })
        .from(crawledSites)
        .where(and(...(category && category !== 'all' ? [eq(crawledSites.category, category), eq(crawledSites.isActive, true)] : [eq(crawledSites.isActive, true)])));

      const totalCount = (totalPagesCount[0]?.count || 0) + (totalSitesCount[0]?.count || 0);

      return {
        results: results.slice(0, limit),
        totalCount
      };

    } catch (error) {
      console.error('Failed to get popular results:', error);
      // Fallback to crawled sites only
      const conditions = [eq(crawledSites.isActive, true)];
      if (category && category !== 'all') {
        conditions.push(eq(crawledSites.category, category));
      }

      const fallbackResults = await db
        .select()
        .from(crawledSites)
        .where(and(...conditions))
        .orderBy(desc(crawledSites.ranking))
        .limit(limit);

      const totalCount = await db
        .select({ count: sql<number>`count(*)` })
        .from(crawledSites)
        .where(and(...conditions));

      return {
        results: fallbackResults.map(site => ({
          id: site.id,
          url: site.url,
          title: site.title || '',
          description: site.description || '',
          category: site.category || 'general',
          ranking: site.ranking,
          source: 'crawled_sites' as const
        })),
        totalCount: totalCount[0]?.count || 0
      };
    }
  }
}

export const storage = new DatabaseStorage();
