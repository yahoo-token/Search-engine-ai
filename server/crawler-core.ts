import { promises as dns } from 'dns';
import { URL } from 'url';
import { fetch, Headers } from 'undici';
import { createHash } from 'crypto';
import { createGunzip, createBrotliDecompress } from 'zlib';
import { pipeline } from 'stream/promises';
import { Readable } from 'stream';

export interface DomainInfo {
  domain: string;
  isReachable: boolean;
  ipAddresses: string[];
  error?: string;
  lastChecked?: number;
}

export interface RobotsTxt {
  userAgentRules: Map<string, UserAgentRule>;
  crawlDelay: number;
  sitemaps: string[];
  isAllowed(userAgent: string, path: string): boolean;
  fetchedAt?: number;
}

export interface UserAgentRule {
  userAgent: string;
  allow: string[];
  disallow: string[];
  crawlDelay?: number;
}

export interface FetchResult {
  url: string;
  status: number;
  headers: Record<string, string>;
  content: Buffer;
  contentType: string;
  charset: string;
  etag?: string;
  lastModified?: string;
  redirects: string[];
  fetchTime: number;
  size: number;
}

export interface ExtractedContent {
  title: string;
  description: string;
  textContent: string;
  contentHash: string;
  lang?: string;
  meta: Record<string, any>;
  links: string[];
  images: string[];
}

export interface TokenBucket {
  tokens: number;
  capacity: number;
  refillRate: number;
  lastRefill: number;
}

/**
 * DNS Resolution utilities
 */
export class DNSResolver {
  private static cache = new Map<string, DomainInfo>();
  private static cacheTimeout = 5 * 60 * 1000; // 5 minutes

