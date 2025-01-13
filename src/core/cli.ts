import logger from '@/utils/logger';

import { NetworkCommands } from '@/commands/network/index';
import { WalletCommands } from '@/commands/wallet/index';
import { Command } from 'commander';

export default class CLI {
  private program: Command;

  constructor() {
    this.program = new Command();
    this.setupProgram();
  }

  private setupProgram(): void {
    this.program
      .version(process.env.npm_package_version || '1.0.0')
      .description('Web3 CLI tool for blockchain operations');

    // Register command modules
    this.registerCommands();

    // Handle unknown commands
    this.program.on('command:*', () => {
      logger.error('Invalid command', { command: this.program.args.join(' ') });
      this.program.outputHelp();
      process.exit(1);
    });
  }

  private registerCommands(): void {
    // Register each command module
    new WalletCommands(this.program);
    new NetworkCommands(this.program);
    // Add other command modules here...
  }

  public async run(args: string[]): Promise<void> {
    // Show help if no commands provided
    if (args.length <= 2) {
      this.program.outputHelp();
      return;
    }

    await this.program.parseAsync(args);
  }
}
