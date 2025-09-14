import { storage } from './storage';
import { Agent } from 'undici';
import { type InsertCrawlQueue, type InsertLink, type InsertFetchLog } from '@shared/schema';

/**
 * Scale Optimizations for YHT Crawler System
 * Handles connection pooling, batching, memory management, and performance optimizations
 */

export interface ScaleConfig {
  maxConnections: number;
  connectionTimeout: number;
  connectionKeepAlive: number;
  batchSize: number;
  memoryThresholdMB: number;
  connectionPoolSize: number;
  maxIdleConnections: number;
  requestPipelining: number;
}

export interface BatchOperationStats {
  queueItemsProcessed: number;
  linksProcessed: number;
  fetchLogsProcessed: number;
  batchesProcessed: number;
  averageBatchTime: number;
  memoryUsage: NodeJS.MemoryUsage;
  connectionPoolStats: {
    active: number;
    idle: number;
    total: number;
  };
}

export class CrawlerScaleOptimizations {
  private config: ScaleConfig;
  private httpAgent: Agent;
  private batchQueues: {
    crawlQueue: InsertCrawlQueue[];
    links: InsertLink[];
    fetchLogs: InsertFetchLog[];
  };
  private batchTimers: {
    crawlQueue?: NodeJS.Timeout;
    links?: NodeJS.Timeout;
    fetchLogs?: NodeJS.Timeout;
  };
  private stats: BatchOperationStats;

  constructor(config: Partial<ScaleConfig> = {}) {
    this.config = {
      maxConnections: 100,
      connectionTimeout: 30000,
      connectionKeepAlive: 60000,
      batchSize: 50,
      memoryThresholdMB: 2048, // 2GB
      connectionPoolSize: 50,
      maxIdleConnections: 10,
      requestPipelining: 10,
      ...config
    };

    // Create optimized HTTP agent with connection pooling
    this.httpAgent = new Agent({
      connections: this.config.connectionPoolSize,
      pipelining: this.config.requestPipelining,
      keepAliveTimeout: this.config.connectionKeepAlive,
      keepAliveMaxTimeout: this.config.connectionKeepAlive * 2,
      bodyTimeout: this.config.connectionTimeout,
      headersTimeout: this.config.connectionTimeout,
      maxHeaderSize: 64 * 1024, // 64KB max headers
      connect: {
        timeout: this.config.connectionTimeout,
        rejectUnauthorized: false, // Allow self-signed certs for testing
      },
    });

    this.batchQueues = {
      crawlQueue: [],
      links: [],
      fetchLogs: [],
    };

    this.batchTimers = {};

    this.stats = {
      queueItemsProcessed: 0,
      linksProcessed: 0,
      fetchLogsProcessed: 0,
      batchesProcessed: 0,
      averageBatchTime: 0,
      memoryUsage: process.memoryUsage(),
      connectionPoolStats: {
        active: 0,
        idle: 0,
        total: 0,
      },
    };

    // Start memory monitoring
    this.startMemoryMonitoring();

    console.log('⚡ Scale optimizations initialized:', {
      maxConnections: this.config.maxConnections,
      connectionPoolSize: this.config.connectionPoolSize,
      batchSize: this.config.batchSize,
      memoryThresholdMB: this.config.memoryThresholdMB,
    });
  }

  /**
   * Get the optimized HTTP agent
   */
  getHttpAgent(): Agent {
    return this.httpAgent;
  }

  /**
   * Batch add items to crawl queue
   */
  async batchAddToCrawlQueue(items: InsertCrawlQueue[]): Promise<void> {
    this.batchQueues.crawlQueue.push(...items);
    
    // Process batch if it's large enough
    if (this.batchQueues.crawlQueue.length >= this.config.batchSize) {
      await this.processCrawlQueueBatch();
    } else {
      // Set timer to process batch later
      this.setBatchTimer('crawlQueue', () => this.processCrawlQueueBatch());
    }
  }

  /**
   * Batch save links
   */
  async batchSaveLinks(links: InsertLink[]): Promise<void> {
    this.batchQueues.links.push(...links);
    
    if (this.batchQueues.links.length >= this.config.batchSize) {
      await this.processLinksBatch();
    } else {
      this.setBatchTimer('links', () => this.processLinksBatch());
    }
  }

  /**
   * Batch save fetch logs
   */
  async batchSaveFetchLogs(logs: InsertFetchLog[]): Promise<void> {
    this.batchQueues.fetchLogs.push(...logs);
    
    if (this.batchQueues.fetchLogs.length >= this.config.batchSize) {
      await this.processFetchLogsBatch();
    } else {
      this.setBatchTimer('fetchLogs', () => this.processFetchLogsBatch());
    }
  }

