import Logger from '@/core/logger/logger';
import chalk from 'chalk';

import { WalletManager } from '@/core/wallet/manager';
import type {
  WalletBalanceOptions,
  WalletDeleteOptions,
  WalletExportOptions,
  WalletImportOptions,
  WalletListOptions,
  WalletOptions,
} from '@/types/wallet';
import { Command } from 'commander';

export class WalletCommands {
  private walletManager: WalletManager;
  private wallet: Command;

  constructor(program: Command) {
    this.walletManager = new WalletManager();
    this.wallet = program.command('wallet');
    this.registerCommands();
  }

  private registerCommands(): void {
    this.registerCreate();
    this.registerList();
    this.registerExport();
    this.registerImport();
    this.registerDelete();
    this.registerBalance();
  }

  private registerCreate(): void {
    this.wallet
      .command('create')
      .description('Create one or multiple wallets')
      .requiredOption(
        '--name <name>',
        'Wallet name (for multiple wallets, this will be used as base name)',
      )
      .requiredOption('--network <network>', 'Blockchain network')
      .option('--security [security]', 'Encryption level (strong/default)')
      .option('--mnemonic', 'Generate with mnemonic phrase')
      .option('--multiple [number]', 'Number of wallets to create (default: 1)')
      .option('--output [format]', 'Output format (json/csv)')
      .option('--path [path]', 'Custom save path')
      .option('--qr [format]', 'Generate QR code (png/svg/terminal)')
      .option('--qr-path [path]', 'Custom QR code save path')
      .action(async (options: WalletOptions) => {
        try {
          const numWallets = options.multiple
            ? parseInt(options.multiple as string)
            : 1;

          const confirmed = await this.walletManager.confirmAction(
            numWallets === 1
              ? `Creating wallet "${options.name}" on ${options.network} network. Continue?`
              : `Creating ${numWallets} wallets with base name "${options.name}" on ${options.network} network. Continue?`,
          );

          if (!confirmed) {
            console.log(chalk.yellow('Operation cancelled.'));
            return;
          }

          if (numWallets === 1) {
            const wallet = await this.walletManager.createWallet(options);
            Logger.info('Wallet created successfully', {
              address: wallet.address,
            });

            const divider = chalk.gray('─'.repeat(50));
            const timestamp = new Date().toISOString();

            console.log('\n' + divider);
            console.log(chalk.bold.green('✓ Wallet Created Successfully'));
            console.log(divider + '\n');

            // Print wallet details with structured formatting
            console.log(chalk.cyan('➤ Wallet Details:'));
            console.log(
              chalk.yellow('  Name:       ') + chalk.white(wallet.name),
            );
            console.log(
              chalk.yellow('  Network:    ') + chalk.white(wallet.network),
            );
            console.log(
              chalk.yellow('  Address:    ') + chalk.white(wallet.address),
            );
            if (wallet.mnemonic) {
              console.log(
                chalk.yellow('  Mnemonic:    ') + chalk.white(wallet.mnemonic),
              );
            }
            console.log(
              chalk.yellow('  Created At: ') + chalk.white(timestamp),
            );

            // Print private key with warning styling
            console.log('\n' + chalk.red('➤ Security Sensitive Information:'));
            console.log(
              chalk.red('  Private Key: ') + chalk.dim(wallet.privateKey),
            );

            // If there's a QR code to display in terminal, show it last
            if (wallet.qrString) {
              console.log('\n' + chalk.cyan('➤ Wallet QR Code:'));
              console.log(wallet.qrString);
            } else if (wallet.qrPath) {
              console.log(
                '\n' + chalk.cyan(`QR Code saved to: ${wallet.qrPath}`),
              );
            }

            console.log('\n' + divider);
          } else {
            console.log(chalk.yellow(`Creating ${numWallets} wallets...`));
            const wallets = await Promise.all(
              Array.from({ length: numWallets }, (_, i) =>
                this.walletManager.createWallet({
                  ...options,
                  name: `${options.name}-${i + 1}`,
                }),
              ),
            );

            Logger.info('Multiple wallets created', { count: wallets.length });

            const divider = chalk.gray('─'.repeat(50));
            const timestamp = new Date().toISOString();

            console.log('\n' + divider);
            console.log(
              chalk.bold.green(
                `✓ ${wallets.length} Wallets Created Successfully`,
              ),
            );
            console.log(divider + '\n');

            wallets.forEach((wallet, index) => {
              console.log(chalk.cyan(`➤ Wallet ${index + 1} Details:`));
              console.log(
                chalk.yellow('  Name:       ') + chalk.white(wallet.name),
              );
              console.log(
                chalk.yellow('  Network:    ') + chalk.white(wallet.network),
              );
              console.log(
                chalk.yellow('  Address:    ') + chalk.white(wallet.address),
              );
              if (wallet.mnemonic) {
                console.log(
                  chalk.yellow('  Mnemonic:    ') +
                    chalk.white(wallet.mnemonic),
                );
              }
              console.log(
                chalk.yellow('  Created At: ') + chalk.white(timestamp),
              );

              // Print private key with warning styling
              console.log(
                '\n' + chalk.red('➤ Security Sensitive Information:'),
              );
              console.log(
                chalk.red('  Private Key: ') + chalk.dim(wallet.privateKey),
              );

              // If there's a QR code to display in terminal, show it last
              if (wallet.qrString) {
                console.log('\n' + chalk.cyan('➤ Wallet QR Code:'));
                console.log(wallet.qrString);
              } else if (wallet.qrPath) {
                console.log(
                  '\n' + chalk.cyan(`QR Code saved to: ${wallet.qrPath}`),
                );
              }

              // Add a divider between wallets except for the last one
              if (index < wallets.length - 1) {
                console.log('\n' + divider + '\n');
              }
            });

            // Add final divider
            console.log('\n' + divider);
          }
        } catch (error) {
          Logger.error('Failed to create wallet(s)', error as Error);
          console.error(
            chalk.red('Error creating wallet(s):'),
            (error as Error).message,
          );
          process.exit(1);
        }
      });
  }

