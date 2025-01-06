import { ethers } from 'ethers';
import fs from 'fs/promises';
import path from 'path';
import inquirer from 'inquirer';
import glob from 'glob-promise';
import type {
  WalletOptions,
  WalletData,
  WalletListOptions,
  WalletExportOptions,
  WalletImportOptions,
  WalletDeleteOptions,
  WalletBalance,
  WalletFilter,
  WalletExportResult,
  WalletImportResult,
  WalletDeleteResult,
  BatchOperationResult,
} from '@/types/wallet';
import Logger from '@/core/logger/logger';
import { BlockchainManager } from '../network/blockchain';
import { WalletQRManager } from '@/core/wallet/qr';

export class WalletManager {
  private readonly walletsPath: string;
  private readonly providers: Map<string, ethers.providers.Provider>;
  private readonly blockchainManager: BlockchainManager;
  private readonly qrManager: WalletQRManager;

  constructor() {
    this.walletsPath = process.env.WALLETS_PATH || 'artifacts/wallets';
    this.providers = new Map();
    this.blockchainManager = new BlockchainManager();
    this.qrManager = new WalletQRManager();
  }

  async createWallet(options: WalletOptions): Promise<WalletData> {
    const walletData = await this.blockchainManager.createWallet(
      options.name,
      options.network,
      options.mnemonic || false,
    );

    // Save wallet first
    const savePath = options.path || this.walletsPath;
    const fileName = `${walletData.name}-${
      walletData.network
    }-${walletData.address.slice(0, 8)}.json`;
    const filePath = path.join(savePath, fileName);

    await fs.mkdir(savePath, { recursive: true });
    await fs.writeFile(filePath, JSON.stringify(walletData, null, 2));

    // Add filePath to walletData for QR generation
    walletData.filePath = filePath;

    // Generate QR if requested
    if (options.qr) {
      const qrResult = await this.qrManager.generateQR(walletData, {
        format: options.qr as 'png' | 'svg' | 'terminal',
      });

      if (qrResult.qrPath) {
        walletData.qrPath = qrResult.qrPath;
      }
      if (qrResult.qrString) {
        walletData.qrString = qrResult.qrString;
      }
    }

    return walletData;
  }

  async listWallets(options: WalletListOptions = {}): Promise<WalletData[]> {
    try {
      const files = await glob('**/*.json', { cwd: this.walletsPath });
      const wallets: WalletData[] = [];

      for (const file of files) {
        const content = await fs.readFile(
          path.join(this.walletsPath, file),
          'utf-8',
        );
        const wallet = JSON.parse(content) as WalletData;

        if (this.matchesFilter(wallet, options)) {
          wallets.push(wallet);
        }
      }

      return wallets;
    } catch (error) {
      Logger.error('Failed to list wallets', error as Error);
      throw new Error('Failed to list wallets');
    }
  }

  private matchesFilter(wallet: WalletData, filter: WalletFilter): boolean {
    if (filter.network && wallet.network !== filter.network) return false;
    if (filter.name && !wallet.name.includes(filter.name)) return false;
    if (
      filter.hash &&
      !wallet.address.toLowerCase().includes(filter.hash.toLowerCase())
    )
      return false;
    if (filter.date) {
      const filterDate = new Date(filter.date);
      const walletDate = new Date(wallet.createdAt);
      if (walletDate < filterDate) return false;
    }
    return true;
  }

  async findWallets(filter: WalletFilter): Promise<WalletData[]> {
    return this.listWallets(filter);
  }

  async exportWallets(
    options: WalletExportOptions,
  ): Promise<WalletExportResult> {
    try {
      const wallets = await this.findWallets({
        name: options.name,
        network: options.network,
      });

      if (wallets.length === 0) {
        throw new Error('No wallets found matching the criteria');
      }

      const exportPath = options.path || path.join(this.walletsPath, 'exports');
      await fs.mkdir(exportPath, { recursive: true });

      const filename = `wallet-export-${new Date().toISOString()}.${
        options.format
      }`;
      const fullPath = path.join(exportPath, filename);

      const content =
        options.format === 'csv'
          ? this.formatWalletsAsCsv(wallets)
          : JSON.stringify(wallets, null, 2);

      await fs.writeFile(fullPath, content);

      return {
        path: fullPath,
        count: wallets.length,
      };
    } catch (error) {
      Logger.error('Failed to export wallets', error as Error);
      throw error;
    }
  }

  private formatWalletsAsCsv(wallets: WalletData[]): string {
    const headers = Object.keys(wallets[0]).join(',');
    const rows = wallets.map((wallet) =>
      Object.values(wallet)
        .map((value) => `"${value}"`)
        .join(','),
    );
    return [headers, ...rows].join('\n');
  }

