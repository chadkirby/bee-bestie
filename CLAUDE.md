# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

- **Development mode**: `npm run dev` - Starts Vite development server with Cloudflare Workers
- **Build**: `npm run build` - Builds the project for production
- **Preview**: `npm run preview` - Builds and previews the production build locally
- **Deploy**: `npm run deploy` - Builds and deploys to Cloudflare Workers

## Project Architecture

This is a Cloudflare Workers application that demonstrates Stagehand (web automation) integration with AI. The project has a hybrid architecture:

### Core Components

**Worker (`src/worker/index.ts`)**:
- Main Cloudflare Worker entry point handling WebSocket connections
- Uses Stagehand with Playwright for browser automation
- Integrates with Cloudflare Workers AI for LLM capabilities
- Extracts movie information from a demo website using AI-powered web scraping

**Frontend (`src/ui/`)**:
- React application that communicates with the Worker via WebSocket
- Displays real-time logs, screenshots, and extracted movie data
- Shows screencast of the browser automation process

### Key Technical Details

**Vite Configuration**:
- Uses `@cloudflare/vite-plugin` for Workers integration
- Critical alias: `'playwright': '@cloudflare/playwright'` required for Stagehand compatibility

**AI Integration**:
- Custom `WorkersAIClient` implements Stagehand's `LLMClient` interface
- Uses `@cf/meta/llama-3.3-70b-instruct-fp8-fast` model by default
- Can be configured to use other models (OpenAI, etc.) with environment variables

**Stagehand Workflow**:
1. Initializes browser using Cloudflare's browser binding
2. Navigates to demo movie site
3. Uses AI to observe and act on page elements
4. Extracts structured data using Zod schemas
5. Streams screenshots and logs via WebSocket

**Environment Bindings** (configured in `wrangler.jsonc`):
- `BROWSER`: Cloudflare browser rendering binding
- `AI`: Cloudflare Workers AI binding

## File Structure

- `src/worker/index.ts` - Main worker with WebSocket handling and Stagehand automation
- `src/worker/workersAIClient.ts` - Custom LLM client for Workers AI
- `src/worker/screencast.ts` - Screencast streaming functionality
- `src/ui/App.tsx` - React frontend for displaying results
- `src/ui/main.tsx` - React app entry point
- `vite.config.ts` - Vite configuration with Cloudflare plugin
- `wrangler.jsonc` - Cloudflare Workers configuration
- `worker-configuration.d.ts` - TypeScript definitions for environment

## Development Notes

- The application requires Cloudflare environment bindings (browser and AI)
- WebSocket communication handles real-time updates between worker and frontend
- Stagehand uses Zod schemas for structured data extraction
- Screencast functionality provides visual feedback during automation