  static async resolveDomain(domain: string): Promise<DomainInfo> {
    const cached = this.cache.get(domain);
    if (cached && cached.lastChecked && Date.now() - cached.lastChecked < this.cacheTimeout) {
      return cached;
    }

    try {
      // Clean domain (remove protocol, path, etc.)
      const cleanDomain = domain.replace(/^https?:\/\//, '').split('/')[0].split(':')[0];
      
      const addresses = await dns.lookup(cleanDomain, { all: true });
      const ipAddresses = addresses.map(addr => addr.address);
      
      const domainInfo: DomainInfo = {
        domain: cleanDomain,
        isReachable: true,
        ipAddresses,
        lastChecked: Date.now()
      };
      
      this.cache.set(domain, domainInfo);
      return domainInfo;
    } catch (error) {
      const domainInfo: DomainInfo = {
        domain: domain.replace(/^https?:\/\//, '').split('/')[0].split(':')[0],
        isReachable: false,
        ipAddresses: [],
        error: error instanceof Error ? error.message : String(error),
        lastChecked: Date.now()
      };
      
      this.cache.set(domain, domainInfo);
      return domainInfo;
    }
  }

  static clearCache(): void {
    this.cache.clear();
  }
}

/**
 * Robots.txt parser
 */
export class RobotsTxtParser {
  private static cache = new Map<string, RobotsTxt>();
  private static cacheTimeout = 24 * 60 * 60 * 1000; // 24 hours

  static async fetchAndParseRobotsTxt(baseUrl: string): Promise<RobotsTxt> {
    const cached = this.cache.get(baseUrl);
    if (cached && cached.fetchedAt && Date.now() - cached.fetchedAt < this.cacheTimeout) {
      return cached;
    }

    try {
      const robotsUrl = new URL('/robots.txt', baseUrl).toString();
      const response = await fetch(robotsUrl, {
        headers: {
          'User-Agent': 'YHTBot/1.0 (+https://yht-search.replit.app)'
        },
        signal: AbortSignal.timeout(10000) // 10 second timeout
      });

      if (!response.ok) {
        return this.createDefaultRobotsTxt();
      }

      const content = await response.text();
      const robotsTxt = this.parseRobotsTxt(content);
      robotsTxt.fetchedAt = Date.now();
      
      this.cache.set(baseUrl, robotsTxt);
      return robotsTxt;
    } catch (error) {
      console.warn(`Failed to fetch robots.txt for ${baseUrl}:`, error instanceof Error ? error.message : String(error));
      return RobotsTxtParser.createDefaultRobotsTxt();
    }
  }

  private static parseRobotsTxt(content: string): RobotsTxt {
    const lines = content.split('\n').map(line => line.trim());
    const userAgentRules = new Map<string, UserAgentRule>();
    const sitemaps: string[] = [];
    let currentUserAgent = '*';
    let currentRule: UserAgentRule = {
      userAgent: '*',
      allow: [],
      disallow: [],
    };

    for (const line of lines) {
      if (line.startsWith('#') || !line) continue;

      const [directive, ...valueParts] = line.split(':');
      const value = valueParts.join(':').trim();

      switch (directive.toLowerCase()) {
        case 'user-agent':
          if (currentRule.userAgent !== '*' || currentRule.allow.length || currentRule.disallow.length) {
            userAgentRules.set(currentUserAgent, { ...currentRule });
          }
          currentUserAgent = value.toLowerCase();
          currentRule = {
            userAgent: value.toLowerCase(),
            allow: [],
            disallow: [],
          };
          break;

        case 'allow':
          currentRule.allow.push(value);
          break;

        case 'disallow':
          currentRule.disallow.push(value);
          break;

        case 'crawl-delay':
          const delay = parseInt(value);
          if (!isNaN(delay)) {
            currentRule.crawlDelay = delay * 1000; // Convert to milliseconds
          }
          break;

        case 'sitemap':
          sitemaps.push(value);
          break;
      }
    }

    // Add the last rule
    userAgentRules.set(currentUserAgent, currentRule);

    const robotsTxt: RobotsTxt = {
      userAgentRules,
      crawlDelay: this.getDefaultCrawlDelay(userAgentRules),
      sitemaps,
      isAllowed: (userAgent: string, path: string) => {
        return this.isPathAllowed(userAgentRules, userAgent, path);
      }
    };

    return robotsTxt;
  }

  private static getDefaultCrawlDelay(rules: Map<string, UserAgentRule>): number {
    // Check for our bot specifically
    const yhtRule = rules.get('yhtbot') || rules.get('yhtbot/1.0');
    if (yhtRule?.crawlDelay) return yhtRule.crawlDelay;

    // Check for wildcard rule
    const wildcardRule = rules.get('*');
    if (wildcardRule?.crawlDelay) return wildcardRule.crawlDelay;

    // Default crawl delay of 1 second
    return 1000;
  }

  private static isPathAllowed(rules: Map<string, UserAgentRule>, userAgent: string, path: string): boolean {
    const botName = 'yhtbot';
    
    // Check specific bot rules first
    const specificRule = rules.get(botName) || rules.get('yhtbot/1.0');
    if (specificRule) {
      return this.checkRuleAllowsPath(specificRule, path);
    }

    // Check wildcard rules
    const wildcardRule = rules.get('*');
    if (wildcardRule) {
      return this.checkRuleAllowsPath(wildcardRule, path);
    }

    // Default allow if no rules found
    return true;
  }

  private static checkRuleAllowsPath(rule: UserAgentRule, path: string): boolean {
    // Check disallow rules first (more restrictive)
    for (const disallowPattern of rule.disallow) {
      if (this.matchesPattern(path, disallowPattern)) {
        // Check if there's a more specific allow rule
        for (const allowPattern of rule.allow) {
          if (this.matchesPattern(path, allowPattern) && allowPattern.length >= disallowPattern.length) {
            return true;
          }
        }
        return false;
      }
    }

    // If not disallowed, check allow rules
    for (const allowPattern of rule.allow) {
      if (this.matchesPattern(path, allowPattern)) {
        return true;
      }
    }

    // If no explicit rules match, allow by default unless there are disallow rules
    return rule.disallow.length === 0 || !rule.disallow.some(pattern => pattern === '/');
  }

  private static matchesPattern(path: string, pattern: string): boolean {
    if (!pattern) return false;
    
    // Handle wildcards
    if (pattern.includes('*')) {
      const regexPattern = pattern.replace(/\*/g, '.*').replace(/\?/g, '.');
      return new RegExp(`^${regexPattern}`).test(path);
    }
    
    return path.startsWith(pattern);
  }

  static createDefaultRobotsTxt(): RobotsTxt {
    return {
      userAgentRules: new Map(),
      crawlDelay: 1000,
      sitemaps: [],
      isAllowed: () => true,
      fetchedAt: Date.now()
    };
  }
}

/**
 * Token bucket rate limiter
 */
export class TokenBucketManager {
  private static buckets = new Map<string, TokenBucket>();

  static getBucket(domain: string, capacity: number = 10, refillRate: number = 1): TokenBucket {
    const existing = this.buckets.get(domain);
    if (existing) {
      this.refillBucket(existing, refillRate);
      return existing;
    }

    const bucket: TokenBucket = {
      tokens: capacity,
      capacity,
      refillRate,
      lastRefill: Date.now()
    };

    this.buckets.set(domain, bucket);
    return bucket;
  }

  private static refillBucket(bucket: TokenBucket, refillRate: number): void {
    const now = Date.now();
    const timePassed = now - bucket.lastRefill;
    const tokensToAdd = Math.floor((timePassed / 1000) * refillRate);
    
    bucket.tokens = Math.min(bucket.capacity, bucket.tokens + tokensToAdd);
    bucket.lastRefill = now;
  }

  static async consumeToken(domain: string, crawlDelay: number = 1000): Promise<boolean> {
    const bucket = this.getBucket(domain);
    
    if (bucket.tokens >= 1) {
      bucket.tokens -= 1;
      return true;
    }

    // Wait for token to be available
    const waitTime = Math.max(crawlDelay, 1000);
    await new Promise(resolve => setTimeout(resolve, waitTime));
    
    // Try again after waiting
    this.refillBucket(bucket, bucket.refillRate);
    if (bucket.tokens >= 1) {
      bucket.tokens -= 1;
      return true;
    }

    return false;
  }

  static clearBuckets(): void {
    this.buckets.clear();
  }
}

/**
 * HTTP Fetcher with politeness policies
 */
export class PoliteFetcher {
  private static readonly USER_AGENT = 'YHTBot/1.0 (+https://yht-search.replit.app)';
  private static readonly MAX_CONTENT_SIZE = 50 * 1024 * 1024; // 50MB
  private static readonly TIMEOUT = 30000; // 30 seconds

  static async fetchWithPoliteness(url: string, options: {
    etag?: string;
    lastModified?: string;
    maxRetries?: number;
    crawlDelay?: number;
  } = {}): Promise<FetchResult> {
    const { maxRetries = 3, crawlDelay = 1000 } = options;
    const urlObj = new URL(url);
    const domain = urlObj.hostname;

    // Check if we can consume a token for this domain
    const canProceed = await TokenBucketManager.consumeToken(domain, crawlDelay);
    if (!canProceed) {
      throw new Error(`Rate limit exceeded for domain: ${domain}`);
    }

    const headers = new Headers({
      'User-Agent': this.USER_AGENT,
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.5',
      'Accept-Encoding': 'gzip, deflate, br',
      'DNT': '1',
      'Connection': 'keep-alive',
      'Upgrade-Insecure-Requests': '1',
    });

    if (options.etag) {
      headers.set('If-None-Match', options.etag);
    }

    if (options.lastModified) {
      headers.set('If-Modified-Since', options.lastModified);
    }

let lastError: Error | undefined;
    
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const startTime = Date.now();
        
        const response = await fetch(url, {
          method: 'GET',
          headers,
          signal: AbortSignal.timeout(this.TIMEOUT),
          redirect: 'follow'
        });

        const fetchTime = Date.now() - startTime;
        const responseHeaders: Record<string, string> = {};
        response.headers.forEach((value, key) => {
          responseHeaders[key.toLowerCase()] = value;
        });

        // Handle 304 Not Modified
        if (response.status === 304) {
          return {
            url: response.url,
            status: 304,
            headers: responseHeaders,
            content: Buffer.alloc(0),
            contentType: '',
            charset: 'utf-8',
            etag: responseHeaders.etag,
            lastModified: responseHeaders['last-modified'],
            redirects: [],
            fetchTime,
            size: 0
          };
        }

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        // Get content with size limit
        let content: Buffer;
        const contentLength = parseInt(responseHeaders['content-length'] || '0');
        
        if (contentLength > this.MAX_CONTENT_SIZE) {
          throw new Error(`Content too large: ${contentLength} bytes`);
        }

        const arrayBuffer = await response.arrayBuffer();
        content = Buffer.from(arrayBuffer);

        if (content.length > this.MAX_CONTENT_SIZE) {
          content = content.subarray(0, this.MAX_CONTENT_SIZE);
        }

        // Decompress if needed (with error handling)
        const encoding = responseHeaders['content-encoding'];
        if (encoding === 'gzip' || encoding === 'deflate') {
          try {
            content = await this.decompress(content, encoding);
          } catch (compressionError) {
            console.warn(`Decompression failed, using raw content:`, compressionError instanceof Error ? compressionError.message : String(compressionError));
            // Continue with uncompressed content
          }
        } else if (encoding === 'br') {
          try {
            content = await this.decompressBrotli(content);
          } catch (compressionError) {
            console.warn(`Brotli decompression failed, using raw content:`, compressionError instanceof Error ? compressionError.message : String(compressionError));
            // Continue with uncompressed content
          }
        }

        const contentType = responseHeaders['content-type'] || 'text/html';
        const charset = this.extractCharset(contentType) || 'utf-8';

        return {
          url: response.url,
          status: response.status,
          headers: responseHeaders,
          content,
          contentType,
          charset,
          etag: responseHeaders.etag,
          lastModified: responseHeaders['last-modified'],
          redirects: [], // TODO: Track redirects
          fetchTime,
          size: content.length
        };

      } catch (error) {
        lastError = error as Error;
        console.warn(`Fetch attempt ${attempt + 1} failed for ${url}:`, error instanceof Error ? error.message : String(error));
        
        if (attempt < maxRetries - 1) {
          // Exponential backoff
          const backoffTime = Math.min(1000 * Math.pow(2, attempt), 10000);
          await new Promise(resolve => setTimeout(resolve, backoffTime));
        }
      }
    }

    throw lastError || new Error('All fetch attempts failed');
  }

