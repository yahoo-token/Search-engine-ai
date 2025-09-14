import * as cheerio from 'cheerio';
import { XMLParser } from 'fast-xml-parser';
import { createGunzip } from 'zlib';
import { pipeline } from 'stream/promises';
import { Readable } from 'stream';
import { fetch } from 'undici';
import { URL } from 'url';
import { createHash } from 'crypto';
import { RobotsTxtParser } from './crawler-core';

export interface DiscoveredUrl {
  url: string;
  normalizedUrl: string;
  source: 'link' | 'sitemap' | 'manual' | 'canonical';
  sourceUrl: string;
  discoveredAt: Date;
  priority: number;
  nofollow: boolean;
  lastmod?: Date;
  changefreq?: string;
  linkText?: string;
  linkType?: string;
  meta?: Record<string, any>;
}

export interface SitemapUrl {
  url: string;
  lastmod?: string;
  changefreq?: string;
  priority?: number;
}

export interface SitemapIndex {
  sitemaps: Array<{
    loc: string;
    lastmod?: string;
  }>;
}

export interface LinkExtractionResult {
  links: DiscoveredUrl[];
  internalLinks: number;
  externalLinks: number;
  canonicalUrl?: string;
  errors: string[];
}

export interface SitemapParseResult {
  urls: DiscoveredUrl[];
  errors: string[];
  isIndex: boolean;
  indexSitemaps?: string[];
}

/**
 * URL normalization and validation utilities
 */
export class UrlNormalizer {
  private static readonly IGNORED_PARAMS = new Set([
    'utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term',
    'gclid', 'fbclid', 'ref', 'source', 'medium'
  ]);

  private static readonly BINARY_EXTENSIONS = new Set([
    '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
    '.zip', '.rar', '.tar', '.gz', '.7z',
    '.jpg', '.jpeg', '.png', '.gif', '.bmp', '.svg', '.webp',
    '.mp3', '.mp4', '.avi', '.mov', '.wmv', '.flv',
    '.exe', '.dmg', '.deb', '.rpm'
  ]);

  static normalize(url: string, baseUrl?: string): string {
    try {
      // Resolve relative URLs
      const resolvedUrl = baseUrl ? new URL(url, baseUrl) : new URL(url);
      
      // Convert to lowercase (except path for case-sensitive servers)
      resolvedUrl.protocol = resolvedUrl.protocol.toLowerCase();
      resolvedUrl.hostname = resolvedUrl.hostname.toLowerCase();
      
      // Remove default ports
      if (
        (resolvedUrl.protocol === 'http:' && resolvedUrl.port === '80') ||
        (resolvedUrl.protocol === 'https:' && resolvedUrl.port === '443')
      ) {
        resolvedUrl.port = '';
      }
      
      // Remove fragment
      resolvedUrl.hash = '';
      
      // Clean up query parameters
      this.cleanQueryParams(resolvedUrl);
      
      // Remove trailing slash for non-root paths
      if (resolvedUrl.pathname.length > 1 && resolvedUrl.pathname.endsWith('/')) {
        resolvedUrl.pathname = resolvedUrl.pathname.slice(0, -1);
      }
      
      // Ensure root path has slash
      if (!resolvedUrl.pathname) {
        resolvedUrl.pathname = '/';
      }
      
      return resolvedUrl.toString();
    } catch (error) {
      throw new Error(`Invalid URL: ${url}`);
    }
  }

  private static cleanQueryParams(url: URL): void {
    const params = new URLSearchParams(url.search);
    const keysToRemove: string[] = [];
    
    params.forEach((value, key) => {
      if (this.IGNORED_PARAMS.has(key.toLowerCase())) {
        keysToRemove.push(key);
      }
    });
    
    keysToRemove.forEach(key => params.delete(key));
    url.search = params.toString();
  }

  static isValidWebUrl(url: string): boolean {
    try {
      const parsedUrl = new URL(url);
      return ['http:', 'https:'].includes(parsedUrl.protocol) &&
             parsedUrl.hostname.length > 0 &&
             !this.isBinaryUrl(url);
    } catch {
      return false;
    }
  }

  static isBinaryUrl(url: string): boolean {
    try {
      const parsedUrl = new URL(url);
      const pathname = parsedUrl.pathname.toLowerCase();
      return Array.from(this.BINARY_EXTENSIONS).some(ext => pathname.endsWith(ext));
    } catch {
      return false;
    }
  }

