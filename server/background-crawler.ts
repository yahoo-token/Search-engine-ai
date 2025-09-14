import { storage } from './storage';
import { crawlerScheduler, type CrawlItem } from './crawler-scheduler';
import { domainSeeder } from './domain-seeder';
import { CrawlerDiscoveryIntegration } from './crawler-integration';
import { 
  DNSResolver, 
  RobotsTxtParser, 
  ContentExtractor, 
  type FetchResult,
  type ExtractedContent 
} from './crawler-core';
import { 
  type Domain, 
  type Page, 
  type InsertPage, 
  type InsertFetchLog, 
  type InsertCrawlQueue 
} from '@shared/schema';
import { fetch, Headers } from 'undici';
import { createHash } from 'crypto';

/**
 * Comprehensive Background Crawler Service
 * Main orchestrator for continuous web crawling operations
 */

export interface BackgroundCrawlerConfig {
  enabled: boolean;
  seedOnStartup: boolean;
  maxConcurrentCrawls: number;
  requestTimeoutMs: number;
  userAgent: string;
  respectRobotsTxt: boolean;
  minCrawlDelayMs: number;
  maxRetries: number;
  discoveryEnabled: boolean;
  contentExtractionEnabled: boolean;
  maxPageSizeBytes: number;
  allowedContentTypes: string[];
  statsReportIntervalMs: number;
}

export interface CrawlerStats {
  startTime: number;
  uptime: number;
  totalCrawled: number;
  successfulCrawls: number;
  failedCrawls: number;
  bytesDownloaded: number;
  pagesDiscovered: number;
  queueSize: number;
  domainsActive: number;
  avgResponseTime: number;
  crawlsPerHour: number;
  errorRate: number;
  memoryUsage: NodeJS.MemoryUsage;
  lastCrawlTime?: number;
}

export class BackgroundCrawler {
  private config: BackgroundCrawlerConfig;
  private isRunning = false;
  private stats: CrawlerStats;
  private discovery: CrawlerDiscoveryIntegration;

  constructor(config: Partial<BackgroundCrawlerConfig> = {}) {
    this.config = {
      enabled: true,
      seedOnStartup: true,
      maxConcurrentCrawls: 50,
      requestTimeoutMs: 30000,
      userAgent: 'YHTBot/1.0 (+https://yht-search.replit.app)',
      respectRobotsTxt: true,
      minCrawlDelayMs: 1000,
      maxRetries: 3,
      discoveryEnabled: true,
      contentExtractionEnabled: true,
      maxPageSizeBytes: 10 * 1024 * 1024, // 10MB
      allowedContentTypes: ['text/html', 'application/xhtml+xml', 'text/xml'],
      statsReportIntervalMs: 60000, // 1 minute
      ...config
    };

    this.stats = {
      startTime: Date.now(),
      uptime: 0,
      totalCrawled: 0,
      successfulCrawls: 0,
      failedCrawls: 0,
      bytesDownloaded: 0,
      pagesDiscovered: 0,
      queueSize: 0,
      domainsActive: 0,
      avgResponseTime: 0,
      crawlsPerHour: 0,
      errorRate: 0,
      memoryUsage: process.memoryUsage(),
    };

    this.discovery = new CrawlerDiscoveryIntegration({
      maxLinksPerPage: 500,
      respectNofollow: true,
      extractResources: false,
      minPriority: 20,
      maxDepth: 10,
    });


    console.log('🕷️ Background Crawler initialized with config:', {
      enabled: this.config.enabled,
      maxConcurrentCrawls: this.config.maxConcurrentCrawls,
      userAgent: this.config.userAgent,
      discoveryEnabled: this.config.discoveryEnabled,
      contentExtractionEnabled: this.config.contentExtractionEnabled,
    });
  }

  /**
   * Start the background crawler service
   */
  async start(): Promise<void> {
    if (!this.config.enabled) {
      console.log('🚫 Background crawler is disabled');
      return;
    }

    if (this.isRunning) {
      console.log('⚠️ Background crawler is already running');
      return;
    }

    console.log('🚀 Starting background crawler service...');
    this.isRunning = true;
    this.stats.startTime = Date.now();

    try {
      // Seed domains if configured
      if (this.config.seedOnStartup) {
        await this.seedDomains();
      }

      // Configure and start scheduler
      crawlerScheduler.updateConfig({
        maxConcurrentCrawls: this.config.maxConcurrentCrawls,
        respectRobotsTxt: this.config.respectRobotsTxt,
        userAgent: this.config.userAgent,
        maxRetryAttempts: this.config.maxRetries,
        defaultDelayMs: this.config.minCrawlDelayMs,
      });

      // Replace scheduler's performCrawl method with our implementation
      this.integrateCrawlerWithScheduler();

      // Start the scheduler
      await crawlerScheduler.start();

      // Start stats reporting
      this.startStatsReporting();

      console.log('✅ Background crawler service started successfully');

    } catch (error) {
      console.error('❌ Failed to start background crawler:', error instanceof Error ? error.message : String(error));
      this.isRunning = false;
      throw error;
    }
  }

