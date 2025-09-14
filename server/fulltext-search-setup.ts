import { db } from "./db";
import { sql } from "drizzle-orm";

/**
 * PostgreSQL Full-Text Search Setup for YHT Content Indexing
 * 
 * This module sets up the full-text search infrastructure including:
 * - GIN indexes on tsvector columns
 * - Automatic tsvector generation triggers
 * - Search ranking functions
 * - Custom text search configurations
 */

export class FullTextSearchSetup {
  /**
   * Initialize all full-text search components
   */
  static async initializeFullTextSearch(): Promise<void> {
    console.log("🔍 Initializing PostgreSQL full-text search...");
    
    try {
      await this.createTextSearchConfig();
      await this.createSearchFunctions();
      await this.createTriggers();
      await this.createIndexes();
      
      console.log("✅ Full-text search initialization completed successfully");
    } catch (error) {
      console.error("❌ Failed to initialize full-text search:", error);
      throw error;
    }
  }

  /**
   * Create custom text search configuration optimized for web content
   */
  private static async createTextSearchConfig(): Promise<void> {
    console.log("📝 Creating custom text search configuration...");

    // Create custom text search configuration for better web content handling
    await db.execute(sql`
      DO $$ 
      BEGIN
        -- Create custom text search configuration if it doesn't exist
        IF NOT EXISTS (SELECT 1 FROM pg_ts_config WHERE cfgname = 'yht_web_content') THEN
          CREATE TEXT SEARCH CONFIGURATION yht_web_content (COPY = english);
          
          -- Add custom mappings for web content
          ALTER TEXT SEARCH CONFIGURATION yht_web_content
            ALTER MAPPING FOR asciiword, asciihword, hword_asciipart,
                              word, hword, hword_part
            WITH simple, english_stem;
        END IF;
      END $$;
    `);

    console.log("✅ Custom text search configuration created");
  }

  /**
   * Create search utility functions
   */
  private static async createSearchFunctions(): Promise<void> {
    console.log("🔧 Creating search utility functions...");

    // Function to generate tsvector for titles with proper weights
    await db.execute(sql`
      CREATE OR REPLACE FUNCTION generate_title_tsvector(title_text TEXT)
      RETURNS tsvector AS $$
      BEGIN
        RETURN setweight(to_tsvector('yht_web_content', COALESCE(title_text, '')), 'A');
      END;
      $$ LANGUAGE plpgsql IMMUTABLE;
    `);

    // Function to generate tsvector for body content with weights
    await db.execute(sql`
      CREATE OR REPLACE FUNCTION generate_body_tsvector(
        description_text TEXT,
        content_text TEXT,
        headings_text TEXT DEFAULT '',
        keywords_text TEXT DEFAULT ''
      )
      RETURNS tsvector AS $$
      BEGIN
        RETURN 
          setweight(to_tsvector('yht_web_content', COALESCE(description_text, '')), 'B') ||
          setweight(to_tsvector('yht_web_content', COALESCE(headings_text, '')), 'B') ||
          setweight(to_tsvector('yht_web_content', COALESCE(content_text, '')), 'C') ||
          setweight(to_tsvector('yht_web_content', COALESCE(keywords_text, '')), 'D');
      END;
      $$ LANGUAGE plpgsql IMMUTABLE;
    `);

    // Advanced search function with ranking
    await db.execute(sql`
      CREATE OR REPLACE FUNCTION search_pages_with_ranking(
        search_query TEXT,
        category_filter TEXT DEFAULT NULL,
        result_limit INTEGER DEFAULT 20,
        result_offset INTEGER DEFAULT 0
      )
      RETURNS TABLE(
        id VARCHAR,
        url TEXT,
        title TEXT,
        description TEXT,
        category VARCHAR,
        domain_id VARCHAR,
        last_fetched_at TIMESTAMP,
        rank_score REAL,
        headline_title TEXT,
        headline_description TEXT
      ) AS $$
      DECLARE
        tsquery_text TSQUERY;
        category_condition TEXT;
      BEGIN
        -- Convert search query to tsquery
        tsquery_text := plainto_tsquery('yht_web_content', search_query);
        
        -- Build category condition
        IF category_filter IS NOT NULL AND category_filter != 'all' THEN
          category_condition := ' AND p.category = ' || quote_literal(category_filter);
        ELSE
          category_condition := '';
        END IF;
        
        -- Execute dynamic query with ranking
        RETURN QUERY EXECUTE format('
          SELECT 
            p.id,
            p.url,
            p.title,
            p.description,
            p.category,
            p.domain_id,
            p.last_fetched_at,
            ts_rank_cd(
              COALESCE(p.title_tsv, to_tsvector('''')), 
              %L::tsquery, 
              32 /* normalize by document length */
            ) * 2.0 + 
            ts_rank_cd(
              COALESCE(p.body_tsv, to_tsvector('''')), 
              %L::tsquery, 
              32
            ) as rank_score,
            ts_headline(''yht_web_content'', COALESCE(p.title, ''''), %L::tsquery, 
              ''MaxWords=10, MinWords=1, ShortWord=3'') as headline_title,
            ts_headline(''yht_web_content'', COALESCE(p.description, ''''), %L::tsquery, 
              ''MaxWords=35, MinWords=5, ShortWord=3'') as headline_description
          FROM pages p
          WHERE (
            p.title_tsv @@ %L::tsquery OR 
            p.body_tsv @@ %L::tsquery
          ) %s
          ORDER BY rank_score DESC, p.last_fetched_at DESC
          LIMIT %s OFFSET %s
        ', 
        tsquery_text, tsquery_text, tsquery_text, tsquery_text, 
        tsquery_text, tsquery_text, category_condition, 
        result_limit, result_offset);
      END;
      $$ LANGUAGE plpgsql;
    `);

    // Function to get search statistics
    await db.execute(sql`
      CREATE OR REPLACE FUNCTION get_search_stats(search_query TEXT)
      RETURNS TABLE(
        total_matches BIGINT,
        avg_rank_score REAL,
        top_categories JSON
      ) AS $$
      DECLARE
        tsquery_text TSQUERY;
      BEGIN
        tsquery_text := plainto_tsquery('yht_web_content', search_query);
        
        RETURN QUERY
        SELECT 
          COUNT(*)::BIGINT as total_matches,
          AVG(
            ts_rank_cd(COALESCE(p.title_tsv, to_tsvector('')), tsquery_text, 32) * 2.0 + 
            ts_rank_cd(COALESCE(p.body_tsv, to_tsvector('')), tsquery_text, 32)
          )::REAL as avg_rank_score,
          json_agg(
            json_build_object('category', category, 'count', category_count)
            ORDER BY category_count DESC
          ) as top_categories
        FROM (
          SELECT 
            p.category,
            COUNT(*) as category_count
          FROM pages p
          WHERE p.title_tsv @@ tsquery_text OR p.body_tsv @@ tsquery_text
          GROUP BY p.category
          LIMIT 10
        ) category_stats, 
        (SELECT COUNT(*) FROM pages p WHERE p.title_tsv @@ tsquery_text OR p.body_tsv @@ tsquery_text) total;
      END;
      $$ LANGUAGE plpgsql;
    `);

    console.log("✅ Search utility functions created");
  }

