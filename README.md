# Web3 CLI Tool

A comprehensive command-line interface tool for managing Web3 operations, including wallet management, smart contract interactions, and blockchain network operations.

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue)](https://www.typescriptlang.org/)

## Features

- 🔐 Secure wallet management (create, import, export)
- 🌐 Multi-network support (Ethereum, Bitcoin, Solana, Tezos)
- 📜 Smart contract deployment and interaction
- 💼 Token transactions and management
- 📊 Blockchain data querying
- 🔍 Comprehensive logging and debugging
- 🛠️ Utility functions (encryption, QR code generation)

## Installation

```bash
# Using npm
npm install -g web3-cli-tool

# Or clone the repository
git clone https://github.com/username/web3-cli-tool.git
cd web3-cli-tool
npm install
```

## Quick Start

1. Set up your environment:

```bash
cp .env.example .env
```

2. Edit `.env` with your configuration:

```env
ETHEREUM_RPC_URL=your_ethereum_rpc_url
BITCOIN_RPC_URL=your_bitcoin_rpc_url
SOLANA_RPC_URL=your_solana_rpc_url
```

3. Create your first wallet:

```bash
npm run dev -- wallet create --name my-wallet --network ethereum --mnemonic
```

## Project Structure

```
.
├── LICENSE
├── README.md
├── artifacts
│   ├── contracts
│   ├── transactions
│   └── wallets
├── config
│   ├── networks.json
│   └── tsconfig
├── logs
│   ├── combined.log
│   ├── debug
│   ├── error
│   └── info
├── src
│   ├── commands
│   ├── config
│   ├── core
│   ├── lib
│   ├── types
│   └── utils
└── tests
    ├── e2e
    ├── integration
    └── unit
```

## Usage

### Wallet Management

```bash
# Create a single wallet
wallet create --name <name> --network <network> --mnemonic --security <strong|default> --output <json|csv> --path <file_path>

# Create multiple wallets
wallet create-multiple --name <base_name> --network <network> --mnemonic --security <strong|default> --output <json|csv> --number <count> --path <file_path>

# List wallets
wallet list --network <network>

# Export wallet
wallet export --name <name> --format <json|csv> --path <file_path>

# Import wallet
wallet import --file <file_path> --network <network>

# Delete wallet
wallet delete --name <name> --network <network>
```

### Network Management

```bash
# List available networks
network list

# Add new network
network add --name <network_name> --rpc-url <rpc_url>

# Switch network
network switch --name <network_name>

# Check network status
network status --network <network_name>
```

### Cryptocurrency Transactions

```bash
# Check wallet balance
wallet balance --name <wallet_name> --network <network>

# Send tokens
token send --from <wallet_name> --to <address> --amount <value> --token <token_symbol> --network <network>

# Receive tokens
token receive --name <wallet_name> --network <network>

# Approve token spending
token approve --spender <address> --amount <value> --token <token_symbol> --network <network>
```

### Smart Contract Operations

```bash
# Deploy contract
contract deploy --name <contract_name> --network <network> --file <contract_file>

# Call contract method
contract call --address <contract_address> --method <method_name> --args <arg1,arg2,...> --network <network>

# Read contract data
contract read --address <contract_address> --method <method_name> --network <network>
```

### Blockchain Information

```bash
# Get block info
info block --number <block_number> --network <network>

# Get transaction details
info transaction --hash <transaction_hash> --network <network>

# Check gas prices
info gas-price --network <network>

# View address activity
info activity --address <wallet_address> --network <network>
```

### NFT Operations (Coming Soon)

```bash
# Mint NFT
nft mint --contract <contract_address> --uri <metadata_uri> --network <network>

# Transfer NFT
nft transfer --token-id <token_id> --from <wallet_name> --to <address> --contract <contract_address> --network <network>

# Get NFT metadata
nft metadata --token-id <token_id> --contract <contract_address> --network <network>

# List NFTs owned by wallet
nft list --wallet <wallet_name> --network <network>
```

### DeFi Operations (Coming Soon)

```bash
# Swap tokens
defi swap --from-token <token_symbol> --to-token <token_symbol> --amount <value> --wallet <wallet_name> --network <network>

# Provide liquidity
defi liquidity add --pool <pool_address> --token-a <token_a_amount> --token-b <token_b_amount> --wallet <wallet_name> --network <network>

# Remove liquidity
defi liquidity remove --pool <pool_address> --amount <lp_token_amount> --wallet <wallet_name> --network <network>
```

### Utility Functions

```bash
# Encrypt data
util encrypt --data <string>

# Decrypt data
util decrypt --data <encrypted_string>

# Generate QR code
util qr-code --address <wallet_address>
```

### Logging and Debugging

```bash
# Show logs
logs show --level <info|warn|error> --tail <lines>

# Clear logs
logs clear
```

## Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Support

- Documentation: [Link to docs]
- Issues: [GitHub Issues]
- Discord: [Discord Invite Link]