  private registerList(): void {
    this.wallet
      .command('list')
      .description('List wallets based on criteria')
      .option('--network <network>', 'Filter by network')
      .option('--name <name>', 'Filter by name')
      .option('--date <date>', 'Filter by creation date')
      .option('--hash <hash>', 'Filter by address hash')
      .action(async (options: WalletListOptions) => {
        try {
          const wallets = await this.walletManager.listWallets(options);

          if (wallets.length === 0) {
            console.log(
              chalk.yellow('No wallets found matching the criteria.'),
            );
            return;
          }

          Logger.info('Listed wallets', { count: wallets.length });
          console.log(chalk.green(`Found ${wallets.length} wallets:`));

          wallets.forEach((wallet, index) => {
            console.log(chalk.white(`\n${index + 1}. ${wallet.name}`));
            console.log(chalk.gray(`   Network: ${wallet.network}`));
            console.log(chalk.gray(`   Address: ${wallet.address}`));
            console.log(
              chalk.gray(
                `   Created: ${new Date(wallet.createdAt).toLocaleString()}`,
              ),
            );
          });
        } catch (error) {
          Logger.error('Failed to list wallets', error as Error);
          console.error(
            chalk.red('Error listing wallets:'),
            (error as Error).message,
          );
          process.exit(1);
        }
      });
  }

  private registerExport(): void {
    this.wallet
      .command('export')
      .description('Export wallet(s) to file')
      .requiredOption(
        '--name <name>',
        'Wallet name or pattern (supports wildcards *)',
      )
      .requiredOption('--format <format>', 'Export format (json/csv)')
      .option('--path <path>', 'Export file path')
      .option('--network <network>', 'Filter by network')
      .action(async (options: WalletExportOptions) => {
        try {
          const result = await this.walletManager.exportWallets(options);
          Logger.info('Wallets exported', {
            path: result.path,
            count: result.count,
          });
          console.log(
            chalk.green(`Successfully exported ${result.count} wallet(s):`),
          );
          console.log(chalk.cyan(`Path: ${result.path}`));
        } catch (error) {
          Logger.error('Failed to export wallets', error as Error);
          console.error(
            chalk.red('Error exporting wallets:'),
            (error as Error).message,
          );
          process.exit(1);
        }
      });
  }