  /**
   * Create triggers to automatically update tsvector columns
   */
  private static async createTriggers(): Promise<void> {
    console.log("⚡ Creating automatic tsvector update triggers...");

    // Create trigger function for pages table
    await db.execute(sql`
      CREATE OR REPLACE FUNCTION update_pages_tsvector()
      RETURNS trigger AS $$
      BEGIN
        -- Update title tsvector
        NEW.title_tsv := generate_title_tsvector(NEW.title);
        
        -- Update body tsvector (extract headings from meta if available)
        NEW.body_tsv := generate_body_tsvector(
          NEW.description,
          NEW.text_content,
          COALESCE((NEW.meta->>'headings')::TEXT, ''),
          COALESCE((NEW.meta->>'keywords')::TEXT, '')
        );
        
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `);

    // Drop trigger if it exists and create new one
    await db.execute(sql`
      DROP TRIGGER IF EXISTS pages_tsvector_update ON pages;
      
      CREATE TRIGGER pages_tsvector_update
        BEFORE INSERT OR UPDATE OF title, description, text_content, meta
        ON pages
        FOR EACH ROW
        EXECUTE FUNCTION update_pages_tsvector();
    `);

    console.log("✅ Automatic tsvector update triggers created");
  }

  /**
   * Create GIN indexes for optimal full-text search performance
   */
  private static async createIndexes(): Promise<void> {
    console.log("📊 Creating GIN indexes for tsvector columns...");

    // Create GIN indexes on tsvector columns
    await db.execute(sql`
      DO $$ 
      BEGIN
        -- Create GIN index on title_tsv if it doesn't exist
        IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_pages_title_tsv_gin') THEN
          CREATE INDEX idx_pages_title_tsv_gin ON pages USING GIN(title_tsv);
        END IF;
        
        -- Create GIN index on body_tsv if it doesn't exist
        IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_pages_body_tsv_gin') THEN
          CREATE INDEX idx_pages_body_tsv_gin ON pages USING GIN(body_tsv);
        END IF;
        
        -- Create combined GIN index for multi-column search
        IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_pages_combined_tsv_gin') THEN
          CREATE INDEX idx_pages_combined_tsv_gin ON pages USING GIN((title_tsv || body_tsv));
        END IF;
        
        -- Create index on category for filtered searches
        IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_pages_category') THEN
          CREATE INDEX idx_pages_category ON pages(category) WHERE category IS NOT NULL;
        END IF;
        
        -- Create composite index for category + tsvector searches
        IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_pages_category_title_tsv') THEN
          CREATE INDEX idx_pages_category_title_tsv ON pages USING GIN(category, title_tsv) 
          WHERE category IS NOT NULL;
        END IF;
      END $$;
    `);

    console.log("✅ GIN indexes created successfully");
  }