  private static async decompress(data: Buffer, encoding: string): Promise<Buffer> {
    const chunks: Buffer[] = [];
    const decompressor = encoding === 'gzip' ? createGunzip() : createGunzip(); // Node.js handles both
    
    await pipeline(
      Readable.from(data),
      decompressor,
      async function*(source) {
        for await (const chunk of source) {
          chunks.push(chunk);
          yield chunk;
        }
      }
    );

    return Buffer.concat(chunks);
  }

  private static async decompressBrotli(data: Buffer): Promise<Buffer> {
    const chunks: Buffer[] = [];
    const decompressor = createBrotliDecompress();
    
    await pipeline(
      Readable.from(data),
      decompressor,
      async function*(source) {
        for await (const chunk of source) {
          chunks.push(chunk);
          yield chunk;
        }
      }
    );

    return Buffer.concat(chunks);
  }

  private static extractCharset(contentType: string): string {
    const match = contentType.match(/charset=([^;]+)/i);
    return match ? match[1].trim().replace(/['"]/g, '') : 'utf-8';
  }
}

/**
 * Content extractor
 */
export class ContentExtractor {
  static extractContent(html: string, url: string): ExtractedContent {
    // html is already a string, use it directly
    const content = html;
    
    // Generate content hash for deduplication
    const contentHash = createHash('sha256').update(content).digest('hex');

    // Extract basic meta information
    const title = this.extractTitle(content);
    const description = this.extractDescription(content);
    const lang = this.extractLanguage(content);
    const meta = this.extractMetaTags(content);
    const textContent = this.extractTextContent(content);
    const links = this.extractLinks(content, url);
    const images = this.extractImages(content, url);

    return {
      title,
      description,
      textContent,
      contentHash,
      lang,
      meta,
      links,
      images
    };
  }

  private static extractTitle(html: string): string {
    // Try Open Graph title first
    const ogTitleMatch = html.match(/<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["'][^>]*>/i);
    if (ogTitleMatch) return this.decodeHtmlEntities(ogTitleMatch[1]);

    // Try regular title tag
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    if (titleMatch) return this.decodeHtmlEntities(titleMatch[1]);

    // Try h1 tag as fallback
    const h1Match = html.match(/<h1[^>]*>([^<]+)<\/h1>/i);
    if (h1Match) return this.decodeHtmlEntities(this.stripTags(h1Match[1]));

    return '';
  }

  private static extractDescription(html: string): string {
    // Try Open Graph description first
    const ogDescMatch = html.match(/<meta[^>]*property=["']og:description["'][^>]*content=["']([^"']+)["'][^>]*>/i);
    if (ogDescMatch) return this.decodeHtmlEntities(ogDescMatch[1]);

    // Try meta description
    const metaDescMatch = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["'][^>]*>/i);
    if (metaDescMatch) return this.decodeHtmlEntities(metaDescMatch[1]);

    // Try first paragraph as fallback
    const pMatch = html.match(/<p[^>]*>([^<]+)<\/p>/i);
    if (pMatch) {
      const text = this.stripTags(pMatch[1]).substring(0, 200);
      return this.decodeHtmlEntities(text);
    }

    return '';
  }

  private static extractLanguage(html: string): string {
    const langMatch = html.match(/<html[^>]*lang=["']([^"']+)["'][^>]*>/i);
    return langMatch ? langMatch[1] : 'en';
  }

  private static extractMetaTags(html: string): Record<string, any> {
    const meta: Record<string, any> = {};
    
    // Extract all meta tags  
    const metaRegex = /<meta[^>]*>/gi;
    let metaMatch;
    
    while ((metaMatch = metaRegex.exec(html)) !== null) {
      const match = metaMatch;
      const metaTag = match[0];
      
      // Extract name and content
      const nameMatch = metaTag.match(/name=["']([^"']+)["']/i);
      const contentMatch = metaTag.match(/content=["']([^"']*)["']/i);
      
      if (nameMatch && contentMatch) {
        meta[nameMatch[1]] = this.decodeHtmlEntities(contentMatch[1]);
      }
      
      // Extract property and content (Open Graph)
      const propertyMatch = metaTag.match(/property=["']([^"']+)["']/i);
      if (propertyMatch && contentMatch) {
        meta[propertyMatch[1]] = this.decodeHtmlEntities(contentMatch[1]);
      }
    }
    
    return meta;
  }

  private static extractTextContent(html: string): string {
    return html
      // Remove script and style elements
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<noscript[^>]*>[\s\S]*?<\/noscript>/gi, '')
      // Remove HTML tags
      .replace(/<[^>]+>/g, ' ')
      // Normalize whitespace
      .replace(/\s+/g, ' ')
      .trim()
      // Limit length
      .substring(0, 10000);
  }

  private static extractLinks(html: string, baseUrl: string): string[] {
    const links: string[] = [];
    const linkRegex = /<a[^>]*href=["']([^"']+)["'][^>]*>/gi;
    let linkMatch;
    
    while ((linkMatch = linkRegex.exec(html)) !== null) {
      const match = linkMatch;
      try {
        const url = new URL(match[1], baseUrl).toString();
        if (!links.includes(url)) {
          links.push(url);
        }
      } catch (e) {
        // Invalid URL, skip
      }
    }
    
    return links.slice(0, 100); // Limit to 100 links
  }

  private static extractImages(html: string, baseUrl: string): string[] {
    const images: string[] = [];
    const imgRegex = /<img[^>]*src=["']([^"']+)["'][^>]*>/gi;
    let imgMatch;
    
    while ((imgMatch = imgRegex.exec(html)) !== null) {
      const match = imgMatch;
      try {
        const url = new URL(match[1], baseUrl).toString();
        if (!images.includes(url)) {
          images.push(url);
        }
      } catch (e) {
        // Invalid URL, skip
      }
    }
    
    return images.slice(0, 50); // Limit to 50 images
  }

  private static stripTags(html: string): string {
    return html.replace(/<[^>]+>/g, '');
  }

  private static decodeHtmlEntities(text: string): string {
    const entities: Record<string, string> = {
      '&amp;': '&',
      '&lt;': '<',
      '&gt;': '>',
      '&quot;': '"',
      '&#x27;': "'",
      '&#x2F;': '/',
      '&#39;': "'",
      '&nbsp;': ' '
    };
    
    return text.replace(/&[#\w]+;/g, entity => entities[entity] || entity);
  }
}

/**
 * Main crawler core orchestrator
 */
export class CrawlerCore {
  static async crawlUrl(url: string, options: {
    respectRobots?: boolean;
    crawlDelay?: number;
    maxRetries?: number;
    etag?: string;
    lastModified?: string;
  } = {}): Promise<{
    fetchResult: FetchResult;
    extractedContent: ExtractedContent;
    robotsTxt?: RobotsTxt;
    domainInfo: DomainInfo;
  }> {
    const { respectRobots = true, crawlDelay, maxRetries = 3 } = options;
    
    try {
      const urlObj = new URL(url);
      const baseUrl = `${urlObj.protocol}//${urlObj.host}`;
      
      // Resolve domain
      const domainInfo = await DNSResolver.resolveDomain(urlObj.hostname);
      if (!domainInfo.isReachable) {
        throw new Error(`Domain not reachable: ${domainInfo.error}`);
      }

      // Check robots.txt if requested
      let robotsTxt: RobotsTxt | undefined;
      let effectiveCrawlDelay = crawlDelay || 1000;

      if (respectRobots) {
        robotsTxt = await RobotsTxtParser.fetchAndParseRobotsTxt(baseUrl);
        
        if (!robotsTxt.isAllowed('yhtbot', urlObj.pathname)) {
          throw new Error(`Robots.txt disallows crawling: ${url}`);
        }
        
        effectiveCrawlDelay = Math.max(effectiveCrawlDelay, robotsTxt.crawlDelay);
      }

      // Fetch the page
      const fetchResult = await PoliteFetcher.fetchWithPoliteness(url, {
        etag: options.etag,
        lastModified: options.lastModified,
        maxRetries,
        crawlDelay: effectiveCrawlDelay
      });

      // Extract content
      const contentText = fetchResult.content.toString(fetchResult.charset as BufferEncoding);
      const extractedContent = ContentExtractor.extractContent(contentText, url);

      return {
        fetchResult,
        extractedContent,
        robotsTxt,
        domainInfo
      };
    } catch (error) {
      console.error(`Failed to crawl ${url}:`, error instanceof Error ? error.message : String(error));
      throw error;
    }
  }

  static async checkDomainHealth(domain: string): Promise<{
    isHealthy: boolean;
    domainInfo: DomainInfo;
    robotsTxt: RobotsTxt;
    errors: string[];
  }> {
    const errors: string[] = [];

    // Check DNS resolution
    const domainInfo = await DNSResolver.resolveDomain(domain);
    if (!domainInfo.isReachable) {
      errors.push(`DNS resolution failed: ${domainInfo.error}`);
    }

    // Check robots.txt
    let robotsTxt: RobotsTxt;
    try {
      const baseUrl = domain.startsWith('http') ? domain : `https://${domain}`;
      robotsTxt = await RobotsTxtParser.fetchAndParseRobotsTxt(baseUrl);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      errors.push(`Robots.txt check failed: ${errorMessage}`);
      robotsTxt = RobotsTxtParser.createDefaultRobotsTxt();
    }

    return {
      isHealthy: errors.length === 0,
      domainInfo,
      robotsTxt,
      errors
    };
  }

  static clearCaches(): void {
    DNSResolver.clearCache();
    TokenBucketManager.clearBuckets();
  }
}