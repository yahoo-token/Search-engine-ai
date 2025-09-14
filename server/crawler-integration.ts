import { storage } from './storage';
import { 
  PageDiscoverySystem, 
  HtmlLinkExtractor, 
  SitemapParser, 
  UrlNormalizer, 
  UrlDeduplicator,
  type DiscoveredUrl 
} from './page-discovery';
import { RobotsTxtParser, ContentExtractor, type FetchResult } from './crawler-core';
import { type Domain, type Page, type InsertCrawlQueue, type InsertLink } from '@shared/schema';

export interface CrawlerDiscoveryConfig {
  maxLinksPerPage: number;
  respectNofollow: boolean;
  extractResources: boolean;
  domainFilter?: string;
  minPriority: number;
  maxDepth: number;
}

export interface DiscoveryResult {
  urlsDiscovered: number;
  urlsQueued: number;
  linksTracked: number;
  sitemapsFound: number;
  errors: string[];
  stats: {
    internal: number;
    external: number;
    duplicates: number;
    skipped: number;
  };
}

/**
 * Integration between page discovery system and crawler infrastructure
 */
export class CrawlerDiscoveryIntegration {
  private discoverySystem: PageDiscoverySystem;
  private config: CrawlerDiscoveryConfig;

  constructor(config: Partial<CrawlerDiscoveryConfig> = {}) {
    this.discoverySystem = new PageDiscoverySystem();
    this.config = {
      maxLinksPerPage: 500,
      respectNofollow: true,
      extractResources: false,
      minPriority: 20,
      maxDepth: 10,
      ...config
    };
  }

  /**
   * Perform comprehensive page discovery for a crawled page
   */
  async discoverFromPage(
    page: Page, 
    htmlContent: string, 
    domain: Domain
  ): Promise<DiscoveryResult> {
    const result: DiscoveryResult = {
      urlsDiscovered: 0,
      urlsQueued: 0,
      linksTracked: 0,
      sitemapsFound: 0,
      errors: [],
      stats: {
        internal: 0,
        external: 0,
        duplicates: 0,
        skipped: 0
      }
    };

    try {
      // Get robots.txt for domain
      const robotsTxt = await RobotsTxtParser.fetchAndParseRobotsTxt(
        `https://${domain.domain}`
      );

      // Extract links from HTML
      const linkDiscovery = await this.discoverySystem.discoverFromHtml(
        htmlContent,
        page.url,
        {
          extractResources: this.config.extractResources,
          respectNofollow: this.config.respectNofollow,
          domainFilter: this.config.domainFilter
        }
      );

      result.urlsDiscovered += linkDiscovery.discovered.length;
      result.stats.internal += linkDiscovery.stats.internal;
      result.stats.external += linkDiscovery.stats.external;
      result.stats.duplicates += linkDiscovery.duplicateCount;
      result.errors.push(...linkDiscovery.errors);

      // Process discovered URLs and queue them
      const queuedUrls = await this.processDiscoveredUrls(
        linkDiscovery.discovered,
        domain,
        robotsTxt,
        page.id!
      );

      result.urlsQueued += queuedUrls.queued;
      result.linksTracked += queuedUrls.linksTracked;
      result.stats.skipped += queuedUrls.skipped;

      // Check for sitemaps in robots.txt if this is a root page
      if (page.url === `https://${domain.domain}` || page.url === `https://${domain.domain}/`) {
        const sitemapUrls = robotsTxt.sitemaps;
        if (sitemapUrls.length > 0) {
          const sitemapDiscovery = await this.discoverFromSitemaps(
            sitemapUrls,
            domain,
            robotsTxt
          );
          
          result.urlsDiscovered += sitemapDiscovery.urlsDiscovered;
          result.urlsQueued += sitemapDiscovery.urlsQueued;
          result.sitemapsFound += sitemapDiscovery.sitemapsProcessed;
          result.errors.push(...sitemapDiscovery.errors);
        }
      }

      return result;
    } catch (error) {
      result.errors.push(`Discovery integration error: ${error instanceof Error ? error.message : String(error)}`);
      return result;
    }
  }

  /**
   * Discover URLs from domain sitemaps
   */
  async discoverFromSitemaps(
    sitemapUrls: string[],
    domain: Domain,
    robotsTxt: any
  ): Promise<{
    urlsDiscovered: number;
    urlsQueued: number;
    sitemapsProcessed: number;
    errors: string[];
  }> {
    const sitemapDiscovery = await this.discoverySystem.discoverFromSitemaps(
      sitemapUrls,
      robotsTxt,
      domain.domain
    );

    // Process discovered URLs from sitemaps
    const queuedUrls = await this.processDiscoveredUrls(
      sitemapDiscovery.discovered,
      domain,
      robotsTxt
    );

    // Handle sitemap index files
    if (sitemapDiscovery.indexSitemaps.length > 0) {
      const indexDiscovery = await this.discoverFromSitemaps(
        sitemapDiscovery.indexSitemaps,
        domain,
        robotsTxt
      );

      return {
        urlsDiscovered: sitemapDiscovery.discovered.length + indexDiscovery.urlsDiscovered,
        urlsQueued: queuedUrls.queued + indexDiscovery.urlsQueued,
        sitemapsProcessed: sitemapDiscovery.stats.sitemapsProcessed + indexDiscovery.sitemapsProcessed,
        errors: [...sitemapDiscovery.errors, ...indexDiscovery.errors]
      };
    }

    return {
      urlsDiscovered: sitemapDiscovery.discovered.length,
      urlsQueued: queuedUrls.queued,
      sitemapsProcessed: sitemapDiscovery.stats.sitemapsProcessed,
      errors: sitemapDiscovery.errors
    };
  }

