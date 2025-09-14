import { storage } from './storage';
import { DNSResolver, RobotsTxtParser, type TokenBucket } from './crawler-core';
import { type CrawlQueue, type Domain, type InsertFetchLog } from '@shared/schema';

/**
 * Intelligent Crawler Scheduler
 * Manages crawl queue processing with rate limiting, retry logic, and politeness controls
 */

export interface CrawlSchedulerConfig {
  maxConcurrentCrawls: number;
  defaultDelayMs: number;
  maxRetryAttempts: number;
  retryBackoffBase: number; // Base multiplier for exponential backoff
  respectRobotsTxt: boolean;
  userAgent: string;
  queueCheckIntervalMs: number;
  maxQueueProcessingTime: number; // Max time per queue processing cycle
  priorityThreshold: number; // Minimum priority to process
  domainConcurrencyLimit: number; // Max concurrent requests per domain
}

export interface CrawlItem {
  id: string;
  domainId: string;
  url: string;
  priority: number;
  attempts: number;
  scheduledAt: Date;
  reason: string;
  domain?: Domain;
}

export interface SchedulerStats {
  totalProcessed: number;
  successfulCrawls: number;
  failedCrawls: number;
  retriedCrawls: number;
  queueSize: number;
  averageProcessingTime: number;
  domainsActive: number;
  rateLimitedDomains: number;
  uptime: number;
  throughputPerHour: number;
  errorRate: number;
}

export interface DomainState {
  domain: string;
  lastCrawlTime: number;
  crawlDelayMs: number;
  tokenBucket: TokenBucket;
  activeCrawls: number;
  totalCrawls: number;
  consecutiveErrors: number;
  blocked: boolean;
  robotsTxtLastFetch: number;
}

export class CrawlerScheduler {
  private config: CrawlSchedulerConfig;
  private isRunning = false;
  private stats: SchedulerStats;
  private startTime: number;
  private domainStates = new Map<string, DomainState>();
  private activePromises = new Map<string, Promise<void>>();
  private processingQueue = false;

  constructor(config: Partial<CrawlSchedulerConfig> = {}) {
    this.config = {
      maxConcurrentCrawls: 50,
      defaultDelayMs: 1000,
      maxRetryAttempts: 3,
      retryBackoffBase: 2,
      respectRobotsTxt: true,
      userAgent: 'YHTBot/1.0 (+https://yht-search.replit.app)',
      queueCheckIntervalMs: 5000, // Check queue every 5 seconds
      maxQueueProcessingTime: 30000, // 30 seconds max per cycle
      priorityThreshold: 20,
      domainConcurrencyLimit: 3,
      ...config
    };

    this.stats = {
      totalProcessed: 0,
      successfulCrawls: 0,
      failedCrawls: 0,
      retriedCrawls: 0,
      queueSize: 0,
      averageProcessingTime: 0,
      domainsActive: 0,
      rateLimitedDomains: 0,
      uptime: 0,
      throughputPerHour: 0,
      errorRate: 0,
    };

    this.startTime = Date.now();

    console.log(`🤖 Crawler Scheduler initialized with config:`, {
      maxConcurrentCrawls: this.config.maxConcurrentCrawls,
      defaultDelayMs: this.config.defaultDelayMs,
      maxRetryAttempts: this.config.maxRetryAttempts,
      userAgent: this.config.userAgent,
    });
  }

  /**
   * Start the scheduler
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      console.log('⚠️ Crawler scheduler is already running');
      return;
    }

    this.isRunning = true;
    this.startTime = Date.now();
    console.log('🚀 Starting crawler scheduler...');

    // Start the main processing loop
    this.processQueueLoop().catch(error => {
      console.error('❌ Fatal error in crawler scheduler:', error);
      this.stop();
    });

    // Start stats reporting interval
    this.startStatsReporting();
  }

  /**
   * Stop the scheduler
   */
  async stop(): Promise<void> {
    console.log('🛑 Stopping crawler scheduler...');
    this.isRunning = false;

    // Wait for active crawls to complete
    const activePromises = Array.from(this.activePromises.values());
    if (activePromises.length > 0) {
      console.log(`⏳ Waiting for ${activePromises.length} active crawls to complete...`);
      await Promise.allSettled(activePromises);
    }

    console.log('✅ Crawler scheduler stopped');
  }

