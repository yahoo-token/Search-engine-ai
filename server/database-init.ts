import { FullTextSearchSetup } from "./fulltext-search-setup";

/**
 * Database initialization for YHT content indexing system
 */
export class DatabaseInitializer {
  private static initialized = false;
  private static initializationPromise: Promise<void> | null = null;

  /**
   * Initialize the database with content indexing capabilities
   */
  static async initialize(): Promise<void> {
    if (this.initialized) {
      console.log("✅ Database already initialized");
      return;
    }

    // If initialization is already in progress, wait for it to complete
    if (this.initializationPromise) {
      console.log("🔄 Database initialization already in progress, waiting...");
      return this.initializationPromise;
    }

    // Create the initialization promise to prevent concurrent initialization
    this.initializationPromise = (async () => {
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
        this.initializationPromise = null; // Reset on failure to allow retry
        throw error;
      } finally {
        this.initializationPromise = null; // Reset after completion
      }
    })();

    return this.initializationPromise;
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