  /**
   * Update existing pages to populate tsvector columns
   */
  static async populateExistingTsvectors(): Promise<void> {
    console.log("🔄 Populating tsvector columns for existing pages...");

    try {
      const result = await db.execute(sql`
        UPDATE pages 
        SET 
          title_tsv = generate_title_tsvector(title),
          body_tsv = generate_body_tsvector(
            description,
            text_content,
            COALESCE((meta->>'headings')::TEXT, ''),
            COALESCE((meta->>'keywords')::TEXT, '')
          )
        WHERE title_tsv IS NULL OR body_tsv IS NULL;
      `);

      console.log(`✅ Updated tsvector columns for existing pages`);
    } catch (error) {
      console.error("❌ Failed to populate existing tsvector columns:", error);
      throw error;
    }
  }

  /**
   * Test the full-text search functionality
   */
  static async testFullTextSearch(): Promise<void> {
    console.log("🧪 Testing full-text search functionality...");

    try {
      // Test search function
      const testResults = await db.execute(sql`
        SELECT * FROM search_pages_with_ranking('test search', NULL, 5, 0);
      `);

      // Test search stats
      const testStats = await db.execute(sql`
        SELECT * FROM get_search_stats('test search');
      `);

      console.log("✅ Full-text search test completed successfully");
    } catch (error) {
      console.error("❌ Full-text search test failed:", error);
      throw error;
    }
  }

  /**
   * Get full-text search status and statistics
   */
  static async getSearchStatus(): Promise<{
    indexes: any[];
    functions: any[];
    config: any[];
    sampleSearch: any[];
  }> {
    try {
      // Check indexes
      const indexes = await db.execute(sql`
        SELECT indexname, tablename, indexdef 
        FROM pg_indexes 
        WHERE tablename = 'pages' AND indexname LIKE '%tsv%';
      `);

      // Check functions
      const functions = await db.execute(sql`
        SELECT proname, prosrc 
        FROM pg_proc 
        WHERE proname IN ('generate_title_tsvector', 'generate_body_tsvector', 'search_pages_with_ranking');
      `);

      // Check text search config
      const config = await db.execute(sql`
        SELECT cfgname FROM pg_ts_config WHERE cfgname = 'yht_web_content';
      `);

      // Sample search
      const sampleSearch = await db.execute(sql`
        SELECT COUNT(*) as total_pages_with_tsvector
        FROM pages 
        WHERE title_tsv IS NOT NULL OR body_tsv IS NOT NULL;
      `);

      return {
        indexes: indexes.rows || [],
        functions: functions.rows || [],
        config: config.rows || [],
        sampleSearch: sampleSearch.rows || []
      };
    } catch (error) {
      console.error("Failed to get search status:", error);
      throw error;
    }
  }
}

/**
 * Search query builder utilities
 */
export class SearchQueryBuilder {
  /**
   * Build a PostgreSQL tsquery from user input
   */
  static buildTsQuery(query: string, options: {
    usePhrase?: boolean;
    andOperator?: boolean;
    fuzzy?: boolean;
  } = {}): string {
    if (!query || query.trim().length === 0) {
      return '';
    }

    let processedQuery = query.trim();

    // Handle phrase search
    if (options.usePhrase || query.includes('"')) {
      // Extract phrases in quotes
      const phrases = processedQuery.match(/"([^"]+)"/g);
      if (phrases) {
        phrases.forEach(phrase => {
          const cleanPhrase = phrase.replace(/"/g, '');
          processedQuery = processedQuery.replace(phrase, `"${cleanPhrase}"`);
        });
      }
    }

    // Clean and tokenize
    const tokens = processedQuery
      .toLowerCase()
      .replace(/[^\w\s"]/g, ' ')
      .split(/\s+/)
      .filter(token => token.length > 0 && token !== '"');

    if (tokens.length === 0) {
      return '';
    }

    // Build tsquery
    if (options.andOperator) {
      return tokens.join(' & ');
    } else {
      return tokens.join(' | ');
    }
  }

  /**
   * Parse and validate search query
   */
  static parseSearchQuery(query: string): {
    original: string;
    processed: string;
    tokens: string[];
    hasPhrase: boolean;
    hasWildcard: boolean;
  } {
    const hasPhrase = query.includes('"');
    const hasWildcard = query.includes('*');
    
    const tokens = query
      .toLowerCase()
      .replace(/[^\w\s"*]/g, ' ')
      .split(/\s+/)
      .filter(token => token.length > 0);

    const processed = this.buildTsQuery(query, { andOperator: false });

    return {
      original: query,
      processed,
      tokens,
      hasPhrase,
      hasWildcard
    };
  }
}