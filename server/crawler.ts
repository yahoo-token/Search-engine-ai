import { storage } from "./storage";
import { InsertCrawledSite } from "@shared/schema";

export interface CrawlResult {
  url: string;
  title: string;
  description: string;
  content: string;
  category: string;
  favicon?: string;
}

export class WebCrawler {
  private crawlQueue: string[] = [];
  private crawledUrls: Set<string> = new Set();
  private isRunning: boolean = false;

  async addUrlToCrawl(url: string): Promise<void> {
    if (!this.crawledUrls.has(url) && !this.crawlQueue.includes(url)) {
      this.crawlQueue.push(url);
    }
  }

  async crawlUrl(url: string): Promise<CrawlResult | null> {
    try {
      // Basic URL validation
      if (!url.startsWith('http://') && !url.startsWith('https://')) {
        url = 'https://' + url;
      }

      // In a real implementation, you would use a web scraping library like Puppeteer
      // For now, we'll simulate crawling with basic fetch for HTML content
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'YAS-Crawler/1.0 (+https://yas-search.com/bot)',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const html = await response.text();
      
      // Basic HTML parsing (in production, use a proper HTML parser)
      const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
      const descriptionMatch = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["'][^>]*>/i);
      
      const title = titleMatch ? titleMatch[1].trim() : new URL(url).hostname;
      const description = descriptionMatch ? descriptionMatch[1].trim() : '';
      
      // Extract text content (very basic implementation)
      const textContent = html
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .substring(0, 5000);

      // Categorize based on URL and content
      const category = this.categorizeUrl(url, title, description);

      const crawlResult: CrawlResult = {
        url,
        title,
        description,
        content: textContent,
        category,
        favicon: `${new URL(url).origin}/favicon.ico`,
      };

      this.crawledUrls.add(url);
      return crawlResult;
    } catch (error) {
      console.error(`Failed to crawl ${url}:`, error);
      return null;
    }
  }

  private categorizeUrl(url: string, title: string, description: string): string {
    const urlLower = url.toLowerCase();
    const titleLower = title.toLowerCase();
    const descLower = description.toLowerCase();
    
    // E-commerce and shopping
    if (urlLower.includes('shop') || urlLower.includes('store') || urlLower.includes('buy') ||
        titleLower.includes('buy') || titleLower.includes('price') || titleLower.includes('product')) {
      return 'shopping';
    }
    
    // News sites
    if (urlLower.includes('news') || urlLower.includes('cnn') || urlLower.includes('bbc') ||
        titleLower.includes('news') || titleLower.includes('breaking')) {
      return 'news';
    }
    
    // SaaS and software
    if (urlLower.includes('app') || urlLower.includes('software') || urlLower.includes('platform') ||
        titleLower.includes('software') || titleLower.includes('platform') || titleLower.includes('tool')) {
      return 'saas';
    }
    
    // Cloud services
    if (urlLower.includes('cloud') || urlLower.includes('aws') || urlLower.includes('azure') ||
        titleLower.includes('cloud') || titleLower.includes('hosting')) {
      return 'cloud';
    }
    
    // Web3 and blockchain
    if (urlLower.includes('crypto') || urlLower.includes('blockchain') || urlLower.includes('web3') ||
        titleLower.includes('crypto') || titleLower.includes('blockchain') || titleLower.includes('nft')) {
      return 'web3';
    }
    
    // Company pages
    if (urlLower.includes('about') || urlLower.includes('company') ||
        titleLower.includes('about') || titleLower.includes('company')) {
      return 'companies';
    }
    
    return 'general';
  }

  async saveCrawlResult(result: CrawlResult): Promise<void> {
    try {
      const siteData: InsertCrawledSite = {
        url: result.url,
        title: result.title,
        description: result.description,
        content: result.content,
        category: result.category,
      };

      await storage.createCrawledSite(siteData);
    } catch (error) {
      console.error('Failed to save crawl result:', error);
    }
  }

  async startCrawling(): Promise<void> {
    if (this.isRunning) return;
    
    this.isRunning = true;
    console.log('Starting web crawler...');
    
    while (this.crawlQueue.length > 0 && this.isRunning) {
      const url = this.crawlQueue.shift();
      if (!url || this.crawledUrls.has(url)) continue;
      
      console.log(`Crawling: ${url}`);
      const result = await this.crawlUrl(url);
      
      if (result) {
        await this.saveCrawlResult(result);
        console.log(`Successfully crawled: ${url}`);
      }
      
      // Rate limiting - wait between requests
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    this.isRunning = false;
    console.log('Crawler finished.');
  }

  stopCrawling(): void {
    this.isRunning = false;
  }

  // Seed the crawler with initial URLs
  async seedUrls(): Promise<void> {
    const seedUrls = [
      'https://openai.com',
      'https://anthropic.com',
      'https://www.google.com',
      'https://github.com',
      'https://stackoverflow.com',
      'https://techcrunch.com',
      'https://aws.amazon.com',
      'https://azure.microsoft.com',
      'https://coinbase.com',
      'https://uniswap.org',
    ];

    for (const url of seedUrls) {
      await this.addUrlToCrawl(url);
    }
  }
}

export const webCrawler = new WebCrawler();
