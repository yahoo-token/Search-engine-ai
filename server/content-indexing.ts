import * as cheerio from 'cheerio';
import { createHash } from 'crypto';
import OpenAI from "openai";

// Initialize OpenAI for content categorization
const isOpenAIAvailable = !!process.env.OPENAI_API_KEY;
const openai = isOpenAIAvailable ? new OpenAI({ 
  apiKey: process.env.OPENAI_API_KEY!
}) : null;

export interface ExtractedContent {
  title: string;
  description: string;
  textContent: string;
  contentHash: string;
  lang?: string;
  meta: Record<string, any>;
  links: string[];
  images: string[];
  headings: string[];
  mainContent: string;
  summary: string;
  wordCount: number;
  // Enhanced branding and visual elements
  favicon?: string;
  logo?: string;
  ogImage?: string;
  twitterImage?: string;
  appleTouchIcon?: string;
  siteName?: string;
  authorName?: string;
  publishedDate?: string;
  modifiedDate?: string;
  canonicalUrl?: string;
  themeColor?: string;
  brandColors: string[];
}

export interface ContentCategorization {
  primary: string;
  secondary: string[];
  confidence: number;
  keywords: string[];
  domain: string;
}

export interface IndexingResult {
  content: ExtractedContent;
  category: ContentCategorization;
  titleVector: string;
  bodyVector: string;
  success: boolean;
  error?: string;
}

/**
 * Content extraction utilities
 */
export class ContentExtractor {
  private static readonly NOISE_SELECTORS = [
    'script', 'style', 'nav', 'header', 'footer', 
    '.sidebar', '.advertisement', '.cookie-banner', 
    '.social-share', '.comments', '.related-posts',
    '[role="banner"]', '[role="navigation"]', 
    '[role="complementary"]', '.popup', '.modal'
  ];

  private static readonly CONTENT_SELECTORS = [
    'main', 'article', '[role="main"]', '.content', 
    '.main-content', '.article-content', '.post-content',
    '.entry-content', '.page-content'
  ];

  /**
   * Extract clean text content from HTML
   */
  static extractContent(html: string, url: string): ExtractedContent {
    const $ = cheerio.load(html);
    const domain = this.extractDomain(url);

    // Remove noise elements
    this.NOISE_SELECTORS.forEach(selector => {
      $(selector).remove();
    });

    // Extract metadata
    const title = this.extractTitle($);
    const description = this.extractDescription($);
    const lang = this.extractLanguage($);
    const meta = this.extractMetadata($);

    // Extract enhanced branding elements
    const favicon = this.extractFavicon($, url);
    const logo = this.extractLogo($, url);
    const ogImage = this.extractOpenGraphImage($, url);
    const twitterImage = this.extractTwitterImage($, url);
    const appleTouchIcon = this.extractAppleTouchIcon($, url);
    const siteName = this.extractSiteName($);
    const authorName = this.extractAuthor($);
    const publishedDate = this.extractPublishedDate($);
    const modifiedDate = this.extractModifiedDate($);
    const canonicalUrl = this.extractCanonicalUrl($, url);
    const themeColor = this.extractThemeColor($);
    const brandColors = this.extractBrandColors($);

    // Extract links and images
    const links = this.extractLinks($, url);
    const images = this.extractImages($, url);

    // Extract structured content
    const headings = this.extractHeadings($);
    const mainContent = this.extractMainContent($);
    const textContent = this.extractTextContent($);

    // Generate summary
    const summary = this.generateSummary(textContent, title);
    const wordCount = this.countWords(textContent);

    // Generate content hash
    const contentHash = this.generateContentHash(title + textContent);

    return {
      title,
      description,
      textContent,
      contentHash,
      lang,
      meta: { ...meta, domain, url },
      links,
      images,
      headings,
      mainContent,
      summary,
      wordCount,
      favicon,
      logo,
      ogImage,
      twitterImage,
      appleTouchIcon,
      siteName,
      authorName,
      publishedDate,
      modifiedDate,
      canonicalUrl,
      themeColor,
      brandColors
    };
  }

