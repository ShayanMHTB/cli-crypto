// Basic wallet data structure
export interface WalletData {
  name: string;
  network: string;
  address: string;
  privateKey: string;
  mnemonic?: string;
  createdAt: string;
  filePath?: string;
  qrPath?: string;
  qrString?: string;
}

// Command Options
export interface WalletOptions {
  name: string;
  network: string;
  multiple?: string;
  mnemonic?: boolean;
  security?: 'strong' | 'default';
  output?: 'json' | 'csv';
  path?: string;
  qr?: 'png' | 'svg' | 'terminal';
  qrPath?: string;
}

export interface WalletListOptions {
  network?: string;
  name?: string;
  date?: string;
  hash?: string;
}

export interface WalletExportOptions {
  name: string;
  format: 'json' | 'csv';
  path?: string;
  network?: string;
}

export interface WalletImportOptions {
  file: string;
  network: string;
  overwrite?: boolean;
}

export interface WalletDeleteOptions {
  name: string;
  network?: string;
  force?: boolean;
}

export interface WalletBalanceOptions {
  name?: string;
  address?: string;
  network: string;
  showUsd?: boolean;
}

// Response Types
export interface WalletExportResult {
  path: string;
  count: number;
}

export interface WalletImportResult {
  imported: number;
  skipped: number;
}

export interface WalletDeleteResult {
  deleted: number;
}

export interface WalletBalance {
  name?: string;
  address: string;
  network: string;
  balance: string;
  formatted: string;
  symbol: string;
  usdValue?: string;
  decimals: number;
}

// Search/Filter Types
export interface WalletFilter {
  name?: string;
  network?: string;
  date?: string;
  hash?: string;
}

// Common Operation Results
export interface OperationResult {
  success: boolean;
  message: string;
  data?: any;
}

// Security Related Types
export interface WalletSecurity {
  encryptionLevel: 'strong' | 'default';
  encryptionMethod: string;
  keyDerivation: string;
}

// Network Related Types for Wallet
export interface WalletNetwork {
  name: string;
  chainId: number;
  rpcUrl: string;
  symbol: string;
  explorer: string;
}

// Validation Related Types
export interface WalletValidation {
  isValid: boolean;
  errors?: string[];
  warnings?: string[];
}

// Batch Operation Types
export interface BatchOperationResult<T> {
  successful: T[];
  failed: Array<{
    item: any;
    error: string;
  }>;
  total: number;
}

// Event Related Types
export interface WalletEvent {
  type: 'create' | 'import' | 'export' | 'delete' | 'update';
  timestamp: string;
  wallet: string;
  details: any;
}
