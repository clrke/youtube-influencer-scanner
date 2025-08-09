# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a YouTube Influencer Scanner CRM - a web application that automatically discovers YouTube influencers by scraping videos on specific topics every 4 hours, then provides a CRM-like interface for sales teams to manage outreach efforts. Built with Next.js 15, React 19, TypeScript, and Prisma ORM.

## Essential Commands

### Development
```bash
npm run dev           # Start development server with Turbopack
npm run build         # Build for production
npm run start         # Start production server
npm run lint          # Run ESLint
```

### Database Operations
```bash
npm run db:generate   # Generate Prisma client after schema changes
npm run db:push       # Push schema changes to database
npm run db:seed       # Run database seeding (if seed file exists)
```

### Docker Operations
```bash
docker-compose up -d  # Start application in containers
docker-compose down   # Stop containers
```

## Architecture Overview

### Core Systems

1. **YouTube Scraping System**: Uses Puppeteer for headless browser automation to scrape YouTube without API keys. Located in `lib/youtube-scraper.ts`.

2. **Automated Scheduling**: `lib/scheduler.ts` manages cron-based searches every 4 hours using node-cron. The `SearchScheduler` singleton handles multiple topic searches and maintains active cron tasks.

3. **Database Layer**: Prisma ORM with SQLite backend. Database connection singleton in `lib/db.ts`.

### Key Data Flow

1. **Search Topics** → **Automated Searches** → **Videos** → **Influencers** → **Outreach Tracking**
2. Search scheduler runs `performSearch()` which:
   - Scrapes YouTube for recent videos (last 24 hours)
   - Creates/updates Influencer records
   - Associates Videos with Searches and Influencers
   - Handles channel metadata extraction

### Database Schema Structure

- **SearchTopic**: User-defined search keywords with active/inactive status
- **Search**: Historical search executions with result counts
- **Influencer**: YouTube channels with CRM status tracking (NEW → CONTACTED → RESPONDED → CONVERTED)
- **Video**: Individual videos linked to searches and influencers
- **Outreach**: Communication history with influencers
- **Tag**: Categorization system for influencers

### API Architecture

RESTful API routes in `app/api/`:
- `/topics` - CRUD operations for search topics, includes scheduler start/stop
- `/influencers` - Paginated influencer listing with filters and status updates
- `/influencers/[id]/outreach` - Outreach message creation (auto-updates status)
- `/analytics` - Performance metrics and trend data

### Component Architecture

- **InfluencerCard**: Individual influencer management with status workflow
- **TopicManager**: Search topic CRUD with scheduler controls
- **Analytics**: Performance dashboard with charts (Recharts)

### Scraping Configuration

Environment variables control scraping behavior:
- `SEARCH_INTERVAL_HOURS=4` - Frequency of automated searches
- `HEADLESS_BROWSER=true` - Puppeteer headless mode
- `SCRAPE_DELAY_MS=2000` - Delay between operations to avoid rate limiting

### Status Workflow

Influencers progress through: NEW → CONTACTED → RESPONDED → NEGOTIATING → CONVERTED
Alternative paths: NOT_INTERESTED, BLACKLISTED

## Development Notes

### When Making Database Changes
Always run `npm run db:generate && npm run db:push` after modifying `prisma/schema.prisma`.

### Scheduler Behavior
The scheduler automatically starts for active topics when the application boots. Each topic maintains its own cron task that can be independently started/stopped.

### Scraping Considerations
The YouTube scraper uses CSS selectors and may need updates if YouTube changes their DOM structure. Rate limiting is handled via configurable delays between requests.

### Docker Deployment
The application includes Chrome/Chromium in the Docker container for Puppeteer. Database file is mounted as a volume for persistence.