  /**
   * Stop the background crawler service
   */
  async stop(): Promise<void> {
    console.log('🛑 Stopping background crawler service...');
    this.isRunning = false;

    try {
      await crawlerScheduler.stop();
      console.log('✅ Background crawler service stopped');
    } catch (error) {
      console.error('❌ Error stopping background crawler:', error instanceof Error ? error.message : String(error));
    }
  }

  /**
   * Seed domains on startup
   */
  private async seedDomains(): Promise<void> {
    console.log('🌱 Seeding domains on startup...');
    
    try {
      const seedStats = await domainSeeder.seedAllDomains();
      
      if (seedStats.created > 0) {
        console.log(`🌱 Seeded ${seedStats.created} new domains`);
        await domainSeeder.queueHomepages();
        console.log('🚀 Queued homepage URLs for new domains');
      } else {
        console.log('🌱 No new domains to seed');
      }

    } catch (error) {
      console.error('❌ Error seeding domains:', error instanceof Error ? error.message : String(error));
    }
  }

  /**
   * Integrate our crawler with the scheduler
   */
  private integrateCrawlerWithScheduler(): void {
    // Replace the scheduler's performCrawl method
    const originalPerformCrawl = (crawlerScheduler as any).performCrawl.bind(crawlerScheduler);
    (crawlerScheduler as any).performCrawl = async (item: CrawlItem) => {
      return await this.performCrawl(item);
    };
  }

  /**
   * Perform the actual crawling of a URL
   */
  async performCrawl(item: CrawlItem): Promise<{
    status: number;
    bytes: number;
    error: string;
    blocked?: boolean;
  }> {
    const startTime = Date.now();
    
    try {
      console.log(`🕷️ Crawling: ${item.url}`);

      // Fetch the page content
      const fetchResult = await this.fetchUrl(item.url);
      
      if (fetchResult.status === 200) {
        // Process successful crawl
        await this.processSuccessfulCrawl(item, fetchResult);
        
        this.stats.successfulCrawls++;
        this.stats.bytesDownloaded += fetchResult.size;
        
        return {
          status: fetchResult.status,
          bytes: fetchResult.size,
          error: '',
        };
      } else {
        // Handle non-200 responses
        this.stats.failedCrawls++;
        return {
          status: fetchResult.status,
          bytes: 0,
          error: `HTTP ${fetchResult.status}`,
        };
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`❌ Error crawling ${item.url}:`, errorMessage);
      
      this.stats.failedCrawls++;
      return {
        status: 0,
        bytes: 0,
        error: errorMessage,
      };
    } finally {
      this.stats.totalCrawled++;
      this.stats.lastCrawlTime = Date.now();
      
      // Update average response time
      const responseTime = Date.now() - startTime;
      this.stats.avgResponseTime = (this.stats.avgResponseTime * 0.9) + (responseTime * 0.1);
    }
  }

