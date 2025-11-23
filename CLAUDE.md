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

### Workers
- **Bee Cron Worker**: `cd workers/bee-cron && npm run dev` - Local development with scheduled event testing
- **Bee Cron Deploy**: `cd workers/bee-cron && npm run deploy` - Deploy cron worker to Cloudflare
- **Initialization Worker**: `cd workers/initialization && npm run migrate` - Run database migrations
- **Initialization Deploy**: `cd workers/initialization && npm run deploy` - Deploy initialization worker

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
├── workers/bee-cron/      # Scheduled data collection worker
├── workers/initialization/ # Database initialization worker
└── docs/                  # Project documentation and plans
```

### Core Components

**Main Application Worker** (`app/src/worker/index.ts`):
- HTTP API endpoints: `/puzzle/:date` (puzzle data), `/puzzle/:date/word-stats` (word statistics), `/word` (word history lookup)
- Integrates with D1 database for historical puzzle data
- Serves pre-computed word statistics from R2 bucket storage
- Combines official NYT answers with statistical analysis from word frequency library
- Progressive loading strategy with separate fast/slow data endpoints

**Frontend Application** (`app/src/ui/App.tsx`):
- React 19 SPA with TypeScript and router-based navigation
- Real-time puzzle loading and display with progressive loading
- Interactive letter grid and answer exploration
- Word statistics and frequency analysis visualization
- Mobile-responsive design using Tailwind CSS and shadcn/ui components
- Rich word exploration UI with sorting and filtering capabilities

**Word Frequency Library** (`lib/word-freqs/`):
- **Prefix Trie**: Efficient word lookup and Spelling Bee puzzle solving
- **Statistical Analysis**: Word frequency, commonality scoring, probability calculations
- **Phonotactic Scoring**: Advanced linguistic analysis models
- **Compressed Storage**: Uses MessagePack for efficient data storage in R2
- **Puzzle Solving**: Generates candidate words for given letter combinations
- **Testing**: Vitest unit tests for core functionality

**Puzzle Library** (`lib/puzzle/`):
- TypeScript interfaces and Zod schemas for puzzle data
- Type definitions for `OnePuzzle`, `DBPuzzle`, `NYTPuzzleData`
- Validation and serialization utilities
- Database manager utilities for D1 operations

**Bee Cron Worker** (`workers/bee-cron/`):
- Scheduled data collection from NYT Spelling Bee
- Populates D1 database with historical puzzle data
- Automated daily puzzle scraping and storage

**Initialization Worker** (`workers/initialization/`):
- Database setup and migrations for D1
- Initial data seeding and schema management

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
- **Frontend**: React 19, TypeScript, Tailwind CSS, shadcn/ui, React Router DOM v7
- **Backend**: TypeScript, Zod validation, D1 SQLite database
- **Build**: Vite with Cloudflare plugin, pnpm workspaces
- **Storage**: D1 database, R2 object storage
- **Testing**: Vitest for unit tests (currently in word-freqs library)
- **Data Processing**: MessagePack compression, natural language processing (compromise)
- **Statistics**: Simple-statistics library for analysis
- **Node.js**: 22.21.1 (via Volta), pnpm 10.22.0

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
- Advanced sorting and exposure controls for puzzle answers
- TableControls component for consolidated UI controls

### Key Configuration Files

- **`wrangler.jsonc`**: Cloudflare Workers configuration with D1, R2, AI, and Browser bindings
- **`vite.config.ts`**: Build configuration with Cloudflare plugin and path aliases
- **`pnpm-workspace.yaml`**: Monorepo workspace configuration with shared dependency catalog (catalogMode: prefer)
- **`tsconfig.json`**: TypeScript configuration with path mappings for clean imports
- **`.editorconfig`**: Code formatting standards
- **`.prettierrc`**: Prettier configuration for code formatting