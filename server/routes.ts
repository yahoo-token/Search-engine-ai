import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth } from "./auth";
import { generateAIResponse, categorizeSearchQuery } from "./openai";
import { webCrawler } from "./crawler";
import { CrawlerCore } from "./crawler-core";
import { crawlerDiscoveryIntegration, enhancedCrawler } from "./crawler-integration";
import { DatabaseInitializer } from "./database-init";
import { ContentIndexer } from "./content-indexing";
import { 
  insertSearchQuerySchema, 
  getPopularResultsSchema,
  insertDomainSchema, 
  insertCrawlQueueSchema,
  type Domain,
  type Page,
  type CrawlQueue
} from "@shared/schema";
import { z } from "zod";
import { ZodError } from "zod";

export async function registerRoutes(app: Express): Promise<Server> {
  // Initialize database with full-text search capabilities
  await DatabaseInitializer.initialize();
  
  // Setup authentication
  setupAuth(app);

  // Search endpoint with pagination support
  app.post("/api/search", async (req, res) => {
    try {
      // Validate input using Zod schema
      const validatedData = insertSearchQuerySchema.parse(req.body);
      const { query, category, page = 1, limit = 20 } = validatedData;

      // Calculate offset for pagination
      const offset = (page - 1) * limit;

      // Auto-categorize if not specified
      const searchCategory = category === "all" ? await categorizeSearchQuery(query) : category;

      // Use hybrid search combining full-text search and legacy data
      const searchData = await storage.searchContent(query, searchCategory, {
        limit,
        offset,
        includeRanking: true,
        useFullText: true
      });

      // Generate AI response
      const aiResponse = await generateAIResponse(query, searchData.results);

      // Calculate YHT tokens earned (base 5 tokens for quality search)
      const tokensEarned = "5.0";

      // Save search query if user is authenticated
      let searchQueryRecord = null;
      if (req.isAuthenticated() && req.user) {
        searchQueryRecord = await storage.createSearchQuery({
          userId: req.user.id,
          query,
          category: searchCategory,
          aiResponse: JSON.stringify(aiResponse),
          tokensEarned,
        });

        // Create token transaction
        await storage.createTokenTransaction({
          userId: req.user.id,
          type: "earned",
          amount: tokensEarned,
          reason: "Search quality bonus",
          searchQueryId: searchQueryRecord.id,
        });

        // Update user balance
        const currentBalance = parseFloat(req.user.yhtBalance || "0");
        const newBalance = (currentBalance + parseFloat(tokensEarned)).toString();
        await storage.updateUserBalance(req.user.id, newBalance);
      }

      // Calculate pagination metadata
      const totalPages = Math.ceil(searchData.totalCount / limit);
      const hasNextPage = page < totalPages;
      const hasPrevPage = page > 1;

      res.json({
        query,
        category: searchCategory,
        results: searchData.results,
        aiResponse,
        tokensEarned: req.isAuthenticated() ? tokensEarned : "0",
        totalResults: searchData.totalCount,
        currentPage: page,
        totalPages,
        hasNextPage,
        hasPrevPage,
        searchTime: "0.42", // Mock search time
        searchStats: searchData.searchStats,
      });
    } catch (error) {
      if (error instanceof ZodError) {
        const fieldErrors = error.errors.map(err => ({
          field: err.path.join('.'),
          message: err.message
        }));
        return res.status(400).json({ 
          message: "Validation failed",
          errors: fieldErrors
        });
      }

      console.error("Search error:", error);
      
      // Return 200 with error information for graceful degradation
      res.status(200).json({
        query: req.body.query || "",
        category: req.body.category || "all",
        results: [], // Empty results on error
        aiResponse: {
          summary: "Search service is currently experiencing issues. Please try again in a few moments.",
          keyPoints: ["Service temporarily unavailable", "Please check your connection", "Try again shortly"],
          relatedQuestions: ["How to troubleshoot search issues", "Alternative search methods", "Contact support"],
          confidence: 0
        },
        tokensEarned: "0",
        totalResults: 0,
        searchTime: "0.00",
        currentPage: req.body.page || 1,
        totalPages: 0,
        hasNextPage: false,
        hasPrevPage: false,
        error: "Search service temporarily unavailable"
      });
    }
  });

  // Website submission endpoint for users to add their sites
  const submitWebsiteSchema = z.object({
    url: z.string().url("Please enter a valid URL"),
    category: z.enum(["companies", "shopping", "news", "saas", "cloud", "web3"])
  });

  app.post("/api/submit-website", async (req, res) => {
    try {
      // Validate input using Zod schema
      const validatedData = submitWebsiteSchema.parse(req.body);
      const { url, category } = validatedData;

      // Extract domain from URL
      const urlObj = new URL(url);
      const domain = urlObj.hostname.replace(/^www\./, "");

      // Check if domain already exists (search across all categories)
      const existingDomains = await storage.listDomains("all", 100); // Get more results to check properly
      const domainExists = existingDomains.some(d => d.domain === domain);
      if (domainExists) {
        return res.status(400).json({
          success: false,
          message: "This website has already been submitted and is being crawled."
        });
      }

      // Create domain entry
      const domainData = await storage.createDomain({
        domain,
        status: "pending",
        priority: 75, // High priority for user submissions
        crawlDelayMs: 1000
      });

      // Add homepage URL to crawl queue
      let queuedUrls = 0;
      try {
        await storage.addToCrawlQueue({
          domainId: domainData.id!,
          url,
          priority: 75,
          reason: "seed" // Use valid reason type
        });
        queuedUrls = 1;
      } catch (error) {
        console.error("Failed to queue URL:", error);
      }

      // Trigger immediate crawling by notifying the background crawler
      console.log(`🆕 User submitted website: ${url} (${category})`);

      res.json({
        success: true,
        message: "Website submitted successfully! Our crawler will begin indexing it within the next few minutes.",
        domainId: domainData.id,
        queuedUrls
      });

    } catch (error) {
      if (error instanceof ZodError) {
        const fieldErrors = error.errors.map(err => ({
          field: err.path.join('.'),
          message: err.message
        }));
        return res.status(400).json({ 
          success: false,
          message: "Validation failed",
          errors: fieldErrors
        });
      }

      console.error("Website submission error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to submit website. Please try again later."
      });
    }
  });

  // Popular results endpoint for homepage default content
  app.get("/api/search/popular", async (req, res) => {
    try {
      // Parse query parameters with validation
      const { category = "all", page = 1, limit = 20 } = getPopularResultsSchema.parse({
        category: req.query.category,
        page: req.query.page ? parseInt(req.query.page as string) : 1,
        limit: req.query.limit ? parseInt(req.query.limit as string) : 20,
      });

      // Get popular results from storage
      const popularData = await storage.getPopularResults({
        category: category === "all" ? undefined : category,
        limit
      });

      // Calculate pagination metadata
      const totalPages = Math.ceil(popularData.totalCount / limit);
      const hasNextPage = page < totalPages;
      const hasPrevPage = page > 1;

      res.json({
        category,
        results: popularData.results,
        totalResults: popularData.totalCount,
        currentPage: page,
        totalPages,
        hasNextPage,
        hasPrevPage,
        isPopular: true
      });
    } catch (error) {
      if (error instanceof ZodError) {
        const fieldErrors = error.errors.map(err => ({
          field: err.path.join('.'),
          message: err.message
        }));
        return res.status(400).json({ 
          message: "Validation failed",
          errors: fieldErrors
        });
      }

      console.error("Popular results error:", error);
      res.status(500).json({
        message: "Failed to fetch popular results",
        results: [],
        totalResults: 0,
        currentPage: 1,
        totalPages: 0,
        hasNextPage: false,
        hasPrevPage: false,
        isPopular: true
      });
    }
  });

  // Get search history
  app.get("/api/search/history", async (req, res) => {
    if (!req.isAuthenticated() || !req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    try {
      const history = await storage.getSearchHistory(req.user.id);
      res.json(history);
    } catch (error) {
      console.error("Failed to fetch search history:", error);
      res.status(500).json({ message: "Failed to fetch search history" });
    }
  });

  // Get user token balance and transactions
  app.get("/api/wallet/balance", async (req, res) => {
    if (!req.isAuthenticated() || !req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    try {
      const transactions = await storage.getUserTokenTransactions(req.user.id);
      const user = await storage.getUser(req.user.id);
      
      res.json({
        balance: user?.yhtBalance || "0",
        transactions: transactions.slice(0, 10), // Last 10 transactions
        contractAddress: "0xb03e9886c74dcbfb581144991cc6415e46b47e4f",
      });
    } catch (error) {
      console.error("Failed to fetch wallet data:", error);
      res.status(500).json({ message: "Failed to fetch wallet data" });
    }
  });

  // In-memory cache for YHT price data (60s TTL)
  let priceCache: {
    data: any;
    timestamp: number;
  } | null = null;

  // Get YHT token price from external API
  app.get("/api/yht-price", async (req, res) => {
    // YHT token contract address on BSC - updated to correct address
    const YHT_CONTRACT = "0xb03e9886c74dcbfb581144991cc6415e46b47e4f";
    const CACHE_TTL = 60 * 1000; // 60 seconds in milliseconds
    
    try {
      
      // Check cache first
      const now = Date.now();
      if (priceCache && (now - priceCache.timestamp) < CACHE_TTL) {
        // Add Cache-Control header for browser/CDN caching
        res.setHeader('Cache-Control', `public, max-age=60, stale-while-revalidate=30`);
        return res.json({
          ...priceCache.data,
          cached: true,
          cacheAge: Math.floor((now - priceCache.timestamp) / 1000)
        });
      }
      
      // Try CoinGecko API first (most reliable)
      let price = null;
      let source = "unknown";
      let change24h = 0;
      
      try {
        // CoinGecko API for YHT token price - using contract address
        const coinGeckoController = new AbortController();
        const coinGeckoTimeoutId = setTimeout(() => coinGeckoController.abort(), 10000);
        
        const coinGeckoResponse = await fetch(
          `https://api.coingecko.com/api/v3/simple/token_price/binance-smart-chain?contract_addresses=${YHT_CONTRACT}&vs_currencies=usd&include_24hr_change=true`,
          { 
            headers: {
              'Accept': 'application/json',
              'User-Agent': 'YAS/1.0'
            },
            signal: coinGeckoController.signal
          }
        );
        
        clearTimeout(coinGeckoTimeoutId);
        
        if (coinGeckoResponse.ok) {
          const coinGeckoData = await coinGeckoResponse.json();
          const contractKey = YHT_CONTRACT.toLowerCase();
          
          if (coinGeckoData[contractKey]?.usd && coinGeckoData[contractKey].usd > 0) {
            price = parseFloat(coinGeckoData[contractKey].usd);
            change24h = parseFloat(coinGeckoData[contractKey].usd_24h_change || 0);
            source = "CoinGecko";
          }
        }
      } catch (error) {
        console.warn("CoinGecko API failed:", (error as Error).message);
      }
      
      // Fallback to PancakeSwap Info API  
      if (!price) {
        try {
          // Get YHT token price directly from PancakeSwap Info v2 (returns USD price)
          const yhtController = new AbortController();
          const yhtTimeoutId = setTimeout(() => yhtController.abort(), 10000);
          
          const yhtResponse = await fetch(
            `https://api.pancakeswap.info/api/v2/tokens/${YHT_CONTRACT}`,
            {
              headers: {
                'Accept': 'application/json',
                'User-Agent': 'YAS/1.0'
              },
              signal: yhtController.signal
            }
          );
          
          clearTimeout(yhtTimeoutId);
          
          if (yhtResponse.ok) {
            const yhtData = await yhtResponse.json();
            const yhtPriceUsd = parseFloat(yhtData.data?.price || 0);
            
            // PancakeSwap Info v2 API returns USD prices directly, not BNB prices
            if (yhtPriceUsd > 0) {
              price = yhtPriceUsd;
              source = "PancakeSwap";
            }
          }
        } catch (error) {
          console.warn("PancakeSwap Info API failed:", (error as Error).message);
        }
      }
      
      // Check if we got valid price data, use fallback if needed
      if (!price || price <= 0) {
        console.warn("All price data sources failed for YHT token, using fallback price");
        // Fallback price for YHT token when external sources are unavailable
        price = 0.000125; // $0.000125 USD as fallback
        change24h = 2.5; // Small positive change as fallback
        source = "Fallback";
      }
      
      // Use real 24h change from CoinGecko or default to 0 for other sources
      const changePercent = parseFloat(change24h.toFixed(2));
      
      const responseData = {
        price: parseFloat(price.toFixed(6)),
        priceFormatted: `$${price.toFixed(6)}`,
        change24h: changePercent,
        source,
        timestamp: new Date().toISOString(),
        contractAddress: YHT_CONTRACT,
        cached: false
      };
      
      // Cache successful response
      priceCache = {
        data: responseData,
        timestamp: now
      };
      
      // Add Cache-Control header
      res.setHeader('Cache-Control', `public, max-age=60, stale-while-revalidate=30`);
      res.json(responseData);
      
    } catch (error) {
      console.error("YHT price fetch error:", error);
      
      // Return proper error response with 502 status
      res.status(502).json({
        error: "Price service error",
        message: "An error occurred while fetching YHT price data",
        contractAddress: YHT_CONTRACT,
        timestamp: new Date().toISOString(),
        retryAfter: 60
      });
    }
  });

  // Webmaster tools - add URL to crawl
  app.post("/api/webmaster/submit-url", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    try {
      const { url } = req.body;
      if (!url) {
        return res.status(400).json({ message: "URL is required" });
      }

      await webCrawler.addUrlToCrawl(url);
      res.json({ message: "URL added to crawl queue", url });
    } catch (error) {
      console.error("Failed to submit URL:", error);
      res.status(500).json({ message: "Failed to submit URL" });
    }
  });

  // Get crawling statistics
  app.get("/api/webmaster/stats", async (req, res) => {
    try {
      // Get real statistics from the database
      const stats = await storage.getFetchStats();
      const queueStats = await storage.getCrawlQueueStats();
      const domains = await storage.listDomains('active', 1);
      
      res.json({
        indexedPages: stats.totalFetches.toString(),
        crawlRate: Math.round(stats.totalFetches / 24).toString(), // Per hour approximation
        lastCrawl: new Date().toISOString(),
        activeDomains: domains.length.toString(),
        totalBytes: stats.totalBytes,
        avgResponseTime: stats.avgResponseTime,
        queueSize: queueStats.pending
      });
    } catch (error) {
      console.error("Failed to fetch webmaster stats:", error);
      res.status(500).json({ message: "Failed to fetch statistics" });
    }
  });

  // === CONTENT INDEXING API ENDPOINTS ===

  // Index content for a specific page
  app.post("/api/indexing/index-page", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    try {
      const { url, html } = req.body;
      
      if (!url || !html) {
        return res.status(400).json({ message: "URL and HTML content are required" });
      }

      // Process the content with our indexing system
      const indexingResult = await ContentIndexer.indexContent(html, url);
      
      if (!indexingResult.success) {
        return res.status(500).json({ 
          message: "Content indexing failed", 
          error: indexingResult.error 
        });
      }

      // Check if page exists, if not create it
      let page = await storage.getPage(url);
      
      if (!page) {
        // Create new page entry
        const domain = new URL(url).hostname;
        let domainRecord = await storage.getDomain(domain);
        
        if (!domainRecord) {
          domainRecord = await storage.createDomain({
            domain,
            status: 'active',
            priority: 50,
            crawlDelayMs: 1000
          });
        }

        page = await storage.createPage({
          domainId: domainRecord.id,
          url,
          httpStatus: 200,
          title: indexingResult.content.title,
          description: indexingResult.content.description,
          textContent: indexingResult.content.textContent,
          category: indexingResult.category.primary,
          meta: {
            ...indexingResult.content.meta,
            headings: indexingResult.content.headings.join(' '),
            keywords: indexingResult.category.keywords.join(' '),
            categoryConfidence: indexingResult.category.confidence,
            wordCount: indexingResult.content.wordCount
          },
          contentHash: indexingResult.content.contentHash
        });
      } else {
        // Update existing page
        await storage.indexPageContent(page.id, {
          title: indexingResult.content.title,
          description: indexingResult.content.description,
          textContent: indexingResult.content.textContent,
          category: indexingResult.category.primary,
          meta: {
            ...indexingResult.content.meta,
            headings: indexingResult.content.headings.join(' '),
            keywords: indexingResult.category.keywords.join(' '),
            categoryConfidence: indexingResult.category.confidence,
            wordCount: indexingResult.content.wordCount
          }
        });
      }

      res.json({
        message: "Content indexed successfully",
        pageId: page.id,
        indexingResult: {
          category: indexingResult.category.primary,
          confidence: indexingResult.category.confidence,
          keywords: indexingResult.category.keywords,
          wordCount: indexingResult.content.wordCount,
          extractedTitle: indexingResult.content.title
        }
      });
    } catch (error) {
      console.error("Content indexing error:", error);
      res.status(500).json({ message: "Failed to index content" });
    }
  });

  // Get indexing status and statistics
  app.get("/api/indexing/status", async (req, res) => {
    try {
      const dbStatus = await DatabaseInitializer.getStatus();
      
      // Get some basic stats
      const totalPagesResult = await storage.getCrawlQueueStats();
      
      res.json({
        indexingSystem: {
          status: DatabaseInitializer.isInitialized() ? "active" : "inactive",
          database: dbStatus
        },
        statistics: {
          totalPages: totalPagesResult.total,
          queuedPages: totalPagesResult.pending
        }
      });
    } catch (error) {
      console.error("Failed to get indexing status:", error);
      res.status(500).json({ message: "Failed to get indexing status" });
    }
  });

  // Test full-text search functionality
  app.post("/api/indexing/test-search", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    try {
      const { query, category } = req.body;
      
      if (!query) {
        return res.status(400).json({ message: "Search query is required" });
      }

      const results = await storage.searchPagesFullText(query, {
        category,
        limit: 10,
        includeRanking: true,
        includeHeadlines: true
      });

      res.json({
        query,
        category: category || 'all',
        results: results.results.map(page => ({
          id: page.id,
          url: page.url,
          title: page.title,
          description: page.description,
          category: page.category,
          rankScore: page.rankScore,
          headlineTitle: page.headlineTitle,
          headlineDescription: page.headlineDescription
        })),
        totalCount: results.totalCount,
        searchStats: results.searchStats
      });
    } catch (error) {
      console.error("Test search error:", error);
      res.status(500).json({ message: "Test search failed" });
    }
  });

  // === ADVANCED CRAWLER API ENDPOINTS ===

  // Domain Management
  app.post("/api/crawler/domains", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    try {
      const validatedData = insertDomainSchema.parse(req.body);
      
      // Check if domain already exists
      const existingDomain = await storage.getDomain(validatedData.domain);
      if (existingDomain) {
        return res.status(409).json({ message: "Domain already exists", domain: existingDomain });
      }

      // Check domain health before adding
      const healthCheck = await CrawlerCore.checkDomainHealth(validatedData.domain);
      if (!healthCheck.isHealthy) {
        return res.status(400).json({ 
          message: "Domain is not healthy", 
          errors: healthCheck.errors 
        });
      }

      const domain = await storage.createDomain({
        ...validatedData,
        status: 'active',
        robotsTxt: JSON.stringify(healthCheck.robotsTxt),
        robotsFetchedAt: new Date()
      });

      res.status(201).json(domain);
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({ 
          message: "Validation failed",
          errors: error.errors
        });
      }

      console.error("Failed to add domain:", error);
      res.status(500).json({ message: "Failed to add domain" });
    }
  });

  app.get("/api/crawler/domains", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    try {
      const { status, limit = 50 } = req.query;
      const domains = await storage.listDomains(status as string, parseInt(limit as string));
      res.json(domains);
    } catch (error) {
      console.error("Failed to fetch domains:", error);
      res.status(500).json({ message: "Failed to fetch domains" });
    }
  });

  app.get("/api/crawler/domains/:id", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    try {
      const domain = await storage.getDomainById(req.params.id);
      if (!domain) {
        return res.status(404).json({ message: "Domain not found" });
      }

      const pages = await storage.getPagesByDomain(domain.id, 10);
      res.json({ ...domain, recentPages: pages });
    } catch (error) {
      console.error("Failed to fetch domain:", error);
      res.status(500).json({ message: "Failed to fetch domain" });
    }
  });

  app.patch("/api/crawler/domains/:id/status", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    try {
      const { status } = req.body;
      if (!['pending', 'active', 'blocked', 'error'].includes(status)) {
        return res.status(400).json({ message: "Invalid status" });
      }

      await storage.updateDomainStatus(req.params.id, status);
      res.json({ message: "Domain status updated" });
    } catch (error) {
      console.error("Failed to update domain status:", error);
      res.status(500).json({ message: "Failed to update domain status" });
    }
  });

  // Page Management
  app.get("/api/crawler/pages", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    try {
      const { query, domainId, limit = 20 } = req.query;
      
      let pages: Page[];
      if (domainId) {
        pages = await storage.getPagesByDomain(domainId as string, parseInt(limit as string));
      } else if (query) {
        pages = await storage.searchPages(query as string, parseInt(limit as string));
      } else {
        // Get recent pages if no specific query
        pages = await storage.getPagesByDomain('', parseInt(limit as string));
      }

      res.json(pages);
    } catch (error) {
      console.error("Failed to fetch pages:", error);
      res.status(500).json({ message: "Failed to fetch pages" });
    }
  });

  app.get("/api/crawler/pages/:id", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    try {
      const page = await storage.getPageById(req.params.id);
      if (!page) {
        return res.status(404).json({ message: "Page not found" });
      }

      const links = await storage.getLinksFromPage(page.id);
      const fetchLogs = await storage.getFetchLogsByPage(page.id, 5);
      
      res.json({ 
        ...page, 
        outgoingLinks: links.slice(0, 20),
        recentFetches: fetchLogs
      });
    } catch (error) {
      console.error("Failed to fetch page:", error);
      res.status(500).json({ message: "Failed to fetch page" });
    }
  });

  // Crawl Queue Management
  app.get("/api/crawler/queue", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    try {
      const stats = await storage.getCrawlQueueStats();
      const nextItems = await storage.getNextCrawlItems(10);
      
      res.json({
        stats,
        nextItems,
        isRunning: false // TODO: Implement actual crawler state tracking
      });
    } catch (error) {
      console.error("Failed to fetch crawl queue:", error);
      res.status(500).json({ message: "Failed to fetch crawl queue" });
    }
  });

  app.post("/api/crawler/queue/add", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    try {
      const validatedData = insertCrawlQueueSchema.parse(req.body);
      
      // Check if domain exists
      const domain = await storage.getDomainById(validatedData.domainId);
      if (!domain) {
        return res.status(400).json({ message: "Domain not found" });
      }

      const queueItem = await storage.addToCrawlQueue(validatedData);
      res.status(201).json(queueItem);
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({ 
          message: "Validation failed",
          errors: error.errors
        });
      }

      console.error("Failed to add to crawl queue:", error);
      res.status(500).json({ message: "Failed to add to crawl queue" });
    }
  });

  app.delete("/api/crawler/queue/:id", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    try {
      await storage.removeCrawlQueueItem(req.params.id);
      res.json({ message: "Queue item removed" });
    } catch (error) {
      console.error("Failed to remove queue item:", error);
      res.status(500).json({ message: "Failed to remove queue item" });
    }
  });

  // Crawler Monitoring & Control
  app.get("/api/crawler/stats", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    try {
      const { since } = req.query;
      const sinceDate = since ? new Date(since as string) : undefined;
      
      const fetchStats = await storage.getFetchStats(sinceDate);
      const queueStats = await storage.getCrawlQueueStats();
      const activeDomains = await storage.listDomains('active', 5);
      
      res.json({
        fetch: fetchStats,
        queue: queueStats,
        activeDomains: activeDomains.length,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error("Failed to fetch crawler stats:", error);
      res.status(500).json({ message: "Failed to fetch crawler stats" });
    }
  });

  app.get("/api/crawler/logs", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    try {
      const { limit = 50, pageId } = req.query;
      
      let logs;
      if (pageId) {
        logs = await storage.getFetchLogsByPage(pageId as string, parseInt(limit as string));
      } else {
        logs = await storage.getRecentFetchLogs(parseInt(limit as string));
      }
      
      res.json(logs);
    } catch (error) {
      console.error("Failed to fetch logs:", error);
      res.status(500).json({ message: "Failed to fetch logs" });
    }
  });

  // Advanced crawl endpoint using new crawler core
  app.post("/api/crawler/crawl-url", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    try {
      const { url, respectRobots = true } = req.body;
      
      if (!url) {
        return res.status(400).json({ message: "URL is required" });
      }

      const startTime = Date.now();
      const result = await CrawlerCore.crawlUrl(url, { respectRobots });
      const duration = Date.now() - startTime;

      // Save results to database
      const urlObj = new URL(url);
      const domainName = urlObj.hostname;
      
      // Get or create domain
      let domain = await storage.getDomain(domainName);
      if (!domain) {
        domain = await storage.createDomain({
          domain: domainName,
          status: 'active',
          robotsTxt: JSON.stringify(result.robotsTxt),
          robotsFetchedAt: new Date(),
          crawlDelayMs: 1000,
          priority: 50
        });
      }

      // Create page record
      const page = await storage.createPage({
        domainId: domain.id,
        url: result.fetchResult.url,
        httpStatus: result.fetchResult.status,
        contentHash: result.extractedContent.contentHash,
        title: result.extractedContent.title,
        description: result.extractedContent.description,
        textContent: result.extractedContent.textContent,
        meta: result.extractedContent.meta,
        lang: result.extractedContent.lang,
        etag: result.fetchResult.etag,
        lastModified: result.fetchResult.lastModified ? new Date(result.fetchResult.lastModified) : undefined
      });

      // Save links
      if (result.extractedContent.links.length > 0) {
        const links = result.extractedContent.links.map(link => ({
          fromPageId: page.id,
          toUrl: link,
          nofollow: false
        }));
        await storage.saveLinks(links);
      }

      // Create fetch log
      await storage.createFetchLog({
        pageId: page.id,
        url: result.fetchResult.url,
        startedAt: new Date(Date.now() - duration),
        finishedAt: new Date(),
        bytes: result.fetchResult.size,
        durationMs: duration,
        httpStatus: result.fetchResult.status
      });

      res.json({
        message: "URL crawled successfully",
        page,
        extractedContent: result.extractedContent,
        fetchStats: {
          duration,
          size: result.fetchResult.size,
          status: result.fetchResult.status
        }
      });

    } catch (error) {
      console.error("Failed to crawl URL:", error);
      res.status(500).json({ 
        message: "Failed to crawl URL", 
        error: (error as Error).message 
      });
    }
  });

  // Page Discovery Endpoints
  app.post("/api/discovery/discover-page", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    try {
      const { url, extractResources = false, respectNofollow = true } = req.body;
      
      if (!url) {
        return res.status(400).json({ message: "URL is required" });
      }

      // Get or create domain
      const urlObj = new URL(url);
      const domainName = urlObj.hostname;
      
      let domain = await storage.getDomain(domainName);
      if (!domain) {
        domain = await storage.createDomain({
          domain: domainName,
          status: 'active',
          crawlDelayMs: 1000,
          priority: 50
        });
      }

      // Crawl page with discovery
      const result = await enhancedCrawler.crawlPageWithDiscovery(url, domain);

      res.json({
        message: "Page discovery completed",
        page: result.page,
        discovery: result.discoveryResult,
        errors: result.errors
      });

    } catch (error) {
      console.error("Failed to discover page:", error);
      res.status(500).json({ 
        message: "Failed to discover page", 
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });

  app.post("/api/discovery/discover-sitemaps", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    try {
      const { domainId } = req.body;
      
      if (!domainId) {
        return res.status(400).json({ message: "Domain ID is required" });
      }

      const domain = await storage.getDomainById(domainId);
      if (!domain) {
        return res.status(404).json({ message: "Domain not found" });
      }

      const result = await enhancedCrawler.discoverFromDomainSitemaps(domain);

      res.json({
        message: "Sitemap discovery completed",
        domain: domain.domain,
        discovery: result
      });

    } catch (error) {
      console.error("Failed to discover sitemaps:", error);
      res.status(500).json({ 
        message: "Failed to discover sitemaps", 
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });

  app.get("/api/discovery/stats", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    try {
      const { domainId } = req.query;
      
      if (domainId) {
        const stats = await crawlerDiscoveryIntegration.getDomainDiscoveryStats(domainId as string);
        res.json({
          domain: domainId,
          stats,
          timestamp: new Date().toISOString()
        });
      } else {
        const globalStats = await storage.getDiscoveryStats();
        const overallStats = crawlerDiscoveryIntegration.getOverallStats();
        
        res.json({
          global: globalStats,
          overall: overallStats,
          timestamp: new Date().toISOString()
        });
      }

    } catch (error) {
      console.error("Failed to fetch discovery stats:", error);
      res.status(500).json({ message: "Failed to fetch discovery stats" });
    }
  });

  app.get("/api/discovery/queue", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    try {
      const { reason, limit = 50 } = req.query;
      
      let queueItems;
      if (reason) {
        queueItems = await storage.getCrawlQueueByReason(reason as string, parseInt(limit as string));
      } else {
        queueItems = await storage.getNextCrawlItems(parseInt(limit as string));
      }
      
      res.json({
        items: queueItems,
        count: queueItems.length,
        filters: { reason, limit }
      });

    } catch (error) {
      console.error("Failed to fetch discovery queue:", error);
      res.status(500).json({ message: "Failed to fetch discovery queue" });
    }
  });

  app.post("/api/discovery/cleanup-duplicates", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    try {
      const { domainId } = req.body;
      
      if (!domainId) {
        return res.status(400).json({ message: "Domain ID is required" });
      }

      const removedCount = await crawlerDiscoveryIntegration.cleanupDuplicates(domainId);

      res.json({
        message: "Duplicate cleanup completed",
        domainId,
        removedCount
      });

    } catch (error) {
      console.error("Failed to cleanup duplicates:", error);
      res.status(500).json({ 
        message: "Failed to cleanup duplicates", 
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });

  app.post("/api/discovery/reset", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    try {
      crawlerDiscoveryIntegration.reset();
      
      res.json({
        message: "Discovery system reset completed"
      });

    } catch (error) {
      console.error("Failed to reset discovery system:", error);
      res.status(500).json({ 
        message: "Failed to reset discovery system", 
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // Initialize crawler with seed URLs
  webCrawler.seedUrls().then(() => {
    console.log("Web crawler initialized with seed URLs");
  });

  const httpServer = createServer(app);
  return httpServer;
}