  static isSameDomain(url1: string, url2: string): boolean {
    try {
      const domain1 = new URL(url1).hostname.toLowerCase();
      const domain2 = new URL(url2).hostname.toLowerCase();
      return domain1 === domain2;
    } catch {
      return false;
    }
  }

  static getDomain(url: string): string {
    try {
      return new URL(url).hostname.toLowerCase();
    } catch {
      throw new Error(`Invalid URL: ${url}`);
    }
  }
}

/**
 * HTML link extraction using Cheerio
 */
export class HtmlLinkExtractor {
  private static readonly LINK_SELECTORS = [
    'a[href]',
    'link[rel="canonical"][href]',
    'area[href]',
    'base[href]'
  ];

  private static readonly RESOURCE_SELECTORS = [
    'link[rel="stylesheet"][href]',
    'script[src]',
    'img[src]',
    'iframe[src]',
    'embed[src]',
    'object[data]'
  ];

  static extractLinks(
    html: string, 
    baseUrl: string, 
    extractResources: boolean = false
  ): LinkExtractionResult {
    const result: LinkExtractionResult = {
      links: [],
      internalLinks: 0,
      externalLinks: 0,
      errors: []
    };

    try {
      const $ = cheerio.load(html);
      const baseDomain = UrlNormalizer.getDomain(baseUrl);
      
      // Check for base tag
      const baseHref = $('base[href]').first().attr('href');
      const effectiveBaseUrl = baseHref ? new URL(baseHref, baseUrl).toString() : baseUrl;
      
      // Extract canonical URL
      const canonical = $('link[rel="canonical"]').first().attr('href');
      if (canonical) {
        try {
          result.canonicalUrl = UrlNormalizer.normalize(canonical, effectiveBaseUrl);
        } catch (error) {
          result.errors.push(`Invalid canonical URL: ${canonical}`);
        }
      }

      // Extract navigation links
      this.LINK_SELECTORS.forEach(selector => {
        $(selector).each((_, element) => {
          const $el = $(element);
          const href = $el.attr('href');
          
          if (!href || href.startsWith('#') || href.startsWith('javascript:') || href.startsWith('mailto:') || href.startsWith('tel:')) {
            return;
          }

          try {
            const normalizedUrl = UrlNormalizer.normalize(href, effectiveBaseUrl);
            
            if (!UrlNormalizer.isValidWebUrl(normalizedUrl)) {
              return;
            }

            const isInternal = UrlNormalizer.isSameDomain(normalizedUrl, baseUrl);
            const nofollow = $el.attr('rel')?.includes('nofollow') || false;
            
            const discoveredUrl: DiscoveredUrl = {
              url: href,
              normalizedUrl,
              source: $el.attr('rel') === 'canonical' ? 'canonical' : 'link',
              sourceUrl: baseUrl,
              discoveredAt: new Date(),
              priority: isInternal ? 60 : 40,
              nofollow,
              linkText: $el.text().trim().substring(0, 200),
              linkType: $el.prop('tagName')?.toLowerCase() || 'unknown',
              meta: {
                title: $el.attr('title'),
                target: $el.attr('target'),
                rel: $el.attr('rel')
              }
            };

            result.links.push(discoveredUrl);
            
            if (isInternal) {
              result.internalLinks++;
            } else {
              result.externalLinks++;
            }
          } catch (error) {
            result.errors.push(`Invalid link URL: ${href} - ${error instanceof Error ? error.message : String(error)}`);
          }
        });
      });

      // Extract resource links if requested
      if (extractResources) {
        this.RESOURCE_SELECTORS.forEach(selector => {
          $(selector).each((_, element) => {
            const $el = $(element);
            const src = $el.attr('src') || $el.attr('href') || $el.attr('data');
            
            if (!src) return;

            try {
              const normalizedUrl = UrlNormalizer.normalize(src, effectiveBaseUrl);
              
              if (!UrlNormalizer.isValidWebUrl(normalizedUrl)) {
                return;
              }

              const isInternal = UrlNormalizer.isSameDomain(normalizedUrl, baseUrl);
              
              const discoveredUrl: DiscoveredUrl = {
                url: src,
                normalizedUrl,
                source: 'link',
                sourceUrl: baseUrl,
                discoveredAt: new Date(),
                priority: 20, // Lower priority for resources
                nofollow: false,
                linkType: $el.prop('tagName')?.toLowerCase() || 'unknown',
                meta: {
                  alt: $el.attr('alt'),
                  title: $el.attr('title'),
                  type: $el.attr('type')
                }
              };

              result.links.push(discoveredUrl);
              
              if (isInternal) {
                result.internalLinks++;
              } else {
                result.externalLinks++;
              }
            } catch (error) {
              result.errors.push(`Invalid resource URL: ${src} - ${error instanceof Error ? error.message : String(error)}`);
            }
          });
        });
      }

      return result;
    } catch (error) {
      result.errors.push(`HTML parsing error: ${error instanceof Error ? error.message : String(error)}`);
      return result;
    }
  }
}