  /**
   * Main queue processing loop
   */
  private async processQueueLoop(): Promise<void> {
    while (this.isRunning) {
      try {
        await this.processQueueBatch();
        await this.sleep(this.config.queueCheckIntervalMs);
      } catch (error) {
        console.error('❌ Error in queue processing loop:', error instanceof Error ? error.message : String(error));
        await this.sleep(this.config.queueCheckIntervalMs * 2); // Back off on errors
      }
    }
  }

  /**
   * Process a batch of items from the crawl queue
   */
  private async processQueueBatch(): Promise<void> {
    if (this.processingQueue) {
      return; // Already processing
    }

    this.processingQueue = true;
    const cycleStart = Date.now();

    try {
      // Clean up completed promises
      this.cleanupCompletedPromises();

      // Calculate how many new crawls we can start
      const availableSlots = this.config.maxConcurrentCrawls - this.activePromises.size;
      if (availableSlots <= 0) {
        return;
      }

      // Get items from queue
      const queueItems = await storage.getNextCrawlItems(availableSlots * 2); // Get extra to filter
      this.stats.queueSize = queueItems.length;

      if (queueItems.length === 0) {
        return;
      }

      // Filter and prioritize items
      const readyItems = await this.filterReadyItems(queueItems);
      const itemsToProcess = readyItems.slice(0, availableSlots);

      // Start crawling selected items
      for (const item of itemsToProcess) {
        this.startCrawlItem(item);
      }

      // Update stats
      this.updateCycleStats(Date.now() - cycleStart);

    } finally {
      this.processingQueue = false;
    }
  }

  /**
   * Filter items that are ready to be crawled
   */
  private async filterReadyItems(queueItems: CrawlQueue[]): Promise<CrawlItem[]> {
    const readyItems: CrawlItem[] = [];
    const now = Date.now();

    for (const item of queueItems) {
      // Skip low priority items
      if (item.priority < this.config.priorityThreshold) {
        continue;
      }

      // Get or create domain state
      const domain = await storage.getDomainById(item.domainId);
      if (!domain) {
        console.warn(`⚠️ Domain not found for queue item ${item.id}`);
        await storage.removeCrawlQueueItem(item.id);
        continue;
      }

      const domainState = await this.getDomainState(domain);

      // Check if domain is blocked
      if (domainState.blocked) {
        continue;
      }

      // Check rate limiting
      if (!this.canCrawlDomain(domainState, now)) {
        continue;
      }

      // Check domain concurrency limit
      if (domainState.activeCrawls >= this.config.domainConcurrencyLimit) {
        continue;
      }

      readyItems.push({
        id: item.id,
        domainId: item.domainId,
        url: item.url,
        priority: item.priority,
        attempts: item.attempts,
        scheduledAt: item.scheduledAt,
        reason: item.reason,
        domain
      });
    }

    // Sort by priority (higher first)
    return readyItems.sort((a, b) => b.priority - a.priority);
  }

  /**
   * Start crawling an individual item
   */
  private startCrawlItem(item: CrawlItem): void {
    const promise = this.crawlItem(item)
      .catch(error => {
        console.error(`❌ Error crawling ${item.url}:`, error instanceof Error ? error.message : String(error));
      })
      .finally(() => {
        this.activePromises.delete(item.id);
      });

    this.activePromises.set(item.id, promise);
  }

