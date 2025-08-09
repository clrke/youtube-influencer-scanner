# YouTube Influencer Scanner CRM

A comprehensive web application that automatically discovers YouTube influencers by scraping videos on specific topics every 4 hours, then provides a CRM-like interface for sales teams to manage outreach efforts.

## 🚀 Features

- **Automated YouTube Scraping**: No API keys needed - scrapes YouTube for videos from the last 24 hours
- **Smart Scheduling**: Searches every 4 hours for fresh influencer content
- **CRM Interface**: Professional dashboard for managing influencer relationships
- **Status Tracking**: Track outreach progress from "New" to "Converted"
- **Analytics Dashboard**: Monitor conversion rates, response times, and performance metrics
- **Topic Management**: Add/remove search topics with individual controls
- **Mobile Responsive**: Works seamlessly on desktop and mobile devices

## 📋 Prerequisites

- Node.js 18+ 
- npm or yarn
- Docker (optional, for containerized deployment)

## 🛠️ Installation

### Option 1: Local Development

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Initialize database**:
   ```bash
   npm run db:generate
   npm run db:push
   ```

3. **Start development server**:
   ```bash
   npm run dev
   ```

4. **Open application**: Navigate to `http://localhost:3697`

### Option 2: Docker Deployment

1. **Deploy with Docker Compose**:
   ```bash
   docker-compose up -d
   ```

2. **Access application**: Open `http://localhost:3697`

## 📖 Usage Guide

### Getting Started

1. **Add Search Topics**: 
   - Navigate to the "Topics" tab
   - Click "Add Topic" 
   - Enter keywords like "meta quest", "AI tools", "react tutorial"
   - Topics will automatically start searching every 4 hours

2. **Manage Influencers**:
   - View discovered influencers in the "Influencers" tab
   - Filter by status, search by name
   - Click influencer cards to view details

3. **Track Outreach**:
   - Use the "Reach Out" button on new influencers
   - Update status as conversations progress
   - Add notes for team collaboration

4. **Monitor Performance**:
   - Check the "Analytics" tab for insights
   - Track conversion rates and response times
   - Identify top-performing topics

### Status Workflow

- **New**: Freshly discovered influencer
- **Contacted**: Outreach message sent
- **Responded**: Influencer replied
- **Negotiating**: In active discussions
- **Converted**: Successful partnership
- **Not Interested**: Declined collaboration
- **Blacklisted**: Do not contact

## 🏗️ Architecture

### Tech Stack

- **Frontend**: Next.js 15, React 19, TypeScript, Tailwind CSS
- **Backend**: Next.js API Routes, Prisma ORM
- **Database**: SQLite (easily replaceable)
- **Scraping**: Puppeteer (headless browser automation)
- **Charts**: Recharts
- **Scheduling**: node-cron
- **Icons**: Lucide React

## ⚠️ Disclaimer

This tool is for legitimate business outreach purposes only. Users are responsible for:
- Complying with YouTube's Terms of Service
- Respecting influencer privacy and communication preferences
- Following anti-spam regulations (CAN-SPAM Act, GDPR, etc.)
- Using reasonable scraping delays to avoid service disruption

---

**Built with ❤️ for ethical influencer marketing**
