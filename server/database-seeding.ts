/**
 * Database seeding script to populate YHT search engine with real website content
 * Uses the enhanced crawler infrastructure to fetch content from popular websites
 */

import { storage } from './storage';
import { SEED_WEBSITES, getCategorySummary, type SeedWebsite } from './seed-websites';
import { CrawlerCore, DNSResolver, RobotsTxtParser, type FetchResult } from './crawler-core';
import { ContentExtractor, ContentCategorizer, type ExtractedContent } from './content-indexing';
import { crawlerDiscoveryIntegration, enhancedCrawler } from './crawler-integration';
import { UrlNormalizer } from './page-discovery';
import { type Domain, type Page, type InsertDomain, type InsertPage } from '@shared/schema';

export interface SeedingConfig {
  batchSize: number;
  delayBetweenRequests: number; // milliseconds
  maxRetries: number;
  timeoutMs: number;
  respectRobotsTxt: boolean;
  userAgent: string;
  skipExisting: boolean;
}

export interface SeedingProgress {
  total: number;
  processed: number;
  successful: number;
  failed: number;
  skipped: number;
  currentWebsite?: string;
  errors: Array<{
    url: string;
    error: string;
    timestamp: Date;
  }>;
  categoryStats: Record<string, { processed: number; successful: number }>;
}

export interface SeedingResult {
  success: boolean;
  progress: SeedingProgress;
  domainsCreated: number;
  pagesCreated: number;
  totalProcessingTime: number;
  avgProcessingTimePerSite: number;
}

/**
 * Database seeding orchestrator
 */
export class DatabaseSeeder {
  private config: SeedingConfig;
  private progress: SeedingProgress;
  private startTime: number = 0;

  constructor(config: Partial<SeedingConfig> = {}) {
    this.config = {
      batchSize: 5,
      delayBetweenRequests: 2000, // 2 seconds between requests
      maxRetries: 3,
      timeoutMs: 30000, // 30 seconds
      respectRobotsTxt: true,
      userAgent: 'YHTBot/1.0 (+https://yht-search.replit.app)',
      skipExisting: true,
      ...config
    };

    this.progress = {
      total: SEED_WEBSITES.length,
      processed: 0,
      successful: 0,
      failed: 0,
      skipped: 0,
      errors: [],
      categoryStats: {}
    };

    // Initialize category stats
    for (const category of ['shopping', 'companies', 'news', 'saas', 'cloud', 'web3']) {
      this.progress.categoryStats[category] = { processed: 0, successful: 0 };
    }
  }

  /**
   * Main seeding method
   */
  async seedDatabase(): Promise<SeedingResult> {
    console.log('🌱 Starting database seeding with enhanced crawler...');
    console.log(`📊 Seeding ${SEED_WEBSITES.length} websites across ${Object.keys(this.progress.categoryStats).length} categories`);
    
    const summary = getCategorySummary();
    console.log('📋 Category distribution:', summary.categories);

    this.startTime = Date.now();

    try {
      // Process websites in batches
      for (let i = 0; i < SEED_WEBSITES.length; i += this.config.batchSize) {
        const batch = SEED_WEBSITES.slice(i, i + this.config.batchSize);
        
        console.log(`\n🔄 Processing batch ${Math.floor(i / this.config.batchSize) + 1}/${Math.ceil(SEED_WEBSITES.length / this.config.batchSize)}`);
        
        // Process batch with some parallelization
        const batchPromises = batch.map(website => this.processSingleWebsite(website));
        await Promise.allSettled(batchPromises);

        // Progress update
        this.logProgress();

        // Delay between batches to be respectful
        if (i + this.config.batchSize < SEED_WEBSITES.length) {
          console.log(`⏳ Waiting ${this.config.delayBetweenRequests}ms before next batch...`);
          await this.delay(this.config.delayBetweenRequests);
        }
      }

      const totalTime = Date.now() - this.startTime;
      const avgTime = totalTime / this.progress.processed;

      console.log('\n✅ Database seeding completed!');
      this.logFinalStats();

      return {
        success: true,
        progress: this.progress,
        domainsCreated: this.progress.successful, // Each successful site creates a domain
        pagesCreated: this.progress.successful,   // Each successful site creates a page
        totalProcessingTime: totalTime,
        avgProcessingTimePerSite: avgTime
      };

    } catch (error) {
      console.error('❌ Database seeding failed:', error);
      return {
        success: false,
        progress: this.progress,
        domainsCreated: 0,
        pagesCreated: 0,
        totalProcessingTime: Date.now() - this.startTime,
        avgProcessingTimePerSite: 0
      };
    }
  }