  /**
   * Process discovered URLs and add them to crawl queue
   */
  private async processDiscoveredUrls(
    discoveredUrls: DiscoveredUrl[],
    domain: Domain,
    robotsTxt: any,
    sourcePageId?: string
  ): Promise<{
    queued: number;
    linksTracked: number;
    skipped: number;
  }> {
    const result = {
      queued: 0,
      linksTracked: 0,
      skipped: 0
    };

    if (discoveredUrls.length === 0) return result;

    // Filter and validate URLs
    const validUrls = discoveredUrls.filter(url => {
      // Check minimum priority
      if (url.priority < this.config.minPriority) {
        result.skipped++;
        return false;
      }

      // Check robots.txt
      if (!robotsTxt.isAllowed('yhtbot', new URL(url.normalizedUrl).pathname)) {
        result.skipped++;
        return false;
      }

      // Check if URL is valid
      if (!UrlNormalizer.isValidWebUrl(url.normalizedUrl)) {
        result.skipped++;
        return false;
      }

      return true;
    });

    // Limit number of URLs per page
    const limitedUrls = validUrls.slice(0, this.config.maxLinksPerPage);
    if (validUrls.length > this.config.maxLinksPerPage) {
      result.skipped += validUrls.length - this.config.maxLinksPerPage;
    }

    // Prepare crawl queue items
    const crawlQueueItems: InsertCrawlQueue[] = [];
    const linkItems: InsertLink[] = [];

    for (const url of limitedUrls) {
      // Only queue internal URLs for this domain
      if (UrlNormalizer.isSameDomain(url.normalizedUrl, `https://${domain.domain}`)) {
        crawlQueueItems.push({
          domainId: domain.id!,
          url: url.normalizedUrl,
          priority: url.priority,
          reason: url.source === 'manual' || url.source === 'canonical' ? 'link' : url.source
        });
      }

      // Track link relationships if source page is provided
      if (sourcePageId && url.source === 'link') {
        linkItems.push({
          fromPageId: sourcePageId,
          toUrl: url.normalizedUrl,
          nofollow: url.nofollow
        });
      }
    }

    // Batch insert to crawl queue
    if (crawlQueueItems.length > 0) {
      try {
        const queuedItems = await storage.addBatchToCrawlQueue(crawlQueueItems);
        result.queued = queuedItems.length;
      } catch (error) {
        console.error('Failed to add URLs to crawl queue:', error);
      }
    }

    // Batch insert links
    if (linkItems.length > 0) {
      try {
        await storage.saveLinks(linkItems);
        result.linksTracked = linkItems.length;
      } catch (error) {
        console.error('Failed to save link relationships:', error);
      }
    }

    return result;
  }

  /**
   * Enhanced content extraction that integrates with page discovery
   */
  async extractContentWithDiscovery(
    fetchResult: FetchResult,
    domain: Domain
  ): Promise<{
    extractedContent: any;
    discoveryResult: DiscoveryResult;
  }> {
    // Use existing content extraction
    const extractedContent = ContentExtractor.extractContent(
      fetchResult.content.toString('utf-8'),
      fetchResult.url
    );

    // Create a temporary page object for discovery
    const tempPage: Page = {
      id: '', // Will be filled when page is saved
      domainId: domain.id!,
      url: fetchResult.url,
      httpStatus: fetchResult.status,
      contentHash: extractedContent.contentHash,
      title: extractedContent.title,
      description: extractedContent.description,
      textContent: extractedContent.textContent,
      meta: extractedContent.meta,
      lang: extractedContent.lang || null,
      category: null,
      lastFetchedAt: new Date(),
      etag: fetchResult.etag || null,
      lastModified: null,
      titleTsv: null,
      bodyTsv: null,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    // Perform discovery
    const discoveryResult = await this.discoverFromPage(
      tempPage,
      fetchResult.content.toString('utf-8'),
      domain
    );

    return {
      extractedContent,
      discoveryResult
    };
  }

  /**
   * Get discovery statistics for a domain
   */
  async getDomainDiscoveryStats(domainId: string): Promise<{
    queueStats: any;
    linkStats: { totalLinks: number; nofollowLinks: number };
    recentDiscoveries: any[];
  }> {
    const [queueStats, linkStats, recentItems] = await Promise.all([
      storage.getDiscoveryStats(domainId),
      this.getLinkStats(domainId),
      storage.getCrawlQueueByReason('link', 10)
    ]);

    return {
      queueStats,
      linkStats,
      recentDiscoveries: recentItems
    };
  }

  private async getLinkStats(domainId: string): Promise<{
    totalLinks: number;
    nofollowLinks: number;
  }> {
    // This would need to be implemented in storage if detailed link stats are needed
    return {
      totalLinks: 0,
      nofollowLinks: 0
    };
  }

  /**
   * Cleanup duplicate URLs for a domain
   */
  async cleanupDuplicates(domainId: string): Promise<number> {
    return await storage.removeDuplicateCrawlQueueItems(domainId);
  }

  /**
   * Reset discovery system (clear deduplicator)
   */
  reset(): void {
    this.discoverySystem.reset();
  }

  /**
   * Get overall discovery statistics
   */
  getOverallStats(): any {
    return this.discoverySystem.getDiscoveryStats();
  }
}

/**
 * Enhanced crawler that integrates page discovery
 */
export class EnhancedCrawler {
  private discoveryIntegration: CrawlerDiscoveryIntegration;

