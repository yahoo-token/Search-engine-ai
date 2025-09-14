import { FullTextSearchSetup } from "./fulltext-search-setup";

/**
 * Database initialization for YHT content indexing system
 */
export class DatabaseInitializer {
  private static initialized = false;

  /**
   * Initialize the database with content indexing capabilities
   */
  static async initialize(): Promise<void> {
    if (this.initialized) {
      console.log("✅ Database already initialized");
      return;
    }

    console.log("🔧 Initializing YHT content indexing database...");
    
    try {
      // Initialize full-text search components
      await FullTextSearchSetup.initializeFullTextSearch();
      
      // Populate existing pages with tsvector data
      await FullTextSearchSetup.populateExistingTsvectors();
      
      // Test the search functionality
      await FullTextSearchSetup.testFullTextSearch();
      
      this.initialized = true;
      console.log("✅ YHT content indexing database initialized successfully");
    } catch (error) {
      console.error("❌ Failed to initialize database:", error);
      throw error;
    }
  }

  /**
   * Get initialization status
   */
  static isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Force re-initialization (useful for testing)
   */
  static async reinitialize(): Promise<void> {
    this.initialized = false;
    await this.initialize();
  }

  /**
   * Get database status for debugging
   */
  static async getStatus(): Promise<any> {
    try {
      return await FullTextSearchSetup.getSearchStatus();
    } catch (error) {
      console.error("Failed to get database status:", error);
      return { error: error instanceof Error ? error.message : String(error) };
    }
  }
}

// Auto-initialize when module is loaded
DatabaseInitializer.initialize().catch(error => {
  console.error("Failed to auto-initialize database:", error);
});