  private registerImport(): void {
    this.wallet
      .command('import')
      .description('Import wallet(s) from file')
      .requiredOption('--file <path>', 'Import file path (json/csv)')
      .requiredOption('--network <network>', 'Target network')
      .option('--overwrite', 'Overwrite existing wallets')
      .action(async (options: WalletImportOptions) => {
        try {
          const result = await this.walletManager.importWallets(options);
          Logger.info('Wallets imported', {
            count: result.imported,
            skipped: result.skipped,
          });
          console.log(chalk.green(`Import summary:`));
          console.log(chalk.cyan(`- Imported: ${result.imported} wallet(s)`));
          if (result.skipped > 0) {
            console.log(chalk.yellow(`- Skipped: ${result.skipped} wallet(s)`));
          }
        } catch (error) {
          Logger.error('Failed to import wallets', error as Error);
          console.error(
            chalk.red('Error importing wallets:'),
            (error as Error).message,
          );
          process.exit(1);
        }
      });
  }

  private registerDelete(): void {
    this.wallet
      .command('delete')
      .description('Delete wallet(s)')
      .requiredOption(
        '--name <name>',
        'Wallet name or pattern (supports wildcards *)',
      )
      .option('--network <network>', 'Filter by network')
      .option('--force', 'Skip confirmation')
      .action(async (options: WalletDeleteOptions) => {
        try {
          const matches = await this.walletManager.findWallets({
            name: options.name,
            network: options.network,
          });

          if (matches.length === 0) {
            console.log(
              chalk.yellow('No wallets found matching the criteria.'),
            );
            return;
          }

          if (!options.force) {
            console.log(chalk.yellow('The following wallets will be deleted:'));
            matches.forEach((wallet) => {
              console.log(chalk.cyan(`- ${wallet.name} (${wallet.network})`));
            });

            const confirmed = await this.walletManager.confirmAction(
              `Are you sure you want to delete ${matches.length} wallet(s)?`,
            );

            if (!confirmed) {
              console.log(chalk.yellow('Operation cancelled.'));
              return;
            }
          }

          const result = await this.walletManager.deleteWallets(options);
          Logger.info('Wallets deleted', { count: result.deleted });
          console.log(
            chalk.green(`Successfully deleted ${result.deleted} wallet(s)`),
          );
        } catch (error) {
          Logger.error('Failed to delete wallets', error as Error);
          console.error(
            chalk.red('Error deleting wallets:'),
            (error as Error).message,
          );
          process.exit(1);
        }
      });
  }

  private registerBalance(): void {
    this.wallet
      .command('balance')
      .description('Get wallet balance(s)')
      .option('--name <name>', 'Wallet name or pattern (supports wildcards *)')
      .option('--address <address>', 'Wallet address')
      .requiredOption('--network <network>', 'Blockchain network')
      .option('--show-usd', 'Show USD value')
      .action(async (options: WalletBalanceOptions) => {
        try {
          if (!options.name && !options.address) {
            throw new Error('Either --name or --address must be provided');
          }

          const balances = await this.walletManager.getBalances(options);
          Logger.info('Balances retrieved', { count: balances.length });

          balances.forEach((balance) => {
            console.log(chalk.white(`\n${balance.name || balance.address}:`));
            console.log(chalk.cyan(`${balance.formatted} ${balance.symbol}`));
            if (options.showUsd && balance.usdValue) {
              console.log(chalk.gray(`USD Value: $${balance.usdValue}`));
            }
          });
        } catch (error) {
          Logger.error('Failed to get balance(s)', error as Error);
          console.error(
            chalk.red('Error getting balance(s):'),
            (error as Error).message,
          );
          process.exit(1);
        }
      });
  }
}
