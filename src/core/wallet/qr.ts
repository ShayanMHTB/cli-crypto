import QRCode from 'qrcode';
import path from 'path';
import fs from 'fs/promises';
import type { WalletData } from '@/types/wallet';
import Logger from '@/core/logger/logger';

export interface QROptions {
  format: 'png' | 'svg' | 'terminal';
  outputDir?: string;
}

export class WalletQRManager {
  private readonly defaultOutputDir: string;

  constructor(baseDir: string = 'artifacts/qr-codes') {
    this.defaultOutputDir = baseDir;
  }

  async generateQR(
    walletData: WalletData,
    options: QROptions,
  ): Promise<{ qrString?: string; qrPath?: string }> {
    try {
      if (!walletData.mnemonic) {
        throw new Error('No mnemonic phrase available for QR code generation');
      }

      // For terminal output, just generate the string and return
      if (options.format === 'terminal') {
        const terminalQR = await QRCode.toString(walletData.mnemonic, {
          type: 'terminal',
          errorCorrectionLevel: 'H',
          margin: 1,
        });
        return { qrString: terminalQR };
      }

      // For file output, save next to the wallet file
      const walletDir = path.dirname(walletData.filePath || '');
      const walletName = path.basename(walletData.filePath || '', '.json');
      const qrPath = path.join(walletDir, `${walletName}.${options.format}`);

      switch (options.format) {
        case 'png':
          await QRCode.toFile(qrPath, walletData.mnemonic, {
            errorCorrectionLevel: 'H',
            margin: 1,
            scale: 8,
          });
          break;

        case 'svg':
          const svgString = await QRCode.toString(walletData.mnemonic, {
            type: 'svg',
            errorCorrectionLevel: 'H',
            margin: 1,
          });
          await fs.writeFile(qrPath, svgString);
          break;
      }

      return { qrPath };
    } catch (error) {
      Logger.error('Failed to generate QR code', error as Error);
      throw error;
    }
  }

  async generateBatch(
    wallets: WalletData[],
    options: QROptions,
  ): Promise<(string | undefined)[]> {
    const results: (string | undefined)[] = [];
    for (const wallet of wallets) {
      const result = await this.generateQR(wallet, options);
      // Push either the path or string, depending on what was returned
      results.push(result.qrPath || result.qrString);
    }
    return results;
  }
}