  /**
   * Fetch URL content using undici
   */
  private async fetchUrl(url: string): Promise<FetchResult> {
    const startTime = Date.now();
    const redirects: string[] = [];
    let currentUrl = url;
    let redirectCount = 0;
    const maxRedirects = 5;

    while (redirectCount <= maxRedirects) {
      try {
        const response = await fetch(currentUrl, {
          method: 'GET',
          headers: new Headers({
            'User-Agent': this.config.userAgent,
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.5',
            'Accept-Encoding': 'gzip, deflate, br',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
            'Upgrade-Insecure-Requests': '1',
          }),
          signal: AbortSignal.timeout(this.config.requestTimeoutMs),
        });

        // Handle redirects
        if (response.status >= 300 && response.status < 400 && response.headers.get('location')) {
          const location = response.headers.get('location')!;
          redirects.push(currentUrl);
          currentUrl = new URL(location, currentUrl).toString();
          redirectCount++;
          continue;
        }

        // Get content
        const contentBuffer = await response.arrayBuffer();
        const content = Buffer.from(contentBuffer);

        // Check content size
        if (content.length > this.config.maxPageSizeBytes) {
          throw new Error(`Page too large: ${content.length} bytes`);
        }

        // Check content type
        const contentType = response.headers.get('content-type') || 'text/html';
        const isAllowedType = this.config.allowedContentTypes.some(type => 
          contentType.toLowerCase().includes(type)
        );

        if (!isAllowedType) {
          throw new Error(`Unsupported content type: ${contentType}`);
        }

        // Extract charset
        const charset = this.extractCharset(contentType) || 'utf-8';

        return {
          url: currentUrl,
          status: response.status,
          headers: Object.fromEntries(response.headers.entries()),
          content,
          contentType,
          charset,
          etag: response.headers.get('etag') || undefined,
          lastModified: response.headers.get('last-modified') || undefined,
          redirects,
          fetchTime: Date.now() - startTime,
          size: content.length,
        };

      } catch (error) {
        if (redirectCount === 0) {
          throw error; // Throw original error if no redirects attempted
        }
        throw new Error(`Redirect chain failed: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    throw new Error(`Too many redirects (>${maxRedirects})`);
  }

  /**
   * Process a successful crawl result
   */
  private async processSuccessfulCrawl(item: CrawlItem, fetchResult: FetchResult): Promise<void> {
    try {
      // Extract content if enabled
      let extractedContent: ExtractedContent | undefined;
      
      if (this.config.contentExtractionEnabled) {
        const charset = this.validateCharset(fetchResult.charset);
        const htmlContent = fetchResult.content.toString(charset);
        extractedContent = ContentExtractor.extractContent(
          htmlContent,
          fetchResult.url
        );
      }

      // Create or update page record
      const page = await this.createOrUpdatePage(item, fetchResult, extractedContent);

      // Perform page discovery if enabled
      if (this.config.discoveryEnabled && page && extractedContent) {
        const domain = await storage.getDomainById(item.domainId);
        if (domain) {
          const charset = this.validateCharset(fetchResult.charset);
          const discoveryResult = await this.discovery.discoverFromPage(
            page,
            fetchResult.content.toString(charset),
            domain
          );

          this.stats.pagesDiscovered += discoveryResult.urlsQueued;
          
          console.log(`🔍 Discovery result for ${item.url}:`, {
            discovered: discoveryResult.urlsDiscovered,
            queued: discoveryResult.urlsQueued,
            links: discoveryResult.linksTracked,
          });
        }
      }

    } catch (error) {
      console.error(`❌ Error processing crawl result for ${item.url}:`, error instanceof Error ? error.message : String(error));
      throw error;
    }
  }

  /**
   * Create or update page record in database
   */
  private async createOrUpdatePage(
    item: CrawlItem, 
    fetchResult: FetchResult, 
    extractedContent?: ExtractedContent
  ): Promise<Page | null> {
    try {
      // Check if page already exists
      const existingPage = await storage.getPage(fetchResult.url);
      
      // Calculate content hash
      const contentHash = extractedContent ? 
        createHash('sha256').update(extractedContent.textContent || '').digest('hex') : 
        createHash('sha256').update(fetchResult.content).digest('hex');

      const pageData: InsertPage = {
        domainId: item.domainId,
        url: fetchResult.url,
        httpStatus: fetchResult.status,
        contentHash,
        title: extractedContent?.title,
        description: extractedContent?.description,
        textContent: extractedContent?.textContent,
        meta: {
          ...extractedContent?.meta,
          contentType: fetchResult.contentType,
          charset: fetchResult.charset,
          fetchTime: fetchResult.fetchTime,
          size: fetchResult.size,
          headers: fetchResult.headers,
        },
        lang: extractedContent?.lang,
        category: this.categorizeContent(extractedContent),
        etag: fetchResult.etag,
        lastModified: fetchResult.lastModified ? new Date(fetchResult.lastModified) : undefined,
      };

      if (existingPage) {
        // Update existing page if content has changed
        if (existingPage.contentHash !== contentHash) {
          await storage.updatePage(existingPage.id!, pageData);
          console.log(`📝 Updated page: ${fetchResult.url}`);
        } else {
          console.log(`✓ Page unchanged: ${fetchResult.url}`);
        }
        return existingPage;
      } else {
        // Create new page
        const newPage = await storage.createPage(pageData);
        console.log(`📄 Created new page: ${fetchResult.url}`);
        
        // Index content for full-text search if available
        if (extractedContent && this.config.contentExtractionEnabled) {
          await storage.indexPageContent(newPage.id!, {
            title: extractedContent.title,
            description: extractedContent.description,
            textContent: extractedContent.textContent,
            category: pageData.category ?? undefined,
            meta: pageData.meta ?? undefined,
          });
        }
        
        return newPage;
      }

    } catch (error) {
      console.error(`❌ Error creating/updating page for ${fetchResult.url}:`, error instanceof Error ? error.message : String(error));
      return null;
    }
  }

  /**
   * Categorize content based on extracted information
   */
  private categorizeContent(extractedContent?: ExtractedContent): string {
    if (!extractedContent) return 'general';

    const title = extractedContent.title.toLowerCase();
    const description = extractedContent.description.toLowerCase();
    const textContent = extractedContent.textContent.toLowerCase();
    
    // E-commerce and shopping
    if (this.containsKeywords([title, description, textContent], 
      ['shop', 'buy', 'price', 'cart', 'checkout', 'product', 'sale', 'discount', 'store'])) {
      return 'shopping';
    }
    
    // News sites
    if (this.containsKeywords([title, description], 
      ['news', 'breaking', 'report', 'today', 'latest', 'update', 'breaking news'])) {
      return 'news';
    }
    
    // SaaS and software
    if (this.containsKeywords([title, description, textContent], 
      ['software', 'app', 'platform', 'tool', 'service', 'api', 'dashboard', 'saas'])) {
      return 'saas';
    }
    
    // Cloud services
    if (this.containsKeywords([title, description, textContent], 
      ['cloud', 'hosting', 'infrastructure', 'server', 'deploy', 'aws', 'azure', 'gcp'])) {
      return 'cloud';
    }
    
    // Web3 and blockchain
    if (this.containsKeywords([title, description, textContent], 
      ['crypto', 'blockchain', 'bitcoin', 'ethereum', 'defi', 'nft', 'web3', 'smart contract'])) {
      return 'web3';
    }
    
    // Company pages
    if (this.containsKeywords([title, description], 
      ['about', 'company', 'about us', 'team', 'careers', 'contact', 'corporation'])) {
      return 'companies';
    }
    
    return 'general';
  }

  /**
   * Check if text contains any of the keywords
   */
  private containsKeywords(texts: string[], keywords: string[]): boolean {
    const combinedText = texts.join(' ').toLowerCase();
    return keywords.some(keyword => combinedText.includes(keyword));
  }

  /**
   * Extract charset from content-type header
   */
  private extractCharset(contentType: string): string | undefined {
    const match = contentType.match(/charset=([^;]+)/i);
    return match ? match[1].trim() : undefined;
  }

  /**
   * Validate charset and ensure it's a valid BufferEncoding
   */
  private validateCharset(charset: string | undefined): BufferEncoding {
    const validCharsets: BufferEncoding[] = [
      'ascii', 'utf8', 'utf-8', 'utf16le', 'utf-16le', 
      'ucs2', 'ucs-2', 'base64', 'latin1', 'binary', 'hex'
    ];
    
    if (charset && validCharsets.includes(charset.toLowerCase() as BufferEncoding)) {
      return charset.toLowerCase() as BufferEncoding;
    }
    
    return 'utf8'; // Default fallback
  }

  /**
   * Start periodic stats reporting
   */
  private startStatsReporting(): void {
    const reportStats = async () => {
      if (!this.isRunning) return;

      try {
        // Update stats
        this.stats.uptime = Date.now() - this.stats.startTime;
        this.stats.memoryUsage = process.memoryUsage();

        if (this.stats.uptime > 0) {
          this.stats.crawlsPerHour = (this.stats.totalCrawled * 3600000) / this.stats.uptime;
        }

        if (this.stats.totalCrawled > 0) {
          this.stats.errorRate = this.stats.failedCrawls / this.stats.totalCrawled;
        }

        // Get queue stats
        const queueStats = await storage.getCrawlQueueStats();
        this.stats.queueSize = queueStats.pending;

        // Get scheduler stats
        const schedulerStats = crawlerScheduler.getStats();
        this.stats.domainsActive = schedulerStats.domainsActive;

        // Log comprehensive stats
        console.log('🕷️ Background Crawler Stats:', {
          uptime: Math.round(this.stats.uptime / 60000) + 'm',
          crawled: this.stats.totalCrawled,
          successful: this.stats.successfulCrawls,
          failed: this.stats.failedCrawls,
          queueSize: this.stats.queueSize,
          discovered: this.stats.pagesDiscovered,
          domainsActive: this.stats.domainsActive,
          crawlsPerHour: Math.round(this.stats.crawlsPerHour),
          errorRate: Math.round(this.stats.errorRate * 100) + '%',
          avgResponseTime: Math.round(this.stats.avgResponseTime) + 'ms',
          memoryMB: Math.round(this.stats.memoryUsage.heapUsed / 1024 / 1024),
          bytesDownloadedMB: Math.round(this.stats.bytesDownloaded / 1024 / 1024),
        });

        setTimeout(reportStats, this.config.statsReportIntervalMs);

      } catch (error) {
        console.error('❌ Error in stats reporting:', error instanceof Error ? error.message : String(error));
        setTimeout(reportStats, this.config.statsReportIntervalMs);
      }
    };

    // Start stats reporting after a delay
    setTimeout(reportStats, this.config.statsReportIntervalMs);
  }

  /**
   * Get current crawler statistics
   */
  getStats(): CrawlerStats {
    this.stats.uptime = Date.now() - this.stats.startTime;
    this.stats.memoryUsage = process.memoryUsage();
    return { ...this.stats };
  }

  /**
   * Check if crawler is running
   */
  isActive(): boolean {
    return this.isRunning;
  }

  /**
   * Get current configuration
   */
  getConfig(): BackgroundCrawlerConfig {
    return { ...this.config };
  }

  /**
   * Update configuration at runtime
   */
  updateConfig(newConfig: Partial<BackgroundCrawlerConfig>): void {
    Object.assign(this.config, newConfig);
    console.log('⚙️ Updated background crawler config:', newConfig);

    // Update scheduler config if needed
    if (this.isRunning) {
      crawlerScheduler.updateConfig({
        maxConcurrentCrawls: this.config.maxConcurrentCrawls,
        respectRobotsTxt: this.config.respectRobotsTxt,
        userAgent: this.config.userAgent,
        maxRetryAttempts: this.config.maxRetries,
        defaultDelayMs: this.config.minCrawlDelayMs,
      });
    }
  }

  /**
   * Force a manual crawl of specific domains
   */
  async crawlDomains(domains: string[]): Promise<void> {
    console.log(`🎯 Manually crawling ${domains.length} domains...`);
    
    for (const domainName of domains) {
      try {
        const domain = await storage.getDomain(domainName);
        if (!domain) {
          console.warn(`⚠️ Domain ${domainName} not found in database`);
          continue;
        }

        await storage.addToCrawlQueue({
          domainId: domain.id!,
          url: `https://${domain.domain}`,
          priority: 90, // High priority for manual crawls
          reason: 'seed',
        });

        console.log(`✅ Queued manual crawl for ${domainName}`);

      } catch (error) {
        console.error(`❌ Error queueing manual crawl for ${domainName}:`, error instanceof Error ? error.message : String(error));
      }
    }
  }

  /**
   * Get health status
   */
  getHealthStatus(): {
    status: 'healthy' | 'degraded' | 'unhealthy';
    issues: string[];
    uptime: number;
    lastCrawl: number | undefined;
  } {
    const issues: string[] = [];
    const now = Date.now();
    const lastCrawl = this.stats.lastCrawlTime;

    // Check if we've crawled recently
    if (lastCrawl && (now - lastCrawl) > 300000) { // 5 minutes
      issues.push('No crawls in last 5 minutes');
    }

    // Check error rate
    if (this.stats.errorRate > 0.5) {
      issues.push('High error rate (>50%)');
    }

    // Check memory usage
    const memoryUsageMB = this.stats.memoryUsage.heapUsed / 1024 / 1024;
    if (memoryUsageMB > 1000) { // 1GB
      issues.push('High memory usage (>1GB)');
    }

    // Check queue size
    if (this.stats.queueSize > 100000) { // 100k items
      issues.push('Large queue size (>100k)');
    }

    const status = issues.length === 0 ? 'healthy' :
                  issues.length <= 2 ? 'degraded' : 'unhealthy';

    return {
      status,
      issues,
      uptime: this.stats.uptime,
      lastCrawl,
    };
  }
}

export const backgroundCrawler = new BackgroundCrawler();