import { SupportedNetworks } from '@/core/wallet/types';
import logger from '@/utils/logger';

export function validateWalletName(name: string): void {
  if (!name) {
    throw new Error('Wallet name is required');
  }

  if (name.length < 3) {
    throw new Error('Wallet name must be at least 3 characters long');
  }

  if (name.length > 32) {
    throw new Error('Wallet name must not exceed 32 characters');
  }

  // Allow only alphanumeric characters, hyphens, and underscores
  const validNameRegex = /^[a-zA-Z0-9-_]+$/;
  if (!validNameRegex.test(name)) {
    throw new Error(
      'Wallet name can only contain letters, numbers, hyphens, and underscores',
    );
  }
}

export function validateNetwork(
  network: string,
): asserts network is SupportedNetworks {
  const supportedNetworks: SupportedNetworks[] = [
    'ethereum',
    'bitcoin',
    'solana',
    'tezos',
  ];

  if (!supportedNetworks.includes(network as SupportedNetworks)) {
    throw new Error(
      `Unsupported network: ${network}. Supported networks are: ${supportedNetworks.join(
        ', ',
      )}`,
    );
  }
}

export function validateAddress(
  address: string,
  network: SupportedNetworks,
): void {
  const addressRegexMap = {
    ethereum: /^0x[a-fA-F0-9]{40}$/,
    bitcoin: /^[13][a-km-zA-HJ-NP-Z1-9]{25,34}$|^bc1[ac-hj-np-z02-9]{39,59}$/,
    solana: /^[1-9A-HJ-NP-Za-km-z]{32,44}$/,
    tezos: /^tz[1-3][1-9A-HJ-NP-Za-km-z]{33}$/,
  };

  if (!addressRegexMap[network].test(address)) {
    throw new Error(`Invalid ${network} address format`);
  }
}

export function validateAmount(amount: string): void {
  const amountNum = parseFloat(amount);

  if (isNaN(amountNum)) {
    throw new Error('Amount must be a valid number');
  }

  if (amountNum <= 0) {
    throw new Error('Amount must be greater than 0');
  }

  // Check for more than 8 decimal places
  const decimalPlaces = amount.includes('.') ? amount.split('.')[1].length : 0;
  if (decimalPlaces > 8) {
    throw new Error('Amount cannot have more than 8 decimal places');
  }
}

export function validateFilePath(path: string): void {
  // Basic path validation
  if (!path) {
    throw new Error('File path is required');
  }

  // Check for invalid characters in path
  const invalidChars = /[<>:"|?*\x00-\x1F]/g;
  if (invalidChars.test(path)) {
    throw new Error('File path contains invalid characters');
  }

  // Check path length (Windows MAX_PATH is 260, but we'll be more conservative)
  if (path.length > 248) {
    throw new Error('File path is too long');
  }

  logger.debug('File path validation passed', { path });
}

export function validateContractAddress(address: string): void {
  // Basic Ethereum contract address validation
  if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
    throw new Error('Invalid contract address format');
  }
}
