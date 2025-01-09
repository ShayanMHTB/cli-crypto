import { ethers } from 'ethers';
import * as bitcoin from 'bitcoinjs-lib';
import * as bip39 from 'bip39';
import * as ecc from 'tiny-secp256k1';
import { BIP32Factory } from 'bip32';
import { ECPairFactory } from 'ecpair';
import type { WalletData } from '@/types/wallet';
import Logger from '@/core/logger/logger';

// Initialize Bitcoin-related factories
const bip32 = BIP32Factory(ecc);
const ECPair = ECPairFactory(ecc);

interface BlockchainWallet {
  address: string;
  privateKey: string;
  mnemonic?: string;
}

interface BlockchainConfig {
  name: string;
  symbols: string[];
  decimals: number;
  generateWallet: (name: string, useMnemonic: boolean) => Promise<WalletData>;
}

export class BlockchainManager {
  private readonly supportedNetworks: Map<string, BlockchainConfig>;

  constructor() {
    this.supportedNetworks = new Map();
    this.initializeNetworks();
  }

  private initializeNetworks(): void {
    // Bitcoin configuration
    this.supportedNetworks.set('bitcoin', {
      name: 'bitcoin',
      symbols: ['BTC'],
      decimals: 8,
      generateWallet: async (name: string, useMnemonic: boolean) => {
        const wallet = await this.generateBitcoinWallet(useMnemonic);
        return {
          name,
          network: 'bitcoin',
          address: wallet.address,
          privateKey: wallet.privateKey,
          mnemonic: wallet.mnemonic,
          createdAt: new Date().toISOString(),
        };
      },
    });

    // Ethereum and EVM compatible chains
    const evmNetworks = [
      'ethereum',
      'polygon',
      'bsc',
      'arbitrum',
      'optimism',
      'avalanche',
    ];
    evmNetworks.forEach((network) => {
      this.supportedNetworks.set(network, {
        name: network,
        symbols: [network === 'ethereum' ? 'ETH' : network.toUpperCase()],
        decimals: 18,
        generateWallet: async (name: string, useMnemonic: boolean) => {
          const wallet = await this.generateEVMWallet(useMnemonic);
          return {
            name,
            network,
            address: wallet.address,
            privateKey: wallet.privateKey,
            mnemonic: wallet.mnemonic,
            createdAt: new Date().toISOString(),
          };
        },
      });
    });
  }

  private async generateBitcoinWallet(
    useMnemonic: boolean,
  ): Promise<BlockchainWallet> {
    if (useMnemonic) {
      // Generate mnemonic and derive wallet
      const mnemonic = bip39.generateMnemonic();
      const seed = await bip39.mnemonicToSeed(mnemonic);
      const root = bip32.fromSeed(seed);

      // Use BIP84 for Native SegWit addresses (bc1...)
      // Path: m/84'/0'/0'/0/0
      const path = "m/84'/0'/0'/0/0";
      const child = root.derivePath(path);

      if (!child.privateKey)
        throw new Error('Failed to generate Bitcoin private key');

      const { address } = bitcoin.payments.p2wpkh({
        pubkey: Buffer.from(child.publicKey),
      });

      if (!address) throw new Error('Failed to generate Bitcoin address');

      return {
        address,
        privateKey: Buffer.from(child.privateKey).toString('hex'),
        mnemonic,
      };
    } else {
      // Generate a random keypair
      const keyPair = ECPair.makeRandom();

      if (!keyPair.privateKey)
        throw new Error('Failed to generate Bitcoin private key');

      const { address } = bitcoin.payments.p2wpkh({
        pubkey: Buffer.from(keyPair.publicKey),
      });

      if (!address) throw new Error('Failed to generate Bitcoin address');

      return {
        address,
        privateKey: Buffer.from(keyPair.privateKey).toString('hex'),
        mnemonic: undefined,
      };
    }
  }

  private async generateEVMWallet(
    useMnemonic: boolean,
  ): Promise<BlockchainWallet> {
    const wallet = useMnemonic
      ? ethers.Wallet.createRandom()
      : new ethers.Wallet(ethers.utils.randomBytes(32));

    return {
      address: wallet.address,
      privateKey: wallet.privateKey,
      mnemonic: useMnemonic ? wallet.mnemonic?.phrase : undefined,
    };
  }

  async createWallet(
    name: string,
    network: string,
    useMnemonic: boolean,
  ): Promise<WalletData> {
    const networkConfig = this.supportedNetworks.get(network.toLowerCase());

    if (!networkConfig) {
      throw new Error(`Unsupported blockchain network: ${network}`);
    }

    try {
      return await networkConfig.generateWallet(name, useMnemonic);
    } catch (error) {
      Logger.error(`Failed to create ${network} wallet`, error as Error);
      throw error;
    }
  }

  isNetworkSupported(network: string): boolean {
    return this.supportedNetworks.has(network.toLowerCase());
  }

  getSupportedNetworks(): string[] {
    return Array.from(this.supportedNetworks.keys());
  }

  getNetworkConfig(network: string): BlockchainConfig | undefined {
    return this.supportedNetworks.get(network.toLowerCase());
  }
}