/**
 * XML sitemap parsing with support for compression
 */
export class SitemapParser {
  private static readonly xmlParser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    textNodeName: '#text',
    parseTagValue: false,
    parseAttributeValue: false,
    trimValues: true
  });

  static async fetchAndParseSitemap(
    sitemapUrl: string,
    robotsTxt?: any
  ): Promise<SitemapParseResult> {
    const result: SitemapParseResult = {
      urls: [],
      errors: [],
      isIndex: false
    };

    try {
      // Validate against robots.txt if provided
      if (robotsTxt && !robotsTxt.isAllowed('yhtbot', new URL(sitemapUrl).pathname)) {
        result.errors.push('Sitemap access blocked by robots.txt');
        return result;
      }

      const response = await fetch(sitemapUrl, {
        headers: {
          'User-Agent': 'YHTBot/1.0 (+https://yht-search.replit.app)',
          'Accept': 'application/xml, text/xml, */*',
          'Accept-Encoding': 'gzip, deflate'
        },
        signal: AbortSignal.timeout(30000)
      });

      if (!response.ok) {
        result.errors.push(`HTTP ${response.status}: ${response.statusText}`);
        return result;
      }

      let xmlContent: string;
      
      // Handle compressed content
      const contentEncoding = response.headers.get('content-encoding');
      if (contentEncoding === 'gzip') {
        xmlContent = await this.decompressGzip(response.body);
      } else {
        xmlContent = await response.text();
      }

      return this.parseXmlSitemap(xmlContent, sitemapUrl);
    } catch (error) {
      result.errors.push(`Fetch error: ${error instanceof Error ? error.message : String(error)}`);
      return result;
    }
  }

  private static async decompressGzip(stream: any): Promise<string> {
    if (!stream) throw new Error('No stream provided');
    
    const chunks: Buffer[] = [];
    const gunzip = createGunzip();
    
    await pipeline(
      Readable.fromWeb(stream as any),
      gunzip
    );

    return new Promise((resolve, reject) => {
      gunzip.on('data', (chunk) => chunks.push(chunk));
      gunzip.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
      gunzip.on('error', reject);
    });
  }

  static parseXmlSitemap(xmlContent: string, sitemapUrl: string): SitemapParseResult {
    const result: SitemapParseResult = {
      urls: [],
      errors: [],
      isIndex: false
    };

    try {
      const parsed = this.xmlParser.parse(xmlContent);
      
      // Check if it's a sitemap index
      if (parsed.sitemapindex) {
        result.isIndex = true;
        result.indexSitemaps = this.parseSitemapIndex(parsed.sitemapindex);
        return result;
      }
      
      // Parse regular sitemap
      if (parsed.urlset && parsed.urlset.url) {
        const urls = Array.isArray(parsed.urlset.url) ? parsed.urlset.url : [parsed.urlset.url];
        
        for (const urlEntry of urls) {
          try {
            const discoveredUrl = this.parseUrlEntry(urlEntry, sitemapUrl);
            if (discoveredUrl) {
              result.urls.push(discoveredUrl);
            }
          } catch (error) {
            result.errors.push(`Invalid URL entry: ${error instanceof Error ? error.message : String(error)}`);
          }
        }
      }
      
      return result;
    } catch (error) {
      result.errors.push(`XML parsing error: ${error instanceof Error ? error.message : String(error)}`);
      return result;
    }
  }

  private static parseSitemapIndex(sitemapindex: any): string[] {
    const sitemaps: string[] = [];
    
    if (sitemapindex.sitemap) {
      const entries = Array.isArray(sitemapindex.sitemap) ? sitemapindex.sitemap : [sitemapindex.sitemap];
      
      for (const entry of entries) {
        if (entry.loc) {
          const url = typeof entry.loc === 'object' ? entry.loc['#text'] : entry.loc;
          if (url && UrlNormalizer.isValidWebUrl(url)) {
            sitemaps.push(url);
          }
        }
      }
    }
    
    return sitemaps;
  }

  private static parseUrlEntry(urlEntry: any, sitemapUrl: string): DiscoveredUrl | null {
    if (!urlEntry.loc) return null;
    
    const url = typeof urlEntry.loc === 'object' ? urlEntry.loc['#text'] : urlEntry.loc;
    
    if (!url || !UrlNormalizer.isValidWebUrl(url)) {
      return null;
    }

    const lastmod = urlEntry.lastmod ? this.parseDate(urlEntry.lastmod) : undefined;
    const changefreq = typeof urlEntry.changefreq === 'object' ? urlEntry.changefreq['#text'] : urlEntry.changefreq;
    const priority = urlEntry.priority ? parseFloat(urlEntry.priority) : undefined;

    return {
      url,
      normalizedUrl: UrlNormalizer.normalize(url),
      source: 'sitemap',
      sourceUrl: sitemapUrl,
      discoveredAt: new Date(),
      priority: this.calculatePriority(priority, changefreq),
      nofollow: false,
      lastmod,
      changefreq,
      meta: {
        priority,
        changefreq
      }
    };
  }

  private static parseDate(dateStr: string): Date | undefined {
    if (typeof dateStr === 'object') {
      dateStr = dateStr['#text'];
    }
    
    try {
      return new Date(dateStr);
    } catch {
      return undefined;
    }
  }

  private static calculatePriority(sitemapPriority?: number, changefreq?: string): number {
    let priority = 50; // Base priority
    
    if (sitemapPriority !== undefined) {
      priority += Math.round(sitemapPriority * 30); // 0-1 -> 0-30
    }
    
    switch (changefreq?.toLowerCase()) {
      case 'always':
        priority += 20;
        break;
      case 'hourly':
        priority += 15;
        break;
      case 'daily':
        priority += 10;
        break;
      case 'weekly':
        priority += 5;
        break;
      case 'monthly':
        priority += 2;
        break;
      case 'yearly':
        priority -= 5;
        break;
      case 'never':
        priority -= 20;
        break;
    }
    
    return Math.max(0, Math.min(100, priority));
  }
}