  private static extractTitle($: cheerio.CheerioAPI): string {
    // Try multiple sources for title
    let title = $('title').first().text().trim();
    
    if (!title || title.length < 3) {
      title = $('h1').first().text().trim();
    }
    
    if (!title || title.length < 3) {
      title = $('meta[property="og:title"]').attr('content') || '';
    }
    
    if (!title || title.length < 3) {
      title = $('meta[name="twitter:title"]').attr('content') || '';
    }

    return this.cleanText(title).substring(0, 200);
  }

  private static extractDescription($: cheerio.CheerioAPI): string {
    // Try multiple sources for description
    let description = $('meta[name="description"]').attr('content') || '';
    
    if (!description || description.length < 10) {
      description = $('meta[property="og:description"]').attr('content') || '';
    }
    
    if (!description || description.length < 10) {
      description = $('meta[name="twitter:description"]').attr('content') || '';
    }

    if (!description || description.length < 10) {
      // Extract from first paragraph
      description = $('p').first().text().trim();
    }

    return this.cleanText(description).substring(0, 300);
  }

  private static extractLanguage($: cheerio.CheerioAPI): string | undefined {
    return $('html').attr('lang') || 
           $('meta[http-equiv="content-language"]').attr('content') ||
           undefined;
  }

  private static extractMetadata($: cheerio.CheerioAPI): Record<string, any> {
    const meta: Record<string, any> = {};

    // Extract common meta tags
    $('meta').each((_, element) => {
      const name = $(element).attr('name') || $(element).attr('property');
      const content = $(element).attr('content');
      
      if (name && content) {
        meta[name] = content;
      }
    });

    // Extract JSON-LD structured data
    $('script[type="application/ld+json"]').each((_, element) => {
      try {
        const jsonLD = JSON.parse($(element).html() || '');
        meta.structuredData = meta.structuredData || [];
        meta.structuredData.push(jsonLD);
      } catch (e) {
        // Ignore invalid JSON-LD
      }
    });

    return meta;
  }

  private static extractLinks($: cheerio.CheerioAPI, baseUrl: string): string[] {
    const links: string[] = [];
    const domain = this.extractDomain(baseUrl);

    $('a[href]').each((_, element) => {
      const href = $(element).attr('href');
      if (href && !href.startsWith('#') && !href.startsWith('javascript:')) {
        try {
          const absoluteUrl = new URL(href, baseUrl).toString();
          if (!links.includes(absoluteUrl)) {
            links.push(absoluteUrl);
          }
        } catch (e) {
          // Ignore invalid URLs
        }
      }
    });

    return links.slice(0, 100); // Limit links
  }

  private static extractImages($: cheerio.CheerioAPI, baseUrl: string): string[] {
    const images: string[] = [];

    // Prioritize larger, meaningful images
    $('img[src]').each((_, element) => {
      const $img = $(element);
      const src = $img.attr('src');
      const alt = $img.attr('alt') || '';
      const width = parseInt($img.attr('width') || '0');
      const height = parseInt($img.attr('height') || '0');
      
      if (src && !src.startsWith('data:')) {
        // Skip very small images (likely icons or tracking pixels)
        if ((width > 0 && width < 50) || (height > 0 && height < 50)) {
          return;
        }
        
        // Skip obvious tracking or advertisement images
        if (alt.toLowerCase().includes('tracking') || 
            alt.toLowerCase().includes('pixel') ||
            src.includes('googleadservices') ||
            src.includes('doubleclick')) {
          return;
        }

        try {
          const absoluteUrl = new URL(src, baseUrl).toString();
          if (!images.includes(absoluteUrl)) {
            images.push(absoluteUrl);
          }
        } catch (e) {
          // Ignore invalid URLs
        }
      }
    });

    return images.slice(0, 10); // Limit to most relevant images
  }

  private static extractHeadings($: cheerio.CheerioAPI): string[] {
    const headings: string[] = [];
    
    $('h1, h2, h3, h4, h5, h6').each((_, element) => {
      const text = this.cleanText($(element).text());
      if (text && text.length > 2) {
        headings.push(text);
      }
    });

    return headings;
  }