  async importWallets(
    options: WalletImportOptions,
  ): Promise<WalletImportResult> {
    try {
      const content = await fs.readFile(options.file, 'utf-8');
      let wallets: WalletData[];

      if (options.file.endsWith('.csv')) {
        wallets = this.parseCsvWallets(content);
      } else {
        wallets = JSON.parse(content);
      }

      let imported = 0;
      let skipped = 0;

      for (const wallet of wallets) {
        try {
          const exists = await this.walletExists(wallet.name, options.network);
          if (exists && !options.overwrite) {
            skipped++;
            continue;
          }

          await this.saveWallet(wallet, {
            name: wallet.name,
            network: options.network,
          });
          imported++;
        } catch (error) {
          Logger.error(
            `Failed to import wallet ${wallet.name}`,
            error as Error,
          );
          skipped++;
        }
      }

      return { imported, skipped };
    } catch (error) {
      Logger.error('Failed to import wallets', error as Error);
      throw error;
    }
  }

  private async walletExists(name: string, network: string): Promise<boolean> {
    try {
      const wallets = await this.findWallets({ name, network });
      return wallets.length > 0;
    } catch {
      return false;
    }
  }

  async deleteWallets(
    options: WalletDeleteOptions,
  ): Promise<WalletDeleteResult> {
    try {
      const wallets = await this.findWallets({
        name: options.name,
        network: options.network,
      });

      if (wallets.length === 0) {
        return { deleted: 0 };
      }

      let deleted = 0;
      for (const wallet of wallets) {
        const filename = `${wallet.name}-${
          wallet.network
        }-${wallet.address.slice(0, 8)}.json`;
        await fs.unlink(path.join(this.walletsPath, filename));
        deleted++;
      }

      return { deleted };
    } catch (error) {
      Logger.error('Failed to delete wallets', error as Error);
      throw error;
    }
  }

  async getBalances(options: {
    name?: string;
    address?: string;
    network: string;
    showUsd?: boolean;
  }): Promise<WalletBalance[]> {
    try {
      const wallets = options.address
        ? [{ address: options.address }]
        : await this.findWallets({
            name: options.name,
            network: options.network,
          });

      const provider = await this.getProvider(options.network);
      const balances: WalletBalance[] = [];

      for (const wallet of wallets) {
        const balance = await provider.getBalance(wallet.address);
        const formatted = ethers.utils.formatEther(balance);

        balances.push({
          name: 'name' in wallet ? wallet.name : undefined,
          address: wallet.address,
          network: options.network,
          balance: balance.toString(),
          formatted,
          symbol: 'ETH', // Should be dynamic based on network
          decimals: 18,
          ...(options.showUsd
            ? { usdValue: await this.getUsdValue(formatted, options.network) }
            : {}),
        });
      }

      return balances;
    } catch (error) {
      Logger.error('Failed to get balances', error as Error);
      throw error;
    }
  }

  private async getProvider(
    network: string,
  ): Promise<ethers.providers.Provider> {
    if (!this.providers.has(network)) {
      // This should be expanded to handle different networks
      const provider = new ethers.providers.JsonRpcProvider(
        process.env[`${network.toUpperCase()}_RPC_URL`],
      );
      this.providers.set(network, provider);
    }
    return this.providers.get(network)!;
  }

  private async getUsdValue(amount: string, network: string): Promise<string> {
    // Implement price fetching logic here
    // This is a placeholder
    return '0.00';
  }

  private parseCsvWallets(content: string): WalletData[] {
    const lines = content.split('\n');
    const headers = lines[0].split(',');
    return lines.slice(1).map((line) => {
      const values = line.split(',');
      return headers.reduce(
        (obj, header, index) => ({
          ...obj,
          [header]: values[index].replace(/"/g, ''),
        }),
        {},
      ) as WalletData;
    });
  }

  async confirmAction(message: string): Promise<boolean> {
    const { confirm } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'confirm',
        message,
        default: true,
      },
    ]);
    return confirm;
  }

  private async saveWallet(
    walletData: WalletData,
    options: WalletOptions,
  ): Promise<void> {
    const savePath = options.path || this.walletsPath;
    const fileName = `${walletData.name}-${
      walletData.network
    }-${walletData.address.slice(0, 8)}.${options.output || 'json'}`;

    await fs.mkdir(savePath, { recursive: true });
    await fs.writeFile(
      path.join(savePath, fileName),
      this.formatWalletData(walletData, options.output),
    );
  }

  private formatWalletData(data: WalletData, format: string = 'json'): string {
    if (format === 'csv') {
      const headers = Object.keys(data).join(',');
      const values = Object.values(data).join(',');
      return `${headers}\n${values}`;
    }
    return JSON.stringify(data, null, 2);
  }
}
