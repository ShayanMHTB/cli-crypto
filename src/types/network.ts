export interface NetworkConfig {
  name: string;
  rpcUrl: string;
  chainId: number;
  currency: string;
  explorer?: string;
  isTestnet?: boolean;
  isActive?: boolean;
  lastValidated?: Date;
  maxGasPrice?: string;
  timeout?: number;
  retryAttempts?: number;
  benchmarkResults?: NetworkBenchmarkResult;
  monitoringEnabled?: boolean;
  monitoringInterval?: number;
}

export interface NetworkOptions {
  name: string;
  rpcUrl: string;
  chainId?: number;
  currency?: string;
  explorer?: string;
  testnet?: boolean;
  timeout?: number;
  maxGasPrice?: string;
  retryAttempts?: number;
}

export interface NetworkStatus {
  name: string;
  isConnected: boolean;
  blockNumber: number;
  gasPrice: string;
  peers?: number;
  chainId: number;
  isSyncing: boolean;
  latency?: number;
  lastChecked: Date;
}

export interface NetworkTestResult {
  success: boolean;
  latency?: number;
  chainId?: number;
  error?: string;
  timestamp: Date;
  gasPrice?: string;
  blockHeight?: number;
}

export interface NetworkListOptions {
  active?: boolean;
  testnet?: boolean;
  mainnet?: boolean;
}

export interface NetworkSwitchResult {
  previousNetwork?: string;
  newNetwork: string;
  success: boolean;
}

export interface NetworkBenchmarkResult extends NetworkTestResult {
  requestsPerSecond: number;
  averageLatency: number;
  maxLatency: number;
  minLatency: number;
  errorRate: number;
}

export interface NetworkInfo extends NetworkConfig {
  blockNumber: number;
  gasPrice: string;
  peers: number;
  performance?: NetworkBenchmarkResult;
}

export interface NetworkValidationResult {
  isValid: boolean;
  chainId?: number;
  errors: string[];
  warnings: string[];
  latency?: number;
}

export type NetworkListFilter = {
  active?: boolean;
  testnet?: boolean;
  mainnet?: boolean;
  validated?: boolean;
};

export interface NetworkExportData {
  version: string;
  timestamp: Date;
  networks: NetworkConfig[];
}

export interface NetworkMonitoringConfig {
  enabled: boolean;
  interval: number;
  alertThresholds?: {
    latency?: number;
    gasPrice?: number;
    blockDelay?: number;
  };
}
