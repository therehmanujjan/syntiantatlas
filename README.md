# SYNTIANT ATLAS

## Project Overview
SYNTIANT ATLAS is a comprehensive platform integrating a fractional real estate investment system (FREIP) with a modern landing page and administrative capabilities.

### Components
1. **Landing Page** (Port 3000)
   - Modern Next.js frontend
   - Showcase for properties and platform features
   - Integrated with FREIP backend for registration

2. **FREIP System** (Fractional Real Estate Investment Platform)
   - **Frontend** (Port 3001): Next.js dashboard for investors/sellers
   - **Backend** (Port 5000): Node.js/Express API with PostgreSQL (Neon DB)

## Quick Start

### Prerequisites
- Node.js (v18+)
- npm

### Installation & Run
Run the all-in-one startup script to launch all services concurrently:

```bash
./start_all.sh
```

This will start:
- Landing Page: http://localhost:3000
- FREIP Frontend: http://localhost:3001
- FREIP Backend: http://localhost:5000

## Database
The project uses **Neon PostgreSQL**.
- **Schema Setup:** `npm run setup-db` (in backend folder)
- **Configuration:** Check `.env` files in `backend/`

## Documentation
- [Implementation Plan](IMPLEMENTATION_SUMMARY.md)
- [API Documentation](API_DOCUMENTATION.md)