/**
 * URL deduplication and management
 */
export class UrlDeduplicator {
  private seen: Set<string> = new Set();
  private sourceMap: Map<string, DiscoveredUrl[]> = new Map();

  addUrl(discoveredUrl: DiscoveredUrl): boolean {
    const normalizedUrl = discoveredUrl.normalizedUrl;
    
    if (this.seen.has(normalizedUrl)) {
      // Add to existing sources for this URL
      const existing = this.sourceMap.get(normalizedUrl) || [];
      existing.push(discoveredUrl);
      this.sourceMap.set(normalizedUrl, existing);
      return false; // Not a new URL
    }
    
    this.seen.add(normalizedUrl);
    this.sourceMap.set(normalizedUrl, [discoveredUrl]);
    return true; // New URL
  }

  getUniqueUrls(): DiscoveredUrl[] {
    const unique: DiscoveredUrl[] = [];
    
    this.sourceMap.forEach((sources, normalizedUrl) => {
      // Choose the best source for this URL
      const bestSource = this.selectBestSource(sources);
      unique.push(bestSource);
    });
    
    return unique;
  }

  private selectBestSource(sources: DiscoveredUrl[]): DiscoveredUrl {
    // Priority order: canonical > sitemap > link
    const priorityOrder = { 'canonical': 4, 'sitemap': 3, 'link': 2, 'manual': 1 };
    
    return sources.reduce((best, current) => {
      const bestPriority = priorityOrder[best.source] || 0;
      const currentPriority = priorityOrder[current.source] || 0;
      
      if (currentPriority > bestPriority) {
        return current;
      } else if (currentPriority === bestPriority && current.priority > best.priority) {
        return current;
      }
      
      return best;
    });
  }

  getUrlSources(normalizedUrl: string): DiscoveredUrl[] {
    return this.sourceMap.get(normalizedUrl) || [];
  }

  size(): number {
    return this.seen.size;
  }

  clear(): void {
    this.seen.clear();
    this.sourceMap.clear();
  }
}