  private static extractMainContent($: cheerio.CheerioAPI): string {
    // Try to find main content using semantic selectors
    for (const selector of this.CONTENT_SELECTORS) {
      const content = $(selector).first();
      if (content.length > 0) {
        return this.cleanText(content.text());
      }
    }

    // Fallback to body content
    return this.cleanText($('body').text());
  }

  private static extractTextContent($: cheerio.CheerioAPI): string {
    // Get all text content
    const textContent = $('body').text();
    return this.cleanText(textContent);
  }

  private static cleanText(text: string): string {
    return text
      .replace(/\s+/g, ' ') // Normalize whitespace
      .replace(/[\r\n\t]/g, ' ') // Remove line breaks and tabs
      .replace(/[^\w\s.,!?-]/g, '') // Remove special characters except basic punctuation
      .trim();
  }

  private static extractDomain(url: string): string {
    try {
      return new URL(url).hostname;
    } catch (e) {
      return '';
    }
  }

  private static generateSummary(content: string, title: string): string {
    const words = content.split(/\s+/);
    const summaryLength = Math.min(50, Math.max(20, words.length * 0.1));
    
    // Simple extractive summary - first few sentences
    const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 10);
    const summary = sentences.slice(0, 3).join('. ').trim();
    
    return summary.substring(0, 200) + (summary.length > 200 ? '...' : '');
  }

  private static countWords(text: string): number {
    return text.trim().split(/\s+/).filter(word => word.length > 0).length;
  }

  private static generateContentHash(content: string): string {
    return createHash('sha256').update(content).digest('hex');
  }

  /**
   * Extract favicon URL
   */
  private static extractFavicon($: cheerio.CheerioAPI, baseUrl: string): string | undefined {
    // Try multiple favicon sources in order of preference
    const selectors = [
      'link[rel="icon"][href]',
      'link[rel="shortcut icon"][href]',
      'link[rel="apple-touch-icon"][href]',
      'link[rel="icon"][type="image/x-icon"][href]'
    ];

    for (const selector of selectors) {
      const href = $(selector).first().attr('href');
      if (href) {
        try {
          return new URL(href, baseUrl).toString();
        } catch (e) {
          // Continue to next selector
        }
      }
    }

    // Fallback to default favicon location
    try {
      return new URL('/favicon.ico', baseUrl).toString();
    } catch (e) {
      return undefined;
    }
  }

  /**
   * Extract company/website logo
   */
  private static extractLogo($: cheerio.CheerioAPI, baseUrl: string): string | undefined {
    // Try multiple logo detection strategies
    const logoSelectors = [
      'img[alt*="logo" i]',
      'img[class*="logo" i]',
      'img[id*="logo" i]',
      '.logo img',
      '.header img',
      '.navbar img',
      'header img',
      '[class*="brand"] img',
      '[id*="brand"] img'
    ];

    for (const selector of logoSelectors) {
      const logoImg = $(selector).first();
      if (logoImg.length > 0) {
        const src = logoImg.attr('src');
        if (src && !src.startsWith('data:')) {
          try {
            return new URL(src, baseUrl).toString();
          } catch (e) {
            // Continue to next selector
          }
        }
      }
    }

    return undefined;
  }

  /**
   * Extract Open Graph image
   */
  private static extractOpenGraphImage($: cheerio.CheerioAPI, baseUrl: string): string | undefined {
    const ogImage = $('meta[property="og:image"]').attr('content') ||
                   $('meta[property="og:image:url"]').attr('content');
    
    if (ogImage) {
      try {
        return new URL(ogImage, baseUrl).toString();
      } catch (e) {
        return undefined;
      }
    }
    return undefined;
  }

  /**
   * Extract Twitter image
   */
  private static extractTwitterImage($: cheerio.CheerioAPI, baseUrl: string): string | undefined {
    const twitterImage = $('meta[name="twitter:image"]').attr('content') ||
                        $('meta[name="twitter:image:src"]').attr('content');
    
    if (twitterImage) {
      try {
        return new URL(twitterImage, baseUrl).toString();
      } catch (e) {
        return undefined;
      }
    }
    return undefined;
  }

  /**
   * Extract Apple Touch Icon
   */
  private static extractAppleTouchIcon($: cheerio.CheerioAPI, baseUrl: string): string | undefined {
    const appleTouchIcon = $('link[rel="apple-touch-icon"]').attr('href');
    
    if (appleTouchIcon) {
      try {
        return new URL(appleTouchIcon, baseUrl).toString();
      } catch (e) {
        return undefined;
      }
    }
    return undefined;
  }

  /**
   * Extract site name
   */
  private static extractSiteName($: cheerio.CheerioAPI): string | undefined {
    return $('meta[property="og:site_name"]').attr('content') ||
           $('meta[name="application-name"]').attr('content') ||
           $('meta[name="apple-mobile-web-app-title"]').attr('content') ||
           undefined;
  }

  /**
   * Extract author information
   */
  private static extractAuthor($: cheerio.CheerioAPI): string | undefined {
    return $('meta[name="author"]').attr('content') ||
           $('meta[property="article:author"]').attr('content') ||
           $('meta[name="twitter:creator"]').attr('content') ||
           undefined;
  }

  /**
   * Extract published date
   */
  private static extractPublishedDate($: cheerio.CheerioAPI): string | undefined {
    return $('meta[property="article:published_time"]').attr('content') ||
           $('meta[name="date"]').attr('content') ||
           $('meta[name="publication_date"]').attr('content') ||
           $('time[datetime]').first().attr('datetime') ||
           undefined;
  }

  /**
   * Extract modified date
   */
  private static extractModifiedDate($: cheerio.CheerioAPI): string | undefined {
    return $('meta[property="article:modified_time"]').attr('content') ||
           $('meta[name="last-modified"]').attr('content') ||
           undefined;
  }

  /**
   * Extract canonical URL
   */
  private static extractCanonicalUrl($: cheerio.CheerioAPI, baseUrl: string): string | undefined {
    const canonical = $('link[rel="canonical"]').attr('href');
    
    if (canonical) {
      try {
        return new URL(canonical, baseUrl).toString();
      } catch (e) {
        return undefined;
      }
    }
    return undefined;
  }

  /**
   * Extract theme color
   */
  private static extractThemeColor($: cheerio.CheerioAPI): string | undefined {
    return $('meta[name="theme-color"]').attr('content') ||
           $('meta[name="msapplication-navbutton-color"]').attr('content') ||
           $('meta[name="apple-mobile-web-app-status-bar-style"]').attr('content') ||
           undefined;
  }

  /**
   * Extract brand colors from CSS and meta tags
   */
  private static extractBrandColors($: cheerio.CheerioAPI): string[] {
    const colors: string[] = [];
    
    // Extract from theme color
    const themeColor = $('meta[name="theme-color"]').attr('content');
    if (themeColor) {
      colors.push(themeColor);
    }

    // Extract from CSS custom properties (if available in style tags)
    $('style').each((_, element) => {
      const css = $(element).html() || '';
      const colorMatches = css.match(/--[\w-]*color[\w-]*\s*:\s*(#[0-9a-fA-F]{3,6}|rgb\([^)]+\)|hsl\([^)]+\))/g);
      if (colorMatches) {
        colorMatches.forEach(match => {
          const color = match.split(':')[1]?.trim();
          if (color && !colors.includes(color)) {
            colors.push(color);
          }
        });
      }
    });

    return colors.slice(0, 5); // Limit to 5 colors
  }
}

/**
 * Content categorization engine
 */
export class ContentCategorizer {
  private static readonly CATEGORY_KEYWORDS = {
    shopping: [
      'buy', 'shop', 'store', 'price', 'product', 'cart', 'order', 'purchase', 
      'sale', 'discount', 'deal', 'marketplace', 'ecommerce', 'retail', 'shipping'
    ],
    companies: [
      'company', 'corporation', 'business', 'enterprise', 'organization', 'firm',
      'startup', 'team', 'about us', 'careers', 'jobs', 'contact', 'office'
    ],
    news: [
      'news', 'breaking', 'latest', 'update', 'report', 'article', 'story',
      'press', 'journalism', 'media', 'today', 'yesterday', 'announced'
    ],
    saas: [
      'software', 'platform', 'tool', 'service', 'app', 'application', 'api',
      'dashboard', 'analytics', 'automation', 'workflow', 'integration', 'features'
    ],
    cloud: [
      'cloud', 'aws', 'azure', 'infrastructure', 'hosting', 'server', 'database',
      'storage', 'computing', 'scalable', 'deployment', 'devops', 'kubernetes'
    ],
    web3: [
      'blockchain', 'crypto', 'cryptocurrency', 'bitcoin', 'ethereum', 'nft',
      'defi', 'web3', 'smart contract', 'token', 'dao', 'dapp', 'metaverse'
    ]
  };

  private static readonly DOMAIN_PATTERNS = {
    shopping: [
      'amazon', 'ebay', 'shopify', 'stripe', 'paypal', 'squareup', 'etsy', 
      'walmart', 'target', 'bestbuy', 'costco', 'homedepot', 'wayfair', 
      'overstock', 'alibaba', 'shop', 'store', 'buy', 'mall', 'marketplace'
    ],
    companies: [
      'google', 'microsoft', 'apple', 'meta', 'tesla', 'netflix', 'disney',
      'samsung', 'sony', 'intel', 'adobe', 'oracle', 'ibm', 'hp', 'nvidia',
      'about', 'company', 'corp', 'inc', 'ltd', 'careers', 'jobs'
    ],
    news: [
      'cnn', 'bbc', 'techcrunch', 'theverge', 'wired', 'reuters', 
      'arstechnica', 'engadget', 'mashable', 'venturebeat', 'forbes', 'bloomberg',
      'news', 'press', 'media', 'times', 'post', 'herald', 'journal'
    ],
    saas: [
      'slack', 'notion', 'figma', 'zoom', 'salesforce', 'hubspot', 
      'asana', 'trello', 'dropbox', 'atlassian',
      'app', 'platform', 'tool', 'soft', 'tech', 'io', 'ly'
    ],
    cloud: [
      'aws', 'azure', 'cloud.google', 'vercel', 'netlify', 'cloudflare',
      'digitalocean', 'heroku', 'railway', 'render',
      'cloud', 'hosting', 'server', 'infra'
    ],
    web3: [
      'coinbase', 'binance', 'ethereum', 'opensea', 'uniswap', 'metamask',
      'chainlink', 'polygon',
      'crypto', 'blockchain', 'defi', 'nft', 'web3', 'dao'
    ]
  };

  /**
   * Categorize content using multiple signals
   */
  static async categorizeContent(content: ExtractedContent): Promise<ContentCategorization> {
    const domain = content.meta.domain || '';
    const text = `${content.title} ${content.description} ${content.textContent}`.toLowerCase();
    
    // Score each category
    const scores: Record<string, number> = {};
    
    for (const [category, keywords] of Object.entries(this.CATEGORY_KEYWORDS)) {
      scores[category] = this.calculateKeywordScore(text, keywords);
    }

    // Add domain scoring - more specific matching
    for (const [category, patterns] of Object.entries(this.DOMAIN_PATTERNS)) {
      let domainScore = 0;
      for (const pattern of patterns) {
        if (domain.includes(pattern)) {
          // Higher score for exact domain matches
          if (domain === pattern + '.com' || domain === pattern + '.org' || domain === pattern + '.io') {
            domainScore = 0.5;
            break;
          }
          // Lower score for partial matches
          domainScore = Math.max(domainScore, 0.3);
        }
      }
      scores[category] += domainScore;
    }

    // Use AI categorization if available
    if (isOpenAIAvailable && openai) {
      try {
        const aiCategory = await this.aiCategorization(content);
        if (aiCategory && scores[aiCategory] !== undefined) {
          scores[aiCategory] += 0.4; // Boost AI-suggested category
        }
      } catch (error) {
        console.warn('AI categorization failed:', error);
      }
    }

    // Find primary category
    const sortedCategories = Object.entries(scores)
      .sort(([,a], [,b]) => b - a);

    const primary = sortedCategories[0]?.[1] > 0.1 ? sortedCategories[0][0] : 'general';
    const secondary = sortedCategories
      .slice(1, 3)
      .filter(([,score]) => score > 0.05)
      .map(([category]) => category);

    const confidence = Math.min(0.95, sortedCategories[0]?.[1] || 0);

    // Extract keywords
    const keywords = this.extractKeywords(text);

    return {
      primary,
      secondary,
      confidence,
      keywords,
      domain
    };
  }

  private static calculateKeywordScore(text: string, keywords: string[]): number {
    let score = 0;
    for (const keyword of keywords) {
      const regex = new RegExp(`\\b${keyword}\\b`, 'gi');
      const matches = text.match(regex);
      if (matches) {
        score += matches.length * 0.1;
      }
    }
    return Math.min(1.0, score);
  }

  private static async aiCategorization(content: ExtractedContent): Promise<string | null> {
    if (!isOpenAIAvailable || !openai) return null;

    const prompt = `
    Categorize this web page content into one of these categories:
    - shopping: e-commerce, products, buying/selling
    - companies: business information, company profiles
    - news: news articles, current events, journalism
    - saas: software as a service, tools, platforms
    - cloud: cloud computing, infrastructure, hosting
    - web3: blockchain, cryptocurrency, NFTs, DeFi
    - general: anything that doesn't fit other categories

    Title: ${content.title}
    Description: ${content.description}
    Content sample: ${content.textContent.substring(0, 500)}

    Respond with just the category name.
    `;

    try {
      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 10,
        temperature: 0.1,
      });

      const category = response.choices[0].message.content?.trim().toLowerCase();
      const validCategories = ["shopping", "companies", "news", "saas", "cloud", "web3", "general"];
      
      return validCategories.includes(category || "") ? category! : null;
    } catch (error) {
      console.error("AI categorization error:", error);
      return null;
    }
  }

  private static extractKeywords(text: string): string[] {
    // Simple keyword extraction
    const words = text
      .toLowerCase()
      .split(/\s+/)
      .filter(word => word.length > 3 && !/^\d+$/.test(word))
      .filter(word => !this.isStopWord(word));

    // Count frequency
    const wordCounts = words.reduce((acc, word) => {
      acc[word] = (acc[word] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // Return top keywords
    return Object.entries(wordCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 10)
      .map(([word]) => word);
  }

  private static isStopWord(word: string): boolean {
    const stopWords = new Set([
      'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with',
      'by', 'this', 'that', 'these', 'those', 'is', 'are', 'was', 'were',
      'been', 'have', 'has', 'had', 'will', 'would', 'could', 'should',
      'can', 'may', 'might', 'must', 'shall', 'do', 'does', 'did', 'get'
    ]);
    return stopWords.has(word);
  }
}

/**
 * Full-text search vector generator
 */
export class SearchVectorGenerator {
  /**
   * Generate tsvector for title
   */
  static generateTitleVector(title: string): string {
    const cleanTitle = this.preprocessText(title);
    // PostgreSQL will handle tsvector generation with proper weights
    return cleanTitle;
  }

  /**
   * Generate tsvector for body content
   */
  static generateBodyVector(content: ExtractedContent): string {
    const bodyText = [
      content.description,
      content.headings.join(' '),
      content.mainContent
    ].join(' ');

    return this.preprocessText(bodyText);
  }

  private static preprocessText(text: string): string {
    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ') // Remove punctuation
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim();
  }
}

/**
 * Main content indexing orchestrator
 */
export class ContentIndexer {
  /**
   * Process HTML content and generate indexing data
   */
  static async indexContent(html: string, url: string): Promise<IndexingResult> {
    try {
      // Extract content
      const content = ContentExtractor.extractContent(html, url);
      
      // Categorize content
      const category = await ContentCategorizer.categorizeContent(content);
      
      // Generate search vectors
      const titleVector = SearchVectorGenerator.generateTitleVector(content.title);
      const bodyVector = SearchVectorGenerator.generateBodyVector(content);

      return {
        content,
        category,
        titleVector,
        bodyVector,
        success: true
      };
    } catch (error) {
      console.error('Content indexing failed:', error);
      return {
        content: {} as ExtractedContent,
        category: {} as ContentCategorization,
        titleVector: '',
        bodyVector: '',
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }
}