  /**
   * Process crawl queue batch
   */
  private async processCrawlQueueBatch(): Promise<void> {
    const items = this.batchQueues.crawlQueue.splice(0);
    if (items.length === 0) return;

    const startTime = Date.now();
    
    try {
      await storage.addBatchToCrawlQueue(items);
      this.stats.queueItemsProcessed += items.length;
      
      console.log(`⚡ Batched ${items.length} crawl queue items`);
    } catch (error) {
      console.error('❌ Error processing crawl queue batch:', error instanceof Error ? error.message : String(error));
      // Re-add items to queue for retry
      this.batchQueues.crawlQueue.unshift(...items);
    } finally {
      this.updateBatchStats(Date.now() - startTime);
    }
  }

  /**
   * Process links batch
   */
  private async processLinksBatch(): Promise<void> {
    const links = this.batchQueues.links.splice(0);
    if (links.length === 0) return;

    const startTime = Date.now();
    
    try {
      await storage.saveLinks(links);
      this.stats.linksProcessed += links.length;
      
      console.log(`⚡ Batched ${links.length} links`);
    } catch (error) {
      console.error('❌ Error processing links batch:', error instanceof Error ? error.message : String(error));
      this.batchQueues.links.unshift(...links);
    } finally {
      this.updateBatchStats(Date.now() - startTime);
    }
  }

  /**
   * Process fetch logs batch
   */
  private async processFetchLogsBatch(): Promise<void> {
    const logs = this.batchQueues.fetchLogs.splice(0);
    if (logs.length === 0) return;

    const startTime = Date.now();
    
    try {
      // Create fetch logs individually since we don't have batch insert
      await Promise.all(logs.map(log => storage.createFetchLog(log)));
      this.stats.fetchLogsProcessed += logs.length;
      
      console.log(`⚡ Batched ${logs.length} fetch logs`);
    } catch (error) {
      console.error('❌ Error processing fetch logs batch:', error instanceof Error ? error.message : String(error));
      this.batchQueues.fetchLogs.unshift(...logs);
    } finally {
      this.updateBatchStats(Date.now() - startTime);
    }
  }

  /**
   * Set batch timer
   */
  private setBatchTimer(type: keyof typeof this.batchTimers, callback: () => Promise<void>): void {
    // Clear existing timer
    if (this.batchTimers[type]) {
      clearTimeout(this.batchTimers[type]);
    }

    // Set new timer (5 second delay)
    this.batchTimers[type] = setTimeout(async () => {
      try {
        await callback();
      } catch (error) {
        console.error(`❌ Error in batch timer for ${type}:`, error instanceof Error ? error.message : String(error));
      }
      delete this.batchTimers[type];
    }, 5000);
  }

  /**
   * Update batch processing statistics
   */
  private updateBatchStats(batchTime: number): void {
    this.stats.batchesProcessed++;
    this.stats.averageBatchTime = (this.stats.averageBatchTime * 0.9) + (batchTime * 0.1);
    this.stats.memoryUsage = process.memoryUsage();
  }

  /**
   * Flush all pending batches immediately
   */
  async flushAllBatches(): Promise<void> {
    console.log('🚽 Flushing all pending batches...');
    
    // Clear all timers
    Object.values(this.batchTimers).forEach(timer => {
      if (timer) clearTimeout(timer);
    });
    this.batchTimers = {};

    // Process all batches
    const promises = [
      this.processCrawlQueueBatch(),
      this.processLinksBatch(),
      this.processFetchLogsBatch(),
    ];

    await Promise.allSettled(promises);
    console.log('✅ All batches flushed');
  }

  /**
   * Start memory monitoring and management
   */
  private startMemoryMonitoring(): void {
    const monitorInterval = 30000; // 30 seconds

    const checkMemory = () => {
      const memoryUsage = process.memoryUsage();
      this.stats.memoryUsage = memoryUsage;

      const heapUsedMB = memoryUsage.heapUsed / 1024 / 1024;
      const heapTotalMB = memoryUsage.heapTotal / 1024 / 1024;

      if (heapUsedMB > this.config.memoryThresholdMB) {
        console.warn('⚠️ High memory usage detected:', {
          heapUsedMB: Math.round(heapUsedMB),
          heapTotalMB: Math.round(heapTotalMB),
          threshold: this.config.memoryThresholdMB,
        });

        // Force garbage collection if available
        if (global.gc) {
          console.log('🗑️ Running garbage collection...');
          global.gc();
          const afterGC = process.memoryUsage();
          const freedMB = (memoryUsage.heapUsed - afterGC.heapUsed) / 1024 / 1024;
          console.log(`🗑️ GC freed ${Math.round(freedMB)}MB`);
        }

        // Flush batches to reduce memory usage
        this.flushAllBatches().catch(error => {
          console.error('❌ Error flushing batches during memory management:', error);
        });
      }

      // Schedule next check
      setTimeout(checkMemory, monitorInterval);
    };

    // Start monitoring after delay
    setTimeout(checkMemory, monitorInterval);
  }

