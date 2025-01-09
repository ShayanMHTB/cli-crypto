import { ethers } from 'ethers';
import fs from 'fs/promises';
import path from 'path';
import inquirer from 'inquirer';
import EventEmitter from 'events';
import type {
  NetworkConfig,
  NetworkOptions,
  NetworkStatus,
  NetworkValidationResult,
  NetworkTestResult,
  NetworkBenchmarkResult,
  NetworkInfo,
  NetworkListFilter,
  NetworkExportData,
  NetworkListOptions,
  NetworkSwitchResult,
  NetworkMonitoringConfig,
} from '@/types/network';
import Logger from '@/core/logger/logger';

export class NetworkManager extends EventEmitter {
  private readonly configPath: string;
  private readonly providers: Map<string, ethers.providers.JsonRpcProvider>;
  private activeNetwork?: string;
  private monitoringInterval?: NodeJS.Timeout;

  constructor() {
    super();
    this.configPath =
      process.env.NETWORKS_CONFIG_PATH || 'config/networks.json';
    this.providers = new Map();
  }

  private async loadNetworks(): Promise<NetworkConfig[]> {
    try {
      await fs.access(this.configPath);
      const data = await fs.readFile(this.configPath, 'utf-8');
      return JSON.parse(data);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        await this.saveNetworks([]);
        return [];
      }
      throw error;
    }
  }

  private async saveNetworks(networks: NetworkConfig[]): Promise<void> {
    await fs.mkdir(path.dirname(this.configPath), { recursive: true });
    await fs.writeFile(this.configPath, JSON.stringify(networks, null, 2));
  }

  async listNetworks(
    options: NetworkListOptions = {},
  ): Promise<NetworkConfig[]> {
    try {
      const networks = await this.loadNetworks();
      return networks.filter((network) => {
        if (
          options.testnet !== undefined &&
          network.isTestnet !== options.testnet
        ) {
          return false;
        }
        if (options.active && !network.isActive) {
          return false;
        }
        if (
          options.mainnet !== undefined &&
          network.isTestnet === options.mainnet
        ) {
          return false;
        }
        return true;
      });
    } catch (error) {
      Logger.error('Failed to list networks', error as Error);
      throw error;
    }
  }

  async addNetwork(options: NetworkOptions): Promise<NetworkConfig> {
    try {
      // Add retry logic for validation
      let validation: NetworkValidationResult | null = null;
      let retryCount = 0;
      const maxRetries = options.retryAttempts || 3;

      while (retryCount < maxRetries) {
        try {
          validation = await this.validateNetwork(options);
          break;
        } catch (error) {
          retryCount++;
          if (retryCount === maxRetries) {
            throw error;
          }
          // Wait before retrying
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }
      }

      if (!validation || !validation.isValid) {
        throw new Error(
          `Invalid network configuration: ${validation?.errors.join(', ')}`,
        );
      }

      if (validation.warnings.length > 0) {
        Logger.warn('Network validation warnings', {
          warnings: validation.warnings,
          network: options.name,
        });
      }

      const newNetwork: NetworkConfig = {
        name: options.name,
        rpcUrl: options.rpcUrl,
        chainId: options.chainId || validation.chainId!,
        currency: options.currency || 'ETH',
        explorer: options.explorer,
        isTestnet: options.testnet || false,
        isActive: false,
        lastValidated: new Date(),
        timeout: options.timeout || 10000,
        retryAttempts: options.retryAttempts || 3,
      };

      const networks = await this.loadNetworks();
      if (networks.some((n) => n.name === newNetwork.name)) {
        throw new Error(`Network '${newNetwork.name}' already exists`);
      }

      networks.push(newNetwork);
      await this.saveNetworks(networks);

      return newNetwork;
    } catch (error) {
      Logger.error('Failed to add network', error as Error);
      throw error;
    }
  }

  async switchNetwork(name: string): Promise<NetworkSwitchResult> {
    try {
      const networks = await this.loadNetworks();
      const network = networks.find((n) => n.name === name);
      if (!network) {
        throw new Error(`Network '${name}' not found`);
      }

      const previousNetwork = networks.find((n) => n.isActive)?.name;

      // Test connection before switching
      await this.testNetwork({ name });

      networks.forEach((n) => (n.isActive = n.name === name));
      await this.saveNetworks(networks);
      this.activeNetwork = name;

      return {
        previousNetwork,
        newNetwork: name,
        success: true,
      };
    } catch (error) {
      Logger.error('Failed to switch network', error as Error);
      throw error;
    }
  }

  async getNetworkStatus(name?: string): Promise<NetworkStatus> {
    try {
      const networkName = name || this.activeNetwork;
      if (!networkName) {
        throw new Error('No network specified or active');
      }

      const provider = await this.getProvider(networkName);
      const [blockNumber, network, gasPrice, syncing] = await Promise.all([
        provider.getBlockNumber(),
        provider.getNetwork(),
        provider.getGasPrice(),
        (provider as any).send('eth_syncing', []),
      ]);

      const peers = await (provider as any).send('net_peerCount', []);

      return {
        name: networkName,
        isConnected: true,
        blockNumber,
        gasPrice: ethers.utils.formatUnits(gasPrice, 'gwei'),
        chainId: network.chainId,
        peers: parseInt(peers, 16),
        isSyncing: !!syncing,
        lastChecked: new Date(),
      };
    } catch (error) {
      Logger.error('Failed to get network status', error as Error);
      throw error;
    }
  }

  async getAllNetworkStatuses(): Promise<NetworkStatus[]> {
    const networks = await this.loadNetworks();
    return Promise.all(
      networks.map((network) =>
        this.getNetworkStatus(network.name).catch((error) => ({
          name: network.name,
          isConnected: false,
          blockNumber: 0,
          gasPrice: '0',
          chainId: network.chainId,
          peers: 0,
          isSyncing: false,
          lastChecked: new Date(),
        })),
      ),
    );
  }

  async validateNetwork(
    options: NetworkOptions,
  ): Promise<NetworkValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];
    let chainId: number | undefined;
    let measureLatency: number | undefined;

    try {
      // Create provider with custom settings
      const provider = new ethers.providers.JsonRpcProvider({
        url: options.rpcUrl,
        timeout: options.timeout || 10000,
      });

      // Set longer timeout for initial connection
      const networkPromise = provider.getNetwork();
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Network detection timeout')), 10000),
      );

      const network = await Promise.race([networkPromise, timeoutPromise]);
      chainId = (network as ethers.providers.Network).chainId;

      // Only proceed with additional checks if we got the chain ID
      if (chainId) {
        try {
          const [blockNumber, gasPrice] = await Promise.all([
            provider.getBlockNumber(),
            provider.getGasPrice(),
          ]);

          if (options.chainId && options.chainId !== chainId) {
            errors.push(
              `Chain ID mismatch: expected ${options.chainId}, got ${chainId}`,
            );
          }

          if (blockNumber === 0) {
            warnings.push('Network might be inactive (block number is 0)');
          }

          // Measure latency
          const start = Date.now();
          await provider.getBlockNumber();
          measureLatency = Date.now() - start;

          if (measureLatency > 1000) {
            warnings.push(`High latency detected: ${measureLatency}ms`);
          }

          if (options.maxGasPrice) {
            const maxGwei = ethers.utils.parseUnits(
              options.maxGasPrice,
              'gwei',
            );
            if (gasPrice.gt(maxGwei)) {
              warnings.push(
                `Current gas price (${ethers.utils.formatUnits(
                  gasPrice,
                  'gwei',
                )} gwei) exceeds specified maximum`,
              );
            }
          }
        } catch (error) {
          warnings.push(
            `Additional checks failed: ${(error as Error).message}`,
          );
        }
      }
    } catch (error) {
      // More specific error messages based on the error type
      if (error instanceof Error) {
        if (error.message.includes('timeout')) {
          errors.push(
            'Connection timed out. The RPC endpoint might be down or responding slowly.',
          );
        } else if (error.message.includes('getaddrinfo')) {
          errors.push(
            'DNS resolution failed. Please check if the RPC URL is correct.',
          );
        } else if (error.message.includes('ECONNREFUSED')) {
          errors.push(
            'Connection refused. The RPC endpoint might be down or blocking requests.',
          );
        } else {
          errors.push(`Connection failed: ${error.message}`);
        }
      } else {
        errors.push('Unknown connection error occurred');
      }
    }

    return {
      isValid: errors.length === 0,
      chainId,
      errors,
      warnings,
      latency: measureLatency,
    };
  }

  private async testNetworkLatency(
    provider: ethers.providers.Provider,
  ): Promise<number> {
    const start = Date.now();
    await provider.getBlockNumber();
    return Date.now() - start;
  }

  async syncNetwork(name?: string): Promise<{ name: string; status: string }> {
    const networkName = name || this.activeNetwork;
    if (!networkName) {
      throw new Error('No network specified or active');
    }

    try {
      const provider = await this.getProvider(networkName);
      await provider.getBlockNumber(); // Force sync check
      return { name: networkName, status: 'synchronized' };
    } catch (error) {
      return { name: networkName, status: 'failed' };
    }
  }

  async syncAllNetworks(): Promise<Array<{ name: string; status: string }>> {
    const networks = await this.loadNetworks();
    return Promise.all(
      networks.map((network) => this.syncNetwork(network.name)),
    );
  }

  async removeNetwork(name: string): Promise<void> {
    try {
      const networks = await this.loadNetworks();
      const index = networks.findIndex((n) => n.name === name);
      if (index === -1) {
        throw new Error(`Network '${name}' not found`);
      }

      if (networks[index].isActive) {
        throw new Error('Cannot remove active network');
      }

      networks.splice(index, 1);
      await this.saveNetworks(networks);
      this.providers.delete(name);
    } catch (error) {
      Logger.error('Failed to remove network', error as Error);
      throw error;
    }
  }

  private async getProvider(
    networkName: string,
  ): Promise<ethers.providers.Provider> {
    if (!this.providers.has(networkName)) {
      const networks = await this.loadNetworks();
      const network = networks.find((n) => n.name === networkName);
      if (!network) {
        throw new Error(`Network '${networkName}' not found`);
      }
      this.providers.set(
        networkName,
        new ethers.providers.JsonRpcProvider(network.rpcUrl),
      );
    }
    return this.providers.get(networkName)!;
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

  // Helper method to clear provider cache
  private clearProviderCache(networkName?: string): void {
    if (networkName) {
      this.providers.delete(networkName);
    } else {
      this.providers.clear();
    }
  }

  async benchmarkNetwork(
    name: string,
    duration: number = 30,
  ): Promise<NetworkBenchmarkResult> {
    const provider = await this.getProvider(name);
    const startTime = Date.now();
    const results: number[] = [];
    const errors: Error[] = [];
    let requestCount = 0;

    // Verify network exists first
    const networks = await this.loadNetworks();
    const network = networks.find((n) => n.name === name);
    if (!network) {
      throw new Error(`Network '${name}' not found`);
    }

    while (Date.now() - startTime < duration * 1000) {
      try {
        const requestStart = Date.now();
        await provider.getBlockNumber();
        results.push(Date.now() - requestStart);
        requestCount++;
      } catch (error) {
        errors.push(error as Error);
      }
      // Rate limiting to prevent overwhelming the provider
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    const totalTime = (Date.now() - startTime) / 1000;
    const benchmarkResult = {
      success: errors.length === 0,
      requestsPerSecond: requestCount / totalTime,
      averageLatency:
        results.length > 0
          ? results.reduce((a, b) => a + b, 0) / results.length
          : 0,
      maxLatency: results.length > 0 ? Math.max(...results) : 0,
      minLatency: results.length > 0 ? Math.min(...results) : 0,
      errorRate: requestCount > 0 ? errors.length / requestCount : 1,
      timestamp: new Date(),
    };

    // Store benchmark results in network config
    network.benchmarkResults = benchmarkResult;
    await this.saveNetworks(networks);

    return benchmarkResult;
  }

  async startNetworkMonitoring(
    name: string,
    interval: number = 60000,
  ): Promise<void> {
    const networks = await this.loadNetworks();
    const network = networks.find((n) => n.name === name);
    if (!network) {
      throw new Error(`Network '${name}' not found`);
    }

    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
    }

    const monitor = async () => {
      try {
        const status = await this.getNetworkStatus(name);
        network.lastValidated = new Date();
        await this.saveNetworks(networks);

        this.emit('networkStatus', {
          ...status,
          timestamp: new Date(),
        });
      } catch (error) {
        this.emit('monitoringError', {
          name,
          error,
          timestamp: new Date(),
        });
      }
    };

    // Initial check
    await monitor();
    this.monitoringInterval = setInterval(monitor, interval);

    // Update network config
    network.monitoringEnabled = true;
    network.monitoringInterval = interval;
    await this.saveNetworks(networks);
  }

  async stopNetworkMonitoring(): Promise<void> {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = undefined;

      // Update all networks to disable monitoring
      const networks = await this.loadNetworks();
      networks.forEach((network) => {
        network.monitoringEnabled = false;
      });
      await this.saveNetworks(networks);
    }
  }

  async exportNetworks(filepath: string): Promise<void> {
    const networks = await this.loadNetworks();
    const exportData: NetworkExportData = {
      version: '1.0',
      timestamp: new Date(),
      networks,
    };
    await fs.writeFile(filepath, JSON.stringify(exportData, null, 2));
  }

  async importNetworks(
    filepath: string,
    overwrite: boolean = false,
  ): Promise<number> {
    const importData = JSON.parse(
      await fs.readFile(filepath, 'utf-8'),
    ) as NetworkExportData;
    const currentNetworks = await this.loadNetworks();

    let imported = 0;
    for (const network of importData.networks) {
      const exists = currentNetworks.some((n) => n.name === network.name);
      if (!exists || overwrite) {
        if (exists) {
          await this.removeNetwork(network.name);
        }
        await this.addNetwork(network);
        imported++;
      }
    }
    return imported;
  }

  async cleanup(
    options: { inactive?: number; unvalidated?: number } = {},
  ): Promise<string[]> {
    const networks = await this.loadNetworks();
    const removed: string[] = [];

    for (const network of networks) {
      try {
        if (options.inactive) {
          const status = await this.getNetworkStatus(network.name);
          if (!status.isConnected) {
            await this.removeNetwork(network.name);
            removed.push(network.name);
            continue;
          }
        }

        if (options.unvalidated && network.lastValidated) {
          const daysSinceValidation =
            (Date.now() - new Date(network.lastValidated).getTime()) /
            (1000 * 60 * 60 * 24);
          if (daysSinceValidation > options.unvalidated) {
            await this.removeNetwork(network.name);
            removed.push(network.name);
          }
        }
      } catch (error) {
        // Skip errors and continue with next network
        continue;
      }
    }

    return removed;
  }

  async testNetwork(options: {
    name?: string;
    timeout?: number;
  }): Promise<NetworkTestResult> {
    try {
      const networkName = options.name || this.activeNetwork;
      if (!networkName) {
        throw new Error('No network specified or active');
      }

      const provider = await this.getProvider(networkName);
      const startTime = Date.now();

      // Test basic connectivity with timeout
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(
          () => reject(new Error('Connection timeout')),
          options.timeout || 5000,
        );
      });

      const [network, blockNumber] = (await Promise.race([
        Promise.all([provider.getNetwork(), provider.getBlockNumber()]),
        timeoutPromise,
      ])) as [ethers.providers.Network, number];

      return {
        success: true,
        latency: Date.now() - startTime,
        chainId: network.chainId,
        timestamp: new Date(),
        blockHeight: blockNumber,
      };
    } catch (error) {
      return {
        success: false,
        error: (error as Error).message,
        timestamp: new Date(),
      };
    }
  }

  async getNetworkInfo(name?: string): Promise<NetworkInfo> {
    const networkName = name || this.activeNetwork;
    if (!networkName) {
      throw new Error('No network specified or active');
    }

    const networks = await this.loadNetworks();
    const network = networks.find((n) => n.name === networkName);
    if (!network) {
      throw new Error(`Network '${networkName}' not found`);
    }

    const provider = await this.getProvider(networkName);
    const [blockNumber, gasPrice, peers] = await Promise.all([
      provider.getBlockNumber(),
      provider
        .getGasPrice()
        .then((price) => ethers.utils.formatUnits(price, 'gwei')),
      (provider as any)
        .send('net_peerCount', [])
        .then((result: string) => parseInt(result, 16))
        .catch(() => 0),
    ]);

    return {
      ...network,
      blockNumber,
      gasPrice,
      peers,
    };
  }
}