/**
 * Main page discovery orchestrator
 */
export class PageDiscoverySystem {
  private deduplicator: UrlDeduplicator = new UrlDeduplicator();

  async discoverFromHtml(
    html: string, 
    pageUrl: string, 
    options: {
      extractResources?: boolean;
      respectNofollow?: boolean;
      domainFilter?: string;
    } = {}
  ): Promise<{
    discovered: DiscoveredUrl[];
    duplicateCount: number;
    stats: {
      internal: number;
      external: number;
      resources: number;
      errors: number;
    };
    errors: string[];
  }> {
    const linkResult = HtmlLinkExtractor.extractLinks(
      html, 
      pageUrl, 
      options.extractResources || false
    );

    let validUrls = linkResult.links;

    // Filter by domain if specified
    if (options.domainFilter) {
      validUrls = validUrls.filter(url => 
        UrlNormalizer.isSameDomain(url.normalizedUrl, `https://${options.domainFilter}`)
      );
    }

    // Filter out nofollow links if respectNofollow is true
    if (options.respectNofollow) {
      validUrls = validUrls.filter(url => !url.nofollow);
    }

    const initialSize = this.deduplicator.size();
    
    // Add URLs to deduplicator
    validUrls.forEach(url => this.deduplicator.addUrl(url));
    
    const finalSize = this.deduplicator.size();
    const newUrls = finalSize - initialSize;
    const duplicateCount = validUrls.length - newUrls;

    return {
      discovered: validUrls,
      duplicateCount,
      stats: {
        internal: linkResult.internalLinks,
        external: linkResult.externalLinks,
        resources: validUrls.filter(u => u.priority === 20).length,
        errors: linkResult.errors.length
      },
      errors: linkResult.errors
    };
  }

  async discoverFromSitemaps(
    sitemapUrls: string[],
    robotsTxt?: any,
    domainFilter?: string
  ): Promise<{
    discovered: DiscoveredUrl[];
    duplicateCount: number;
    indexSitemaps: string[];
    stats: {
      sitemapsProcessed: number;
      urlsFound: number;
      errors: number;
    };
    errors: string[];
  }> {
    const allUrls: DiscoveredUrl[] = [];
    const allErrors: string[] = [];
    const indexSitemaps: string[] = [];
    let sitemapsProcessed = 0;

    for (const sitemapUrl of sitemapUrls) {
      try {
        const result = await SitemapParser.fetchAndParseSitemap(sitemapUrl, robotsTxt);
        sitemapsProcessed++;

        if (result.isIndex && result.indexSitemaps) {
          indexSitemaps.push(...result.indexSitemaps);
        } else {
          let validUrls = result.urls;

          // Filter by domain if specified
          if (domainFilter) {
            validUrls = validUrls.filter(url => 
              UrlNormalizer.isSameDomain(url.normalizedUrl, `https://${domainFilter}`)
            );
          }

          allUrls.push(...validUrls);
        }

        allErrors.push(...result.errors);
      } catch (error) {
        allErrors.push(`Sitemap ${sitemapUrl}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    const initialSize = this.deduplicator.size();
    
    // Add URLs to deduplicator
    allUrls.forEach(url => this.deduplicator.addUrl(url));
    
    const finalSize = this.deduplicator.size();
    const newUrls = finalSize - initialSize;
    const duplicateCount = allUrls.length - newUrls;

    return {
      discovered: allUrls,
      duplicateCount,
      indexSitemaps,
      stats: {
        sitemapsProcessed,
        urlsFound: allUrls.length,
        errors: allErrors.length
      },
      errors: allErrors
    };
  }

  getUniqueDiscoveredUrls(): DiscoveredUrl[] {
    return this.deduplicator.getUniqueUrls();
  }

  getDiscoveryStats(): {
    totalUnique: number;
    bySource: Record<string, number>;
    averagePriority: number;
  } {
    const unique = this.deduplicator.getUniqueUrls();
    const bySource: Record<string, number> = {};
    let totalPriority = 0;

    unique.forEach(url => {
      bySource[url.source] = (bySource[url.source] || 0) + 1;
      totalPriority += url.priority;
    });

    return {
      totalUnique: unique.length,
      bySource,
      averagePriority: unique.length > 0 ? totalPriority / unique.length : 0
    };
  }

  reset(): void {
    this.deduplicator.clear();
  }
}