  /**
   * Crawl a single item
   */
  private async crawlItem(item: CrawlItem): Promise<void> {
    const startTime = Date.now();
    const domainState = this.domainStates.get(item.domain!.domain)!;
    
    // Update domain state
    domainState.activeCrawls++;
    domainState.lastCrawlTime = startTime;

    // Consume token from bucket
    this.consumeToken(domainState.tokenBucket);

    let fetchLog: InsertFetchLog = {
      url: item.url,
      startedAt: new Date(startTime),
      finishedAt: new Date(),
      bytes: 0,
      durationMs: 0,
      error: '',
      httpStatus: 0,
    };

    try {
      // Check robots.txt if needed
      if (this.config.respectRobotsTxt) {
        await this.ensureRobotsTxt(item.domain!, domainState);
        
        // Check if URL is allowed by robots.txt
        if (item.domain!.robotsTxt) {
          const robotsTxt = await RobotsTxtParser.fetchAndParseRobotsTxt(`https://${item.domain!.domain}`);
          const pathname = new URL(item.url).pathname;
          if (!robotsTxt.isAllowed(this.config.userAgent.toLowerCase(), pathname)) {
            console.log(`🤖 Robots.txt disallows crawling ${item.url}`);
            await this.handleCrawlResult(item, domainState, { blocked: true });
            return;
          }
        }
      }

      console.log(`🕷️ Crawling: ${item.url} (attempt ${item.attempts + 1})`);

      // Perform the actual crawl (this would be implemented by the background crawler)
      const result = await this.performCrawl(item);
      
      fetchLog.finishedAt = new Date();
      fetchLog.durationMs = Date.now() - startTime;
      fetchLog.httpStatus = result.status;
      fetchLog.bytes = result.bytes;
      fetchLog.error = result.error;

      // Log the fetch
      await storage.createFetchLog(fetchLog);

      // Handle the result
      await this.handleCrawlResult(item, domainState, result);

      this.stats.successfulCrawls++;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`❌ Failed to crawl ${item.url}:`, errorMessage);

      fetchLog.finishedAt = new Date();
      fetchLog.durationMs = Date.now() - startTime;
      fetchLog.error = errorMessage;

      await storage.createFetchLog(fetchLog);
      await this.handleCrawlError(item, domainState, errorMessage);

      this.stats.failedCrawls++;
    } finally {
      // Update domain state
      domainState.activeCrawls--;
      domainState.totalCrawls++;
      this.stats.totalProcessed++;
    }
  }

  /**
   * Perform the actual crawl (placeholder - will be implemented by background crawler)
   */
  private async performCrawl(item: CrawlItem): Promise<{
    status: number;
    bytes: number;
    error: string;
    blocked?: boolean;
  }> {
    // This is a placeholder - the actual crawling logic will be implemented 
    // by the background crawler service
    await this.sleep(100); // Simulate crawl time
    
    return {
      status: 200,
      bytes: 1024,
      error: '',
    };
  }

  /**
   * Handle successful crawl result
   */
  private async handleCrawlResult(
    item: CrawlItem, 
    domainState: DomainState, 
    result: { status: number; bytes: number; error: string; blocked?: boolean }
  ): Promise<void> {
    
    if (result.blocked) {
      // Remove from queue but don't retry
      await storage.removeCrawlQueueItem(item.id);
      return;
    }

    if (result.status >= 200 && result.status < 300) {
      // Success - remove from queue
      await storage.removeCrawlQueueItem(item.id);
      domainState.consecutiveErrors = 0;
    } else if (result.status >= 400 && result.status < 500) {
      // Client error - usually don't retry
      await storage.removeCrawlQueueItem(item.id);
      domainState.consecutiveErrors++;
    } else {
      // Server error - retry if attempts remaining
      await this.handleRetry(item, domainState, `HTTP ${result.status}`);
    }
  }

  /**
   * Handle crawl error
   */
  private async handleCrawlError(item: CrawlItem, domainState: DomainState, error: string): Promise<void> {
    domainState.consecutiveErrors++;
    await this.handleRetry(item, domainState, error);
  }

  /**
   * Handle retry logic
   */
  private async handleRetry(item: CrawlItem, domainState: DomainState, error: string): Promise<void> {
    if (item.attempts >= this.config.maxRetryAttempts) {
      console.log(`❌ Max retries reached for ${item.url}, removing from queue`);
      await storage.removeCrawlQueueItem(item.id);
      
      // Block domain if too many consecutive errors
      if (domainState.consecutiveErrors >= 10) {
        console.warn(`⚠️ Blocking domain ${domainState.domain} due to consecutive errors`);
        domainState.blocked = true;
        await storage.updateDomainStatus(item.domainId, 'error');
      }
    } else {
      // Increment attempts and reschedule
      await storage.incrementCrawlAttempts(item.id);
      this.stats.retriedCrawls++;
      
      // Exponential backoff delay
      const backoffDelayMs = Math.min(
        this.config.defaultDelayMs * Math.pow(this.config.retryBackoffBase, item.attempts),
        300000 // Max 5 minutes
      );
      
      console.log(`🔄 Retrying ${item.url} in ${backoffDelayMs}ms (attempt ${item.attempts + 2})`);
    }
  }

  /**
   * Get or create domain state
   */
  private async getDomainState(domain: Domain): Promise<DomainState> {
    let domainState = this.domainStates.get(domain.domain);
    
    if (!domainState) {
      domainState = {
        domain: domain.domain,
        lastCrawlTime: 0,
        crawlDelayMs: domain.crawlDelayMs || this.config.defaultDelayMs,
        tokenBucket: this.createTokenBucket(domain.crawlDelayMs || this.config.defaultDelayMs),
        activeCrawls: 0,
        totalCrawls: 0,
        consecutiveErrors: 0,
        blocked: domain.status === 'blocked' || domain.status === 'error',
        robotsTxtLastFetch: domain.robotsFetchedAt ? domain.robotsFetchedAt.getTime() : 0,
      };
      
      this.domainStates.set(domain.domain, domainState);
    }

    return domainState;
  }

  /**
   * Check if we can crawl a domain now
   */
  private canCrawlDomain(domainState: DomainState, now: number): boolean {
    // Check rate limiting via token bucket
    return domainState.tokenBucket.tokens > 0;
  }

  /**
   * Create a token bucket for rate limiting
   */
  private createTokenBucket(crawlDelayMs: number): TokenBucket {
    const refillRate = 1000 / crawlDelayMs; // tokens per second
    return {
      tokens: 10, // Initial tokens
      capacity: 10,
      refillRate,
      lastRefill: Date.now(),
    };
  }

  /**
   * Consume a token from the bucket
   */
  private consumeToken(bucket: TokenBucket): boolean {
    this.refillTokenBucket(bucket);
    
    if (bucket.tokens >= 1) {
      bucket.tokens--;
      return true;
    }
    
    return false;
  }

  /**
   * Refill token bucket based on elapsed time
   */
  private refillTokenBucket(bucket: TokenBucket): void {
    const now = Date.now();
    const elapsedMs = now - bucket.lastRefill;
    const tokensToAdd = (elapsedMs / 1000) * bucket.refillRate;
    
    bucket.tokens = Math.min(bucket.capacity, bucket.tokens + tokensToAdd);
    bucket.lastRefill = now;
  }

  /**
   * Ensure robots.txt is fetched for domain
   */
  private async ensureRobotsTxt(domain: Domain, domainState: DomainState): Promise<void> {
    const now = Date.now();
    const robotsTxtAge = now - domainState.robotsTxtLastFetch;
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours

    if (robotsTxtAge > maxAge) {
      try {
        const robotsTxt = await RobotsTxtParser.fetchAndParseRobotsTxt(`https://${domain.domain}`);
        
        await storage.updateDomain(domain.id!, {
          robotsTxt: JSON.stringify(robotsTxt),
          robotsFetchedAt: new Date(),
          crawlDelayMs: robotsTxt.crawlDelay,
        });

        domainState.robotsTxtLastFetch = now;
        domainState.crawlDelayMs = robotsTxt.crawlDelay;
        domainState.tokenBucket = this.createTokenBucket(robotsTxt.crawlDelay);

      } catch (error) {
        console.warn(`⚠️ Failed to fetch robots.txt for ${domain.domain}:`, error instanceof Error ? error.message : String(error));
      }
    }
  }

  /**
   * Clean up completed promises
   */
  private cleanupCompletedPromises(): void {
    const toRemove: string[] = [];
    
    for (const [key, promise] of this.activePromises.entries()) {
      // Check if promise is settled by using a race with immediate resolution
      Promise.race([promise, Promise.resolve('completed')])
        .then(result => {
          if (result === 'completed') {
            toRemove.push(key);
          }
        })
        .catch(() => {
          toRemove.push(key);
        });
    }

    for (const key of toRemove) {
      this.activePromises.delete(key);
    }
  }

  /**
   * Update stats after each processing cycle
   */
  private updateCycleStats(cycleTimeMs: number): void {
    this.stats.averageProcessingTime = 
      (this.stats.averageProcessingTime * 0.9) + (cycleTimeMs * 0.1);
    
    this.stats.domainsActive = this.domainStates.size;
    
    this.stats.rateLimitedDomains = Array.from(this.domainStates.values())
      .filter(state => !this.canCrawlDomain(state, Date.now())).length;

    this.stats.uptime = Date.now() - this.startTime;
    
    if (this.stats.uptime > 0) {
      this.stats.throughputPerHour = (this.stats.totalProcessed * 3600000) / this.stats.uptime;
    }

    if (this.stats.totalProcessed > 0) {
      this.stats.errorRate = this.stats.failedCrawls / this.stats.totalProcessed;
    }
  }

  /**
   * Start periodic stats reporting
   */
  private startStatsReporting(): void {
    const reportInterval = 60000; // Report every minute

    const reportStats = async () => {
      if (!this.isRunning) return;

      const queueStats = await storage.getCrawlQueueStats();
      this.stats.queueSize = queueStats.pending;

      console.log('📊 Crawler Scheduler Stats:', {
        uptime: Math.round(this.stats.uptime / 60000) + 'm',
        processed: this.stats.totalProcessed,
        success: this.stats.successfulCrawls,
        failed: this.stats.failedCrawls,
        retried: this.stats.retriedCrawls,
        queueSize: this.stats.queueSize,
        activeCrawls: this.activePromises.size,
        domainsActive: this.stats.domainsActive,
        rateLimited: this.stats.rateLimitedDomains,
        throughputPerHour: Math.round(this.stats.throughputPerHour),
        errorRate: Math.round(this.stats.errorRate * 100) + '%',
      });

      setTimeout(reportStats, reportInterval);
    };

    setTimeout(reportStats, reportInterval);
  }

  /**
   * Get current stats
   */
  getStats(): SchedulerStats {
    return { ...this.stats };
  }

  /**
   * Get domain states for monitoring
   */
  getDomainStates(): Map<string, DomainState> {
    return new Map(this.domainStates);
  }

  /**
   * Force unblock a domain
   */
  async unblockDomain(domain: string): Promise<boolean> {
    const domainState = this.domainStates.get(domain);
    if (domainState) {
      domainState.blocked = false;
      domainState.consecutiveErrors = 0;
      
      // Update database status
      const domainRecord = await storage.getDomain(domain);
      if (domainRecord) {
        await storage.updateDomainStatus(domainRecord.id!, 'active');
      }
      
      return true;
    }
    return false;
  }

  /**
   * Utility sleep function
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get configuration
   */
  getConfig(): CrawlSchedulerConfig {
    return { ...this.config };
  }

  /**
   * Update configuration (some settings can be changed at runtime)
   */
  updateConfig(newConfig: Partial<CrawlSchedulerConfig>): void {
    Object.assign(this.config, newConfig);
    console.log('⚙️ Updated crawler scheduler config:', newConfig);
  }
}

export const crawlerScheduler = new CrawlerScheduler();