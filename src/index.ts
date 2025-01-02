#!/usr/bin/env node
import CLI from '@/core/cli';
import Logger from '@/core/logger/logger';

import { config } from 'dotenv';

async function main() {
  try {
    // Load environment variables
    config();

    // Initialize and run CLI
    const cli = new CLI();
    await cli.run(process.argv);
  } catch (error) {
    Logger.error('Fatal error occurred', error as Error);
    process.exit(1);
  }
}

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  Logger.error('Uncaught Exception', error);
  process.exit(1);
});

process.on('unhandledRejection', (error) => {
  Logger.error('Unhandled Rejection', error as Error);
  process.exit(1);
});

main();
