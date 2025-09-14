#!/usr/bin/env tsx

/**
 * CLI script to run database seeding for YHT search engine
 * This script populates the database with real content from popular websites
 */

import { DatabaseSeeder, quickSeed, seedByCategory, type SeedingResult } from './database-seeding';
import { getCategorySummary, SEED_WEBSITES } from './seed-websites';

// Parse command line arguments
const args = process.argv.slice(2);
const command = args[0] || 'quick';

async function main() {
  console.log('🚀 YHT Search Engine Database Seeding');
  console.log('=====================================\n');

  try {
    let result: SeedingResult;

    switch (command) {
      case 'quick':
        console.log('🏃‍♂️ Running quick seed (high priority websites only)...');
        const limitCount = args[1] ? parseInt(args[1]) : 10;
        result = await quickSeed(true, limitCount);
        break;

      case 'full':
        console.log('🌍 Running full seed (all websites)...');
        const seeder = new DatabaseSeeder({
          batchSize: 3,
          delayBetweenRequests: 2000,
          maxRetries: 3,
          timeoutMs: 30000,
          respectRobotsTxt: true,
          skipExisting: true
        });
        result = await seeder.seedDatabase();
        break;

      case 'category':
        const categories = args.slice(1);
        if (categories.length === 0) {
          console.error('❌ Please specify categories: shopping, companies, news, saas, cloud, web3');
          process.exit(1);
        }
        console.log(`🎯 Seeding categories: ${categories.join(', ')}`);
        result = await seedByCategory(categories);
        break;

      case 'stats':
        const summary = getCategorySummary();
        console.log('📊 Seed website statistics:');
        console.log(`Total websites: ${summary.total}`);
        console.log('Category breakdown:');
        Object.entries(summary.categories).forEach(([category, count]) => {
          console.log(`  ${category}: ${count} websites`);
        });
        return;

      case 'list':
        console.log('📋 Available seed websites:');
        SEED_WEBSITES.forEach(site => {
          console.log(`  ${site.url} (${site.category}, priority: ${site.priority})`);
        });
        return;

      default:
        console.log('Usage:');
        console.log('  npm run seed quick [count]     - Seed top priority websites (default: 10)');
        console.log('  npm run seed full              - Seed all websites');
        console.log('  npm run seed category [cats]   - Seed specific categories');
        console.log('  npm run seed stats             - Show seed statistics');
        console.log('  npm run seed list              - List all seed websites');
        console.log('');
        console.log('Examples:');
        console.log('  npm run seed quick 5           - Seed top 5 websites');
        console.log('  npm run seed category shopping news - Seed shopping and news sites');
        return;
    }

    // Display results
    console.log('\n🎉 Seeding completed!');
    console.log('====================');
    console.log(`✅ Success: ${result.success}`);
    console.log(`📊 Processed: ${result.progress.processed}/${result.progress.total}`);
    console.log(`✅ Successful: ${result.progress.successful}`);
    console.log(`❌ Failed: ${result.progress.failed}`);
    console.log(`⏭️  Skipped: ${result.progress.skipped}`);
    console.log(`🏢 Domains created: ${result.domainsCreated}`);
    console.log(`📄 Pages created: ${result.pagesCreated}`);
    console.log(`⏱️  Total time: ${Math.round(result.totalProcessingTime / 1000 / 60)} minutes`);
    console.log(`⚡ Avg time per site: ${Math.round(result.avgProcessingTimePerSite / 1000)} seconds`);

    if (result.progress.errors.length > 0) {
      console.log('\n❌ Errors:');
      result.progress.errors.slice(0, 5).forEach(error => {
        console.log(`  ${error.url}: ${error.error}`);
      });
      if (result.progress.errors.length > 5) {
        console.log(`  ... and ${result.progress.errors.length - 5} more errors`);
      }
    }

    console.log('\n📋 Category Results:');
    Object.entries(result.progress.categoryStats).forEach(([category, stats]) => {
      console.log(`  ${category}: ${stats.successful}/${stats.processed} successful`);
    });

    process.exit(result.success ? 0 : 1);

  } catch (error) {
    console.error('💥 Seeding failed with error:', error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n⏹️  Seeding interrupted by user');
  process.exit(1);
});

process.on('SIGTERM', () => {
  console.log('\n⏹️  Seeding terminated');
  process.exit(1);
});

main().catch(error => {
  console.error('💥 Fatal error:', error);
  process.exit(1);
});