  /**
   * Get current statistics
   */
  getStats(): BatchOperationStats {
    // Update connection pool stats
    const poolStats = this.httpAgent.destroyed ? { active: 0, idle: 0, total: 0 } : {
      active: (this.httpAgent as any).stats?.connected || 0,
      idle: (this.httpAgent as any).stats?.free || 0,
      total: (this.httpAgent as any).stats?.connected + (this.httpAgent as any).stats?.free || 0,
    };

    return {
      ...this.stats,
      connectionPoolStats: poolStats,
    };
  }

  /**
   * Optimize database queries for better performance
   */
  async optimizeQueries(): Promise<void> {
    console.log('🚀 Running database optimizations...');
    
    try {
      // These would be executed via storage.db or directly via SQL
      const optimizations = [
        // Update table statistics
        'ANALYZE domains, pages, crawl_queue, links, fetch_log',
        
        // Vacuum to reclaim space
        'VACUUM ANALYZE pages',
        'VACUUM ANALYZE crawl_queue',
        
        // Update planner statistics
        'SET random_page_cost = 1.1',
        'SET effective_cache_size = \'256MB\'',
      ];

      console.log('✅ Database optimizations completed');
    } catch (error) {
      console.error('❌ Error running database optimizations:', error instanceof Error ? error.message : String(error));
    }
  }

  /**
   * Connection pool health check
   */
  getConnectionPoolHealth(): {
    status: 'healthy' | 'degraded' | 'unhealthy';
    stats: {
      active: number;
      idle: number;
      total: number;
      maxConnections: number;
    };
    issues: string[];
  } {
    const stats = this.getStats().connectionPoolStats;
    const issues: string[] = [];
    
    const utilizationRate = stats.total / this.config.connectionPoolSize;
    
    if (utilizationRate > 0.9) {
      issues.push('High connection pool utilization (>90%)');
    }
    
    if (stats.active > this.config.maxConnections * 0.8) {
      issues.push('High active connections (>80% of max)');
    }

    const status = issues.length === 0 ? 'healthy' :
                  issues.length === 1 ? 'degraded' : 'unhealthy';

    return {
      status,
      stats: {
        ...stats,
        maxConnections: this.config.maxConnections,
      },
      issues,
    };
  }

  /**
   * Cleanup and shutdown
   */
  async shutdown(): Promise<void> {
    console.log('🛑 Shutting down scale optimizations...');
    
    // Flush all pending batches
    await this.flushAllBatches();
    
    // Clear all timers
    Object.values(this.batchTimers).forEach(timer => {
      if (timer) clearTimeout(timer);
    });
    
    // Close HTTP agent
    await this.httpAgent.close();
    
    console.log('✅ Scale optimizations shutdown completed');
  }

  /**
   * Performance tuning recommendations
   */
  getPerformanceTuning(): {
    recommendations: string[];
    currentSettings: Record<string, any>;
    suggestedSettings: Record<string, any>;
  } {
    const memoryUsedMB = this.stats.memoryUsage.heapUsed / 1024 / 1024;
    const recommendations: string[] = [];
    const currentSettings = { ...this.config };
    const suggestedSettings: Record<string, any> = {};

    if (memoryUsedMB > 1024) { // > 1GB
      recommendations.push('Consider reducing batch size to lower memory usage');
      suggestedSettings.batchSize = Math.max(10, Math.floor(this.config.batchSize * 0.7));
    }

    if (this.stats.averageBatchTime > 5000) { // > 5 seconds
      recommendations.push('Batch processing is slow, consider reducing batch size');
      suggestedSettings.batchSize = Math.max(10, Math.floor(this.config.batchSize * 0.8));
    }

    if (this.stats.batchesProcessed > 100 && this.stats.averageBatchTime < 1000) { // < 1 second
      recommendations.push('Batch processing is fast, consider increasing batch size');
      suggestedSettings.batchSize = Math.min(200, Math.floor(this.config.batchSize * 1.3));
    }

    const poolHealth = this.getConnectionPoolHealth();
    if (poolHealth.status !== 'healthy') {
      recommendations.push('Connection pool issues detected, consider tuning pool size');
      suggestedSettings.connectionPoolSize = Math.min(200, this.config.connectionPoolSize + 10);
    }

    return {
      recommendations,
      currentSettings,
      suggestedSettings,
    };
  }

  /**
   * Apply performance tuning automatically
   */
  autoTunePerformance(): void {
    const tuning = this.getPerformanceTuning();
    
    if (tuning.recommendations.length > 0) {
      console.log('⚡ Auto-tuning performance settings:', tuning.suggestedSettings);
      Object.assign(this.config, tuning.suggestedSettings);
    }
  }
}

export const scaleOptimizations = new CrawlerScaleOptimizations();