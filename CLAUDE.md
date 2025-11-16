# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Main Application (app/)
- **Development mode**: `cd app && npm run dev` - Starts Vite development server with Cloudflare Workers
- **Build**: `cd app && npm run build` - Builds the project for production
- **Preview**: `cd app && npm run preview` - Builds and previews the production build locally
- **Deploy**: `cd app && npm run deploy` - Builds and deploys to Cloudflare Workers

### Workspace Commands
- **Install all dependencies**: `pnpm install` (run from root)
- **Build all packages**: `pnpm -r build` - Builds all workspace packages
- **Watch mode**: `npm run watch` (from root) - Runs watch mode for all libraries
- **Run tests**: `cd lib/word-freqs && npm test` - Runs word frequency library tests

### Cron Worker (workers/cron/)
- **Development**: `cd workers/cron && npm run dev` - Local development with scheduled event testing
- **Deploy**: `cd workers/cron && npm run deploy` - Deploy cron worker to Cloudflare

## Project Architecture

This is a **monorepo** using pnpm workspaces that implements a **Spelling Bee puzzle companion tool** with advanced word analysis capabilities. The architecture combines multiple specialized packages into a cohesive application deployed on Cloudflare Workers.

### Workspace Structure

```
bee-bestie/
├── app/                    # Main Cloudflare Workers application
│   ├── src/worker/        # Backend worker with API endpoints
│   └── src/ui/            # React frontend application
├── lib/puzzle/            # Puzzle data schemas and types
├── lib/word-freqs/        # Word frequency analysis and trie data structure
├── workers/cron/          # Scheduled data collection worker
└── docs/                  # Project documentation and plans
```

### Core Components

**Main Application Worker** (`app/src/worker/index.ts`):
- HTTP API endpoints: `/date` (puzzle data), `/word` (word statistics)
- Integrates with D1 database for historical puzzle data
- Serves pre-computed word statistics from R2 bucket storage
- Combines official NYT answers with statistical analysis from word frequency library

**Frontend Application** (`app/src/ui/App.tsx`):
- React 19 application with TypeScript
- Real-time puzzle loading and display
- Interactive letter grid and answer exploration
- Word statistics and frequency analysis visualization
- Mobile-responsive design using Tailwind CSS and shadcn/ui components

**Word Frequency Library** (`lib/word-freqs/`):
- **Prefix Trie**: Efficient word lookup and Spelling Bee puzzle solving
- **Statistical Analysis**: Word frequency, commonality scoring, probability calculations
- **Compressed Storage**: Uses MessagePack for efficient data storage in R2
- **Puzzle Solving**: Generates candidate words for given letter combinations

**Puzzle Library** (`lib/puzzle/`):
- TypeScript interfaces and Zod schemas for puzzle data
- Type definitions for `OnePuzzle`, `DBPuzzle`, `NYTPuzzleData`
- Validation and serialization utilities

**Cron Worker** (`workers/cron/`):
- Scheduled data collection from NYT Spelling Bee
- Populates D1 database with historical puzzle data
- Automated daily puzzle scraping and storage

### Data Architecture

**Three-Tier Storage System**:
1. **D1 Database**: Historical puzzle metadata, word appearance tracking
2. **R2 Bucket**: Pre-computed word statistics and compressed trie data
3. **In-Memory**: Real-time puzzle solving and candidate generation

**API Design**:
- RESTful endpoints with Zod-validated responses
- Structured error handling and comprehensive response schemas
- Integration between real-time data and historical analysis

### Technology Stack

- **Runtime**: Cloudflare Workers with Node.js compatibility
- **Frontend**: React 19, TypeScript, Tailwind CSS, shadcn/ui
- **Backend**: TypeScript, Zod validation, D1 SQLite database
- **Build**: Vite with Cloudflare plugin, pnpm workspaces
- **Storage**: D1 database, R2 object storage
- **Testing**: Vitest for unit tests (currently in word-freqs library)

### Development Patterns

**Type Safety**: Full TypeScript coverage with Zod schemas for runtime validation
**Workspace Management**: pnpm workspaces with shared dependency catalog
**Path Aliases**: `@lib/*` imports for clean cross-package references
**Environment Configuration**: Cloudflare bindings configured in `wrangler.jsonc`

### Current Development Focus

The project is currently implementing the **Word Explorer** feature (Phase 1) as outlined in `docs/word-explorer-plan.md`. This involves:

- Rich word exploration UI with statistics and filtering
- Integration of word frequency data with puzzle answers
- Mobile-friendly card-based layout for word statistics
- Historical Spelling Bee context and word analysis

### Key Configuration Files

- **`wrangler.jsonc`**: Cloudflare Workers configuration with D1, R2, AI, and Browser bindings
- **`vite.config.ts`**: Build configuration with Cloudflare plugin and path aliases
- **`pnpm-workspace.yaml`**: Monorepo workspace configuration with shared dependency catalog
- **`tsconfig.json`**: TypeScript configuration with path mappings for clean imports