  /**
   * Process a single website
   */
  private async processSingleWebsite(website: SeedWebsite): Promise<void> {
    this.progress.currentWebsite = website.url;
    this.progress.categoryStats[website.category].processed++;

    try {
      console.log(`\n🌐 Processing: ${website.url} (${website.category})`);

      // Check if domain already exists and skip if configured
      if (this.config.skipExisting) {
        const existingDomain = await storage.getDomain(website.domain);
        if (existingDomain) {
          console.log(`⏭️  Skipping ${website.domain} - already exists`);
          this.progress.skipped++;
          this.progress.processed++;
          return;
        }
      }

      // DNS resolution check
      const domainInfo = await DNSResolver.resolveDomain(website.domain);
      if (!domainInfo.isReachable) {
        throw new Error(`Domain not reachable: ${domainInfo.error}`);
      }

      // Check robots.txt if enabled
      let robotsTxt;
      if (this.config.respectRobotsTxt) {
        robotsTxt = await RobotsTxtParser.fetchAndParseRobotsTxt(`https://${website.domain}`);
        
        if (!robotsTxt.isAllowed(this.config.userAgent.toLowerCase(), '/')) {
          throw new Error('Crawling not allowed by robots.txt');
        }
      }

      // Create or get domain record
      let domain: Domain;
      try {
        domain = await storage.createDomain({
          domain: website.domain,
          status: 'active',
          priority: website.priority,
          robotsTxt: robotsTxt ? JSON.stringify(robotsTxt) : undefined,
          robotsFetchedAt: robotsTxt ? new Date() : undefined,
          crawlDelayMs: robotsTxt?.crawlDelay || 2000
        });
      } catch (error) {
        // Domain might already exist, try to get it
        const existingDomain = await storage.getDomain(website.domain);
        if (existingDomain) {
          domain = existingDomain;
        } else {
          throw error;
        }
      }

      // Fetch page content
      const fetchResult = await this.fetchWebsiteContent(website.url);
      
      // Extract comprehensive content with enhanced meta information
      const extractedContent = ContentExtractor.extractContent(
        fetchResult.content.toString('utf-8'), 
        website.url
      );

      // Categorize content (this will use AI if available)
      const categorization = await ContentCategorizer.categorizeContent(extractedContent);

      // Use the seed website's category as primary if categorization confidence is low
      const finalCategory = categorization.confidence > 0.6 ? categorization.primary : website.category;

      // Prepare enhanced meta information
      const enhancedMeta = {
        ...extractedContent.meta,
        // Enhanced branding information
        favicon: extractedContent.favicon,
        logo: extractedContent.logo,
        ogImage: extractedContent.ogImage,
        twitterImage: extractedContent.twitterImage,
        appleTouchIcon: extractedContent.appleTouchIcon,
        siteName: extractedContent.siteName,
        authorName: extractedContent.authorName,
        publishedDate: extractedContent.publishedDate,
        modifiedDate: extractedContent.modifiedDate,
        canonicalUrl: extractedContent.canonicalUrl,
        themeColor: extractedContent.themeColor,
        brandColors: extractedContent.brandColors,
        // Categorization info
        categorization: {
          primary: finalCategory,
          secondary: categorization.secondary,
          confidence: categorization.confidence,
          keywords: categorization.keywords
        },
        // Seed info
        seedInfo: {
          expectedTitle: website.expectedTitle,
          expectedCategory: website.category,
          priority: website.priority
        }
      };

      // Create page record
      const page: Page = await storage.createPage({
        domainId: domain.id!,
        url: UrlNormalizer.normalize(website.url),
        httpStatus: fetchResult.status,
        contentHash: extractedContent.contentHash,
        title: extractedContent.title || website.expectedTitle || website.domain,
        description: extractedContent.description || website.description || '',
        textContent: extractedContent.textContent,
        meta: enhancedMeta,
        lang: extractedContent.lang || 'en',
        category: finalCategory,
        etag: fetchResult.etag,
        lastModified: fetchResult.lastModified ? new Date(fetchResult.lastModified) : undefined
      });

      // Index content for full-text search
      await storage.indexPageContent(page.id!, {
        title: extractedContent.title,
        description: extractedContent.description,
        textContent: extractedContent.textContent,
        category: finalCategory,
        meta: enhancedMeta
      });

      console.log(`✅ Successfully processed: ${website.url}`);
      console.log(`   📄 Title: ${extractedContent.title}`);
      console.log(`   🏷️  Category: ${finalCategory} (confidence: ${categorization.confidence.toFixed(2)})`);
      console.log(`   🖼️  Images: Logo=${!!extractedContent.logo}, OG=${!!extractedContent.ogImage}, Favicon=${!!extractedContent.favicon}`);
      console.log(`   📊 Content: ${extractedContent.wordCount} words, ${extractedContent.headings.length} headings`);

      this.progress.successful++;
      this.progress.categoryStats[website.category].successful++;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`❌ Failed to process ${website.url}: ${errorMessage}`);
      
      this.progress.errors.push({
        url: website.url,
        error: errorMessage,
        timestamp: new Date()
      });
      
      this.progress.failed++;
    } finally {
      this.progress.processed++;
    }
  }

  /**
   * Fetch website content using enhanced crawler
   */
  private async fetchWebsiteContent(url: string): Promise<FetchResult> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeoutMs);

    try {
      // Use the existing CrawlerCore fetch functionality
      const response = await fetch(url, {
        headers: {
          'User-Agent': this.config.userAgent,
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
          'Accept-Encoding': 'gzip, deflate, br',
          'DNT': '1',
          'Connection': 'keep-alive',
          'Upgrade-Insecure-Requests': '1',
        },
        signal: controller.signal,
        redirect: 'follow'
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const content = Buffer.from(await response.arrayBuffer());
      const contentType = response.headers.get('content-type') || 'text/html';

      return {
        url,
        status: response.status,
        headers: Object.fromEntries(response.headers.entries()),
        content,
        contentType,
        charset: this.extractCharset(contentType),
        etag: response.headers.get('etag') || undefined,
        lastModified: response.headers.get('last-modified') || undefined,
        redirects: [], // We could track this if needed
        fetchTime: Date.now(),
        size: content.length
      };

    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  }

  /**
   * Extract charset from content-type header
   */
  private extractCharset(contentType: string): string {
    const match = contentType.match(/charset=([^;,\s]+)/i);
    return match ? match[1] : 'utf-8';
  }

  /**
   * Delay helper
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Log current progress
   */
  private logProgress(): void {
    const percentage = ((this.progress.processed / this.progress.total) * 100).toFixed(1);
    const elapsed = Date.now() - this.startTime;
    const remaining = elapsed / this.progress.processed * (this.progress.total - this.progress.processed);
    
    console.log(`\n📊 Progress: ${this.progress.processed}/${this.progress.total} (${percentage}%)`);
    console.log(`✅ Successful: ${this.progress.successful}`);
    console.log(`❌ Failed: ${this.progress.failed}`);
    console.log(`⏭️  Skipped: ${this.progress.skipped}`);
    console.log(`⏱️  Estimated remaining: ${Math.round(remaining / 1000 / 60)} minutes`);
  }

  /**
   * Log final statistics
   */
  private logFinalStats(): void {
    console.log('\n📈 Final Statistics:');
    console.log(`📊 Total processed: ${this.progress.processed}/${this.progress.total}`);
    console.log(`✅ Successful: ${this.progress.successful}`);
    console.log(`❌ Failed: ${this.progress.failed}`);
    console.log(`⏭️  Skipped: ${this.progress.skipped}`);
    console.log(`⏱️  Total time: ${Math.round((Date.now() - this.startTime) / 1000 / 60)} minutes`);
    
    console.log('\n📋 Category Statistics:');
    for (const [category, stats] of Object.entries(this.progress.categoryStats)) {
      console.log(`  ${category}: ${stats.successful}/${stats.processed} successful`);
    }

    if (this.progress.errors.length > 0) {
      console.log('\n❌ Errors encountered:');
      this.progress.errors.slice(0, 10).forEach(error => {
        console.log(`  ${error.url}: ${error.error}`);
      });
      if (this.progress.errors.length > 10) {
        console.log(`  ... and ${this.progress.errors.length - 10} more errors`);
      }
    }
  }

  /**
   * Get current progress
   */
  getProgress(): SeedingProgress {
    return { ...this.progress };
  }
}

/**
 * Quick seeding function for development/testing
 */
export async function quickSeed(limitToHighPriority: boolean = true, limitCount?: number): Promise<SeedingResult> {
  let websites = SEED_WEBSITES;
  
  if (limitToHighPriority) {
    websites = websites.filter(site => site.priority >= 85);
  }
  
  if (limitCount) {
    websites = websites.slice(0, limitCount);
  }

  console.log(`🚀 Quick seeding ${websites.length} high-priority websites...`);

  // Override the seed list temporarily
  const originalList = [...SEED_WEBSITES];
  SEED_WEBSITES.length = 0;
  SEED_WEBSITES.push(...websites);

  try {
    const seeder = new DatabaseSeeder({
      batchSize: 3,
      delayBetweenRequests: 1500,
      timeoutMs: 20000,
      skipExisting: true
    });

    const result = await seeder.seedDatabase();
    return result;
  } finally {
    // Restore original list
    SEED_WEBSITES.length = 0;
    SEED_WEBSITES.push(...originalList);
  }
}

/**
 * Seed specific categories only
 */
export async function seedByCategory(categories: string[]): Promise<SeedingResult> {
  const websites = SEED_WEBSITES.filter(site => categories.includes(site.category));
  
  console.log(`🎯 Seeding ${websites.length} websites from categories: ${categories.join(', ')}`);

  // Override the seed list temporarily
  const originalList = [...SEED_WEBSITES];
  SEED_WEBSITES.length = 0;
  SEED_WEBSITES.push(...websites);

  try {
    const seeder = new DatabaseSeeder();
    const result = await seeder.seedDatabase();
    return result;
  } finally {
    // Restore original list
    SEED_WEBSITES.length = 0;
    SEED_WEBSITES.push(...originalList);
  }
}