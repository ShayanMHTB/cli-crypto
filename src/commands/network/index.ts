import { Command } from 'commander';
import chalk from 'chalk';
import { NetworkManager } from '@/core/network/manager';
import Logger from '@/core/logger/logger';
import type { NetworkOptions, NetworkConfig } from '@/types/network';

export class NetworkCommands {
  private networkManager: NetworkManager;
  private network: Command;

  constructor(program: Command) {
    this.networkManager = new NetworkManager();
    this.network = program.command('network');
    this.registerCommands();
  }

  private registerCommands(): void {
    this.registerList();
    this.registerAdd();
    this.registerSwitch();
    this.registerStatus();
    this.registerRemove();
    this.registerTest();
    this.registerInfo();
    this.registerBenchmark();
    this.registerExport();
    this.registerImport();
    this.registerMonitor();
    this.registerValidate();
    this.registerSync();
    this.registerCleanup();
  }

  private registerList(): void {
    this.network
      .command('list')
      .description('List all configured networks')
      .option('--active', 'Show only active networks')
      .option('--testnet', 'Show only testnets')
      .option('--mainnet', 'Show only mainnets')
      .action(async (options) => {
        try {
          const networks = await this.networkManager.listNetworks(options);
          console.log(chalk.cyan('Configured Networks:'));
          networks.forEach((network) => {
            const status = network.isActive
              ? chalk.green('active')
              : chalk.gray('inactive');
            const type = network.isTestnet
              ? chalk.yellow('testnet')
              : chalk.blue('mainnet');
            console.log(chalk.white(`\n${network.name} [${status}] [${type}]`));
            console.log(chalk.gray(`  RPC: ${network.rpcUrl}`));
            console.log(chalk.gray(`  Chain ID: ${network.chainId}`));
            console.log(chalk.gray(`  Currency: ${network.currency}`));
          });
        } catch (error) {
          Logger.error('Failed to list networks', error as Error);
          console.error(
            chalk.red('Error listing networks:'),
            (error as Error).message,
          );
          process.exit(1);
        }
      });
  }

  private registerAdd(): void {
    this.network
      .command('add')
      .description('Add a new network configuration')
      .requiredOption('--name <name>', 'Network name')
      .requiredOption('--rpc-url <url>', 'RPC endpoint URL')
      .option('--chain-id <id>', 'Chain ID')
      .option('--currency <symbol>', 'Native currency symbol')
      .option('--explorer <url>', 'Block explorer URL')
      .option('--testnet', 'Mark as testnet')
      .action(async (options: NetworkOptions) => {
        try {
          const network = await this.networkManager.addNetwork(options);
          Logger.info('Network added', { name: network.name });
          console.log(chalk.green('Network added successfully:'));
          console.log(chalk.cyan(`Name: ${network.name}`));
          console.log(chalk.cyan(`RPC URL: ${network.rpcUrl}`));
          console.log(chalk.cyan(`Chain ID: ${network.chainId}`));
        } catch (error) {
          Logger.error('Failed to add network', error as Error);
          console.error(
            chalk.red('Error adding network:'),
            (error as Error).message,
          );
          process.exit(1);
        }
      });
  }

  private registerSwitch(): void {
    this.network
      .command('switch')
      .description('Switch active network')
      .requiredOption('--name <name>', 'Network name to switch to')
      .action(async (options) => {
        try {
          const result = await this.networkManager.switchNetwork(options.name);
          Logger.info('Network switched', { name: result.newNetwork });
          console.log(
            chalk.green(
              `Successfully switched to network: ${result.newNetwork}`,
            ),
          );
        } catch (error) {
          Logger.error('Failed to switch network', error as Error);
          console.error(
            chalk.red('Error switching network:'),
            (error as Error).message,
          );
          process.exit(1);
        }
      });
  }

  private registerStatus(): void {
    this.network
      .command('status')
      .description('Check network status')
      .option('--name <name>', 'Network name (defaults to active network)')
      .option('--full', 'Show detailed status')
      .action(async (options) => {
        try {
          const status = await this.networkManager.getNetworkStatus(
            options.name,
          );
          console.log(chalk.cyan(`Network Status: ${status.name}`));
          console.log(
            chalk.white(
              `Connection: ${
                status.isConnected ? chalk.green('✓') : chalk.red('✗')
              }`,
            ),
          );
          console.log(chalk.white(`Latest Block: ${status.blockNumber}`));
          console.log(chalk.white(`Gas Price: ${status.gasPrice} gwei`));

          if (options.full) {
            console.log(chalk.white(`Peers: ${status.peers}`));
            console.log(chalk.white(`Chain ID: ${status.chainId}`));
            console.log(
              chalk.white(
                `Sync Status: ${status.isSyncing ? 'Syncing' : 'Synced'}`,
              ),
            );
          }
        } catch (error) {
          Logger.error('Failed to get network status', error as Error);
          console.error(
            chalk.red('Error getting network status:'),
            (error as Error).message,
          );
          process.exit(1);
        }
      });
  }

  private registerRemove(): void {
    this.network
      .command('remove')
      .description('Remove a network configuration')
      .requiredOption('--name <name>', 'Network name')
      .option('--force', 'Skip confirmation')
      .action(async (options) => {
        try {
          if (!options.force) {
            const confirmed = await this.networkManager.confirmAction(
              `Are you sure you want to remove network '${options.name}'?`,
            );
            if (!confirmed) {
              console.log(chalk.yellow('Operation cancelled.'));
              return;
            }
          }

          await this.networkManager.removeNetwork(options.name);
          Logger.info('Network removed', { name: options.name });
          console.log(
            chalk.green(`Successfully removed network: ${options.name}`),
          );
        } catch (error) {
          Logger.error('Failed to remove network', error as Error);
          console.error(
            chalk.red('Error removing network:'),
            (error as Error).message,
          );
          process.exit(1);
        }
      });
  }

  private registerTest(): void {
    this.network
      .command('test')
      .description('Test network connection')
      .option('--name <name>', 'Network name (defaults to active network)')
      .option('--timeout <ms>', 'Connection timeout in milliseconds', '5000')
      .action(async (options) => {
        try {
          const result = await this.networkManager.testNetwork(options);
          if (result.success) {
            console.log(chalk.green('Network test successful'));
            console.log(chalk.white(`Latency: ${result.latency}ms`));
            console.log(chalk.white(`Chain ID: ${result.chainId}`));
          } else {
            console.log(chalk.red('Network test failed'));
            console.log(chalk.white(`Error: ${result.error}`));
          }
        } catch (error) {
          Logger.error('Failed to test network', error as Error);
          console.error(
            chalk.red('Error testing network:'),
            (error as Error).message,
          );
          process.exit(1);
        }
      });
  }

  private registerInfo(): void {
    this.network
      .command('info')
      .description('Get detailed network information')
      .option('--name <name>', 'Network name (defaults to active network)')
      .action(async (options) => {
        try {
          const info = await this.networkManager.getNetworkInfo(options.name);
          console.log(chalk.cyan(`Network Information: ${info.name}`));
          console.log(chalk.white('\nBasic Information:'));
          console.log(chalk.gray(`  Chain ID: ${info.chainId}`));
          console.log(chalk.gray(`  Currency: ${info.currency}`));
          console.log(
            chalk.gray(
              `  Network Type: ${info.isTestnet ? 'Testnet' : 'Mainnet'}`,
            ),
          );

          console.log(chalk.white('\nConnection Details:'));
          console.log(chalk.gray(`  RPC URL: ${info.rpcUrl}`));
          console.log(chalk.gray(`  Explorer: ${info.explorer}`));

          console.log(chalk.white('\nNetwork Stats:'));
          console.log(chalk.gray(`  Current Block: ${info.blockNumber}`));
          console.log(chalk.gray(`  Gas Price: ${info.gasPrice} gwei`));
          console.log(chalk.gray(`  Peers: ${info.peers}`));
        } catch (error) {
          Logger.error('Failed to get network info', error as Error);
          console.error(
            chalk.red('Error getting network info:'),
            (error as Error).message,
          );
          process.exit(1);
        }
      });
  }

  private registerBenchmark(): void {
    this.network
      .command('benchmark')
      .description('Benchmark network performance')
      .option('--name <name>', 'Network name (defaults to active network)')
      .option('--duration <seconds>', 'Test duration in seconds', '30')
      .option('--detailed', 'Show detailed metrics')
      .action(async (options) => {
        try {
          console.log(chalk.cyan('Running network benchmark...'));
          const result = await this.networkManager.benchmarkNetwork(
            options.name,
            parseInt(options.duration),
          );

          console.log(chalk.green('\nBenchmark Results:'));
          console.log(
            chalk.white(`Requests/sec: ${result.requestsPerSecond.toFixed(2)}`),
          );
          console.log(
            chalk.white(
              `Average Latency: ${result.averageLatency.toFixed(2)}ms`,
            ),
          );

          if (options.detailed) {
            console.log(chalk.white(`Min Latency: ${result.minLatency}ms`));
            console.log(chalk.white(`Max Latency: ${result.maxLatency}ms`));
            console.log(
              chalk.white(
                `Error Rate: ${(result.errorRate * 100).toFixed(2)}%`,
              ),
            );
          }
        } catch (error) {
          Logger.error('Benchmark failed', error as Error);
          console.error(
            chalk.red('Error during benchmark:'),
            (error as Error).message,
          );
          process.exit(1);
        }
      });
  }

  private registerExport(): void {
    this.network
      .command('export')
      .description('Export network configurations')
      .requiredOption('--file <path>', 'Export file path')
      .action(async (options) => {
        try {
          await this.networkManager.exportNetworks(options.file);
          console.log(chalk.green(`Networks exported to ${options.file}`));
        } catch (error) {
          Logger.error('Export failed', error as Error);
          console.error(
            chalk.red('Error exporting networks:'),
            (error as Error).message,
          );
          process.exit(1);
        }
      });
  }

  private registerImport(): void {
    this.network
      .command('import')
      .description('Import network configurations')
      .requiredOption('--file <path>', 'Import file path')
      .option('--overwrite', 'Overwrite existing networks')
      .action(async (options) => {
        try {
          const imported = await this.networkManager.importNetworks(
            options.file,
            options.overwrite,
          );
          console.log(
            chalk.green(`Successfully imported ${imported} networks`),
          );
        } catch (error) {
          Logger.error('Import failed', error as Error);
          console.error(
            chalk.red('Error importing networks:'),
            (error as Error).message,
          );
          process.exit(1);
        }
      });
  }

  private registerMonitor(): void {
    this.network
      .command('monitor')
      .description('Start network monitoring')
      .option('--name <name>', 'Network name (defaults to active network)')
      .option('--interval <seconds>', 'Monitoring interval in seconds', '60')
      .option('--stop', 'Stop monitoring')
      .action(async (options) => {
        try {
          if (options.stop) {
            await this.networkManager.stopNetworkMonitoring();
            console.log(chalk.green('Network monitoring stopped'));
            return;
          }

          await this.networkManager.startNetworkMonitoring(
            options.name,
            parseInt(options.interval) * 1000,
          );

          this.networkManager.on('networkStatus', (status) => {
            console.log(
              chalk.cyan(
                `\nNetwork Status Update (${new Date().toISOString()}):`,
              ),
            );
            console.log(chalk.white(`Block: ${status.blockNumber}`));
            console.log(chalk.white(`Gas Price: ${status.gasPrice} gwei`));
          });

          console.log(chalk.green('Network monitoring started'));
        } catch (error) {
          Logger.error('Monitor failed', error as Error);
          console.error(
            chalk.red('Error during monitoring:'),
            (error as Error).message,
          );
          process.exit(1);
        }
      });
  }

  private registerValidate(): void {
    this.network
      .command('validate')
      .description('Validate network configuration')
      .option('--name <name>', 'Network name (defaults to active network)')
      .option('--all', 'Validate all networks')
      .action(async (options) => {
        try {
          if (options.all) {
            const networks = await this.networkManager.listNetworks();
            for (const network of networks) {
              await this.validateSingleNetwork(network);
            }
          } else {
            const networks = await this.networkManager.listNetworks();
            const network = networks.find((n) => n.name === options.name);
            if (!network) {
              throw new Error(`Network '${options.name}' not found`);
            }
            await this.validateSingleNetwork(network);
          }
        } catch (error) {
          Logger.error('Validation failed', error as Error);
          console.error(
            chalk.red('Error during validation:'),
            (error as Error).message,
          );
          process.exit(1);
        }
      });
  }

  private async validateSingleNetwork(network: NetworkConfig): Promise<void> {
    console.log(chalk.cyan(`\nValidating network: ${network.name}`));
    const result = await this.networkManager.validateNetwork(network);

    if (result.isValid) {
      console.log(chalk.green('✓ Network is valid'));
    } else {
      console.log(chalk.red('✗ Network validation failed'));
    }

    if (result.errors.length > 0) {
      console.log(chalk.red('\nErrors:'));
      result.errors.forEach((error) => console.log(chalk.red(`  • ${error}`)));
    }

    if (result.warnings.length > 0) {
      console.log(chalk.yellow('\nWarnings:'));
      result.warnings.forEach((warning) =>
        console.log(chalk.yellow(`  • ${warning}`)),
      );
    }
  }

  private registerSync(): void {
    this.network
      .command('sync')
      .description('Synchronize with network')
      .option('--name <name>', 'Network name (defaults to active network)')
      .option('--all', 'Sync all networks')
      .action(async (options) => {
        try {
          if (options.all) {
            const results = await this.networkManager.syncAllNetworks();
            console.log(chalk.cyan('\nSync Results:'));
            results.forEach((result) => {
              const status =
                result.status === 'synchronized'
                  ? chalk.green('✓')
                  : chalk.red('✗');
              console.log(`${status} ${result.name}: ${result.status}`);
            });
          } else {
            const result = await this.networkManager.syncNetwork(options.name);
            const status =
              result.status === 'synchronized'
                ? chalk.green('synchronized')
                : chalk.red('failed');
            console.log(
              chalk.cyan(`\nSync Status for ${result.name}:`),
              status,
            );
          }
        } catch (error) {
          Logger.error('Sync failed', error as Error);
          console.error(
            chalk.red('Error during sync:'),
            (error as Error).message,
          );
          process.exit(1);
        }
      });
  }

  private registerCleanup(): void {
    this.network
      .command('cleanup')
      .description('Clean up network configurations')
      .option(
        '--inactive <days>',
        'Remove networks inactive for specified days',
      )
      .option(
        '--unvalidated <days>',
        'Remove networks not validated for specified days',
      )
      .option('--force', 'Skip confirmation')
      .action(async (options) => {
        try {
          if (!options.force) {
            const confirmed = await this.networkManager.confirmAction(
              'Are you sure you want to clean up networks?',
            );
            if (!confirmed) {
              console.log(chalk.yellow('Operation cancelled.'));
              return;
            }
          }

          const removed = await this.networkManager.cleanup({
            inactive: options.inactive ? parseInt(options.inactive) : undefined,
            unvalidated: options.unvalidated
              ? parseInt(options.unvalidated)
              : undefined,
          });

          if (removed.length > 0) {
            console.log(chalk.green('\nRemoved networks:'));
            removed.forEach((name) => console.log(chalk.white(`  • ${name}`)));
          } else {
            console.log(chalk.green('No networks needed cleanup'));
          }
        } catch (error) {
          Logger.error('Cleanup failed', error as Error);
          console.error(
            chalk.red('Error during cleanup:'),
            (error as Error).message,
          );
          process.exit(1);
        }
      });
  }
}
