import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth } from "./auth";
import { generateAIResponse, categorizeSearchQuery } from "./openai";
import { webCrawler } from "./crawler";
import { CrawlerCore } from "./crawler-core";
import { crawlerDiscoveryIntegration, enhancedCrawler } from "./crawler-integration";
import { 
  insertSearchQuerySchema, 
  insertDomainSchema, 
  insertCrawlQueueSchema,
  type Domain,
  type Page,
  type CrawlQueue
} from "@shared/schema";
import { ZodError } from "zod";

export async function registerRoutes(app: Express): Promise<Server> {
  // Setup authentication
  setupAuth(app);

  // Search endpoint
  app.post("/api/search", async (req, res) => {
    try {
      // Validate input using Zod schema
      const validatedData = insertSearchQuerySchema.parse(req.body);
      const { query, category } = validatedData;

      // Auto-categorize if not specified
      const searchCategory = category === "all" ? await categorizeSearchQuery(query) : category;

      // Search crawled sites
      const searchResults = await storage.searchCrawledSites(query, searchCategory);

      // Generate AI response
      const aiResponse = await generateAIResponse(query, searchResults);

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

      res.json({
        query,
        category: searchCategory,
        results: searchResults,
        aiResponse,
        tokensEarned: req.isAuthenticated() ? tokensEarned : "0",
        totalResults: searchResults.length,
        searchTime: "0.42", // Mock search time
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
        error: "Search service temporarily unavailable"
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
        contractAddress: "0x3279eF4614f241a389114C77CdD28b70fcA9537a",
      });
    } catch (error) {
      console.error("Failed to fetch wallet data:", error);
      res.status(500).json({ message: "Failed to fetch wallet data" });
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
          robotsFetchedAt: new Date()
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
        error: error.message 
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
          status: 'active'
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