  constructor(config: Partial<CrawlerDiscoveryConfig> = {}) {
    this.discoveryIntegration = new CrawlerDiscoveryIntegration(config);
  }

  /**
   * Crawl a page with integrated discovery
   */
  async crawlPageWithDiscovery(
    url: string,
    domain: Domain
  ): Promise<{
    page: Page | null;
    discoveryResult: DiscoveryResult;
    errors: string[];
  }> {
    const errors: string[] = [];

    try {
      // This would integrate with the existing CrawlerCore.fetchPage method
      // For now, we'll simulate the fetch process
      const mockFetchResult: FetchResult = {
        url,
        status: 200,
        headers: {},
        content: Buffer.from('<html><body><h1>Test</h1></body></html>'),
        contentType: 'text/html',
        charset: 'utf-8',
        redirects: [],
        fetchTime: 1000,
        size: 100
      };

      const { extractedContent, discoveryResult } = await this.discoveryIntegration
        .extractContentWithDiscovery(mockFetchResult, domain);

      // Create page record
      const page = await storage.createPage({
        domainId: domain.id!,
        url: mockFetchResult.url,
        httpStatus: mockFetchResult.status,
        contentHash: extractedContent.contentHash,
        title: extractedContent.title,
        description: extractedContent.description,
        textContent: extractedContent.textContent,
        meta: extractedContent.meta,
        lang: extractedContent.lang
      });

      return {
        page,
        discoveryResult,
        errors
      };
    } catch (error) {
      errors.push(`Crawl error: ${error instanceof Error ? error.message : String(error)}`);
      return {
        page: null,
        discoveryResult: {
          urlsDiscovered: 0,
          urlsQueued: 0,
          linksTracked: 0,
          sitemapsFound: 0,
          errors: [],
          stats: { internal: 0, external: 0, duplicates: 0, skipped: 0 }
        },
        errors
      };
    }
  }

  /**
   * Discover and queue URLs from a domain's sitemaps
   */
  async discoverFromDomainSitemaps(domain: Domain): Promise<DiscoveryResult> {
    try {
      const robotsTxt = await RobotsTxtParser.fetchAndParseRobotsTxt(
        `https://${domain.domain}`
      );

      if (robotsTxt.sitemaps.length === 0) {
        return {
          urlsDiscovered: 0,
          urlsQueued: 0,
          linksTracked: 0,
          sitemapsFound: 0,
          errors: ['No sitemaps found in robots.txt'],
          stats: { internal: 0, external: 0, duplicates: 0, skipped: 0 }
        };
      }

      const sitemapResult = await this.discoveryIntegration.discoverFromSitemaps(
        robotsTxt.sitemaps,
        domain,
        robotsTxt
      );

      return {
        urlsDiscovered: sitemapResult.urlsDiscovered,
        urlsQueued: sitemapResult.urlsQueued,
        linksTracked: 0,
        sitemapsFound: sitemapResult.sitemapsProcessed,
        errors: sitemapResult.errors,
        stats: { internal: sitemapResult.urlsQueued, external: 0, duplicates: 0, skipped: 0 }
      };
    } catch (error) {
      return {
        urlsDiscovered: 0,
        urlsQueued: 0,
        linksTracked: 0,
        sitemapsFound: 0,
        errors: [`Sitemap discovery error: ${error instanceof Error ? error.message : String(error)}`],
        stats: { internal: 0, external: 0, duplicates: 0, skipped: 0 }
      };
    }
  }
}

// Export singleton instances
export const crawlerDiscoveryIntegration = new CrawlerDiscoveryIntegration();
export const enhancedCrawler = new EnhancedCrawler();