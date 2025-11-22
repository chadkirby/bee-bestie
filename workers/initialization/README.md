# Bee Bestie Initialization Worker

A dedicated Cloudflare Worker for managing database initialization, migration, and seeding of the bee-bestie Spelling Bee puzzle data.

## Why This Worker Exists

This worker centralizes all database infrastructure management that was previously scattered across the main `app/` directory. It provides:

- **Single source of truth** for database operations
- **Safe atomic rebuilds** of the entire database
- **Separation of concerns** from the main application logic
- **CLI and API interfaces** for both automated and manual operations

## Features

- **Database Migration**: Create and update database schema
- **Data Seeding**: Populate database with puzzle data from JSONL files
- **Complete Rebuild**: Atomic rebuild of entire database infrastructure
- **Batch Processing**: Efficient processing of large datasets
- **Safety Controls**: Dry-run mode and confirmation requirements
- **Status Monitoring**: Check database health and statistics

## API Endpoints

### `GET /`
Service information and available endpoints.

### `POST /migrate`
Run database migration to create/update schema.

**Response:**
```json
{
  "success": true,
  "message": "Database migration completed successfully. Executed 10 statements."
}
```

### `POST /seed`
Seed database with puzzle data.

**Request Body:** JSONL content from games.jsonl file

**Query Parameters:**
- `dryRun=true` - Preview what would be processed without making changes
- `batchSize=1000` - Number of statements to execute in each batch

**Response:**
```json
{
  "success": true,
  "message": "Database seeded successfully. Processed 1000 puzzles and 25000 word mappings in 15 batches.",
  "result": {
    "totalPuzzles": 1000,
    "totalWordMappings": 25000,
    "batchesProcessed": 15
  }
}
```

### `POST /rebuild`
Complete database rebuild (migration + seeding).

**Query Parameters:**
- `confirmDestructive=true` - Required confirmation for destructive operation
- `dryRun=true` - Preview rebuild without making changes
- `batchSize=1000` - Batch size for processing

**Response:**
```json
{
  "success": true,
  "message": "Database rebuild completed successfully.",
  "steps": [
    {
      "step": "Migration",
      "success": true,
      "message": "Database migration completed successfully."
    },
    {
      "step": "Seeding",
      "success": true,
      "message": "Database seeded successfully."
    }
  ]
}
```

### `GET /status`
Check database connectivity and table statistics.

**Response:**
```json
{
  "database": "connected",
  "tables": {
    "puzzles": {
      "exists": true,
      "count": 1500
    },
    "word_dates": {
      "exists": true,
      "count": 45000
    }
  }
}
```

## Quick Start

### 1. Local Development
```bash
cd workers/initialization
npm install
npm run dev
```

The worker will be available at `http://localhost:8787`

### 2. Test the Setup
```bash
# Check worker is running
curl http://localhost:8787/

# Check database connectivity
curl http://localhost:8787/status
```

### 3. Run Your First Operation
```bash
# Test migration (safe - creates schema)
curl -X POST http://localhost:8787/migrate

# Test seeding with actual project data (dry run - safe)
curl -X POST "http://localhost:8787/seed?dryRun=true" \
  --data-binary @data/games.jsonl
```

## Usage Examples

### Database Migration
```bash
# Deploy worker and run migration
npm run deploy
curl -X POST https://bee-bestie-initialization.workers.dev/migrate
```

### Seed Database from games.jsonl
```bash
# Dry run first
curl -X POST "https://bee-bestie-initialization.workers.dev/seed?dryRun=true" \
  --data-binary @data/games.jsonl

# Actual seeding
curl -X POST https://bee-bestie-initialization.workers.dev/seed \
  --data-binary @data/games.jsonl
```

### Complete Database Rebuild
```bash
# Dry run rebuild (always do this first!)
curl -X POST "https://bee-bestie-initialization.workers.dev/rebuild?dryRun=true" \
  --data-binary @data/games.jsonl

# Actual rebuild (requires confirmation - DANGEROUS!)
curl -X POST "https://bee-bestie-initialization.workers.dev/rebuild?confirmDestructive=true" \
  --data-binary @data/games.jsonl
```

### Using the Project's Data
```bash
# Rebuild everything using the project's data/games.jsonl
curl -X POST "http://localhost:8787/rebuild?dryRun=true" \
  --data-binary @data/games.jsonl

# Seed only (no migration)
curl -X POST "http://localhost:8787/seed?dryRun=true" \
  --data-binary @data/games.jsonl
```

### Check Status
```bash
curl https://bee-bestie-initialization.workers.dev/status
```

## Development Commands

```bash
cd workers/initialization

# Development
npm run dev          # Start local development server (localhost:8787)
npm run deploy       # Deploy to Cloudflare Workers
npm run build        # TypeScript type checking

# Database Operations (CLI alternatives)
npm run migrate      # Run migration using Wrangler CLI directly
wrangler d1 execute bee-puzzles --local --file=migration.sql  # Local DB migration
```

## Configuration

The worker is configured in `wrangler.jsonc` with:
- **D1 Database**: `BEE_PUZZLES` binding to `bee-puzzles` database
- **R2 Bucket**: `BEE_BUCKET` binding to `bee-data` bucket
- **Node.js Compatibility**: Required for `fs/promises` module usage

## Database Schema

The database contains these tables (defined in `migration.sql`):

- **`puzzles`**: Daily puzzle data (date, center letter, outer letters)
- **`word_dates`**: Reverse mapping of words to puzzle dates
- **`hyphenates`**: Hyphenated word variants
- **`word_frequencies`**: Word frequency statistics

## Safety Features

- **🔍 Dry Run Mode**: Preview operations without executing changes
- **⚠️ Confirmation Required**: Destructive operations need `confirmDestructive=true`
- **📦 Batch Processing**: Large datasets processed in configurable batches
- **🚨 Error Handling**: Comprehensive error reporting and step-by-step feedback
- **🌐 CORS Support**: Cross-origin requests supported for web integration
- **📊 Status Monitoring**: Real-time database health and statistics

## File Structure

```
workers/initialization/
├── src/
│   ├── index.ts              # Main worker with API endpoints
│   ├── handlers/             # Operation handlers
│   │   ├── migrate.ts        # Database migration logic
│   │   ├── seed.ts           # Data seeding logic
│   │   └── rebuild.ts        # Complete rebuild orchestration
│   └── utils/
│       └── data-processing.ts # Data parsing and SQL generation
├── data/
│   └── games.jsonl           # Source puzzle data (JSONL format)
├── migration.sql             # Database schema definition
├── wrangler.jsonc           # Cloudflare Workers configuration
├── package.json             # Dependencies and scripts
└── README.md                # This documentation
```