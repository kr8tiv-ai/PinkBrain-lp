# PinkBrain LP

Fee-compounding liquidity management app for the Bags.fm ecosystem.

## Overview

PinkBrain LP automates the conversion of Bags.fm fee income into permanently locked Meteora DAMM v2 liquidity positions. The core loop: **claim fees → swap into two user-selected tokens → add liquidity → permanently lock → claim LP fees → distribute or re-compound.**

## Features

- **7 SOL Fee Threshold**: System only triggers claiming when fees accrue to at least 7 SOL
- **Automatic Compounding**: Claim → Swap → Add Liquidity → Lock
- **Permanent Locking**: Uses Meteora DAMM v2 for irreversible liquidity locking
- **Flexible Token Selection**: Users can select any two SPL tokens
- **Distribution Options**: Owner-only or Top-100 holders

## Tech Stack

- **Blockchain**: Solana
- **LP Protocol**: Meteora DAMM v2
- **RPC Provider**: Helius
- **Platform**: Bags.fm App Store
- **Backend**: Node.js + TypeScript
- **Frontend**: React

## Project Structure

```
pinkbrain-lp/
├── backend/           # Node.js API server
│   ├── src/
│   │   ├── clients/   # External API clients
│   │   ├── services/  # Business logic
│   │   ├── types/     # TypeScript definitions
│   │   └── config/    # Configuration
│   └── tests/
├── frontend/          # React UI (Phase 3)
└── .planning/         # GSD planning documents
```

## Getting Started

### Prerequisites

- Node.js >= 20.0.0
- npm or yarn
- Bags.fm API Key
- Helius API Key (optional, for enhanced RPC)

### Installation

```bash
# Clone the repository
git clone https://github.com/kr8tiv-ai/PinkBrain-lp.git
cd PinkBrain-lp

# Install dependencies
npm install

# Copy environment template
cp .env.example .env
# Edit .env with your API keys
```

### Configuration

Edit `.env` with your credentials:

```env
BAGS_API_KEY=your_bags_api_key
HELIUS_API_KEY=your_helius_api_key  # optional
FEE_THRESHOLD_SOL=7  # minimum SOL to trigger claiming
```

### Development

```bash
# Run backend in development mode
npm run backend

# Run tests
npm test
```

## Documentation

- [PROJECT.md](./.planning/PROJECT.md) - Full project context
- [REQUIREMENTS.md](./.planning/REQUIREMENTS.md) - Detailed requirements
- [ROADMAP.md](./.planning/ROADMAP.md) - Implementation roadmap

## License

MIT

## Links

- [Bags.fm](https://bags.fm)
- [Bags Hackathon](https://bags.fm/hackathon)
- [Meteora Docs](https://docs.meteora.ag)
- [Helius Docs](https://docs.helius.dev)
- [Solana Docs](https://solana.com/docs)
