import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth } from "./auth";
import { generateAIResponse, categorizeSearchQuery } from "./openai";
import { webCrawler } from "./crawler";
import { insertSearchQuerySchema } from "@shared/schema";

export async function registerRoutes(app: Express): Promise<Server> {
  // Setup authentication
  setupAuth(app);

  // Search endpoint
  app.post("/api/search", async (req, res) => {
    try {
      const { query, category = "all" } = req.body;
      
      if (!query) {
        return res.status(400).json({ message: "Query is required" });
      }

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
      // In a real implementation, you'd query actual statistics from the database
      res.json({
        indexedPages: "2300000",
        crawlRate: "45200",
        lastCrawl: new Date().toISOString(),
        activeDomains: "125000",
      });
    } catch (error) {
      console.error("Failed to fetch webmaster stats:", error);
      res.status(500).json({ message: "Failed to fetch statistics" });
    }
  });

  // Initialize crawler with seed URLs
  webCrawler.seedUrls().then(() => {
    console.log("Web crawler initialized with seed URLs");
  });

  const httpServer = createServer(app);
  return httpServer;
}
