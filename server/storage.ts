import {
  users,
  searchQueries,
  crawledSites,
  tokenTransactions,
  type User,
  type InsertUser,
  type SearchQuery,
  type InsertSearchQuery,
  type CrawledSite,
  type InsertCrawledSite,
  type TokenTransaction,
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, like, ilike, and } from "drizzle-orm";
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
}

export const storage = new DatabaseStorage();
