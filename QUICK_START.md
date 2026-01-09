# Quick Start Guide

Get LawAI up and running in 5 minutes.

## Prerequisites

- Node.js 18+ installed
- PostgreSQL 14+ installed and running
- OpenAI API key ([Get one here](https://platform.openai.com/api-keys))

## Setup Steps

### 1. Install Dependencies

```bash
npm install
```

### 2. Set Up Database

Create a PostgreSQL database:

```bash
createdb lawai
```

### 3. Configure Environment

Copy `.env.example` to `.env` and fill in your values:

```bash
cp .env.example .env
```

Edit `.env`:
- Set `DATABASE_URL` to your PostgreSQL connection string
- Generate `NEXTAUTH_SECRET` with: `openssl rand -base64 32`
- Add your `OPENAI_API_KEY`

### 4. Initialize Database

```bash
# Run migrations
npm run db:migrate

# Seed initial data (creates admin and staff users)
npm run db:seed
```

### 5. Start Development Server

```bash
npm run dev
```

### 6. Access the Application

Visit [http://localhost:3000](http://localhost:3000)

**Default Credentials:**
- **Admin**: `admin@lawai.example` / `admin123`
- **Staff**: `staff@lawai.example` / `staff123`

⚠️ **Change these passwords immediately in production!**

## What's Next?

### For Staff Users
1. Log in with staff credentials
2. Navigate to **Chat** to interact with the AI agent
3. View **History** to see past conversations
4. Upload **Documents** (coming soon)

### For Admin Users
1. Log in with admin credentials
2. View **Dashboard** for system metrics
3. Manage **Users** - create new staff/admin accounts
4. Review **Audit Logs** for system activity
5. Configure **Settings** for system parameters

## Troubleshooting

### Database Connection Issues
- Verify PostgreSQL is running: `pg_isready`
- Check DATABASE_URL format: `postgresql://user:password@host:port/database`
- Ensure database exists: `psql -l | grep lawai`

### Authentication Issues
- Verify NEXTAUTH_SECRET is set
- Check NEXTAUTH_URL matches your app URL
- Clear browser cookies and try again

### OpenAI API Issues
- Verify OPENAI_API_KEY is correct
- Check API key has sufficient quota
- Review error messages in browser console

## Development Commands

```bash
# Run development server
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Database management
npm run db:migrate    # Run migrations
npm run db:studio     # Open Prisma Studio
npm run db:seed       # Seed database
npm run db:reset      # Reset database (WARNING: deletes all data)
```

## Project Structure

```
lawai/
├── app/              # Next.js pages and API routes
├── components/       # React components
├── lib/             # Core logic and utilities
├── prisma/          # Database schema
└── types/           # TypeScript definitions
```

## Need Help?

- Check the main [README.md](./README.md) for detailed documentation
- Review Prisma schema in `prisma/schema.prisma`
- Check API routes in `app/api/`
