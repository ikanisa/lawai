# Database Setup Guide - Supabase

## Current Status

Your Supabase database is configured with:
- **URL**: `https://uskfnszcdqpcfrhjxitl.supabase.co`
- **Database**: PostgreSQL at `db.uskfnszcdqpcfrhjxitl.supabase.co:5432`
- **Connection**: Configured in `.env` file

## Setup Options

### Option 1: Clean Database (Recommended for Fresh Start)

If you want to start completely fresh:

```bash
# Connect to Supabase and clean database
psql "postgresql://postgres:172Ul0q1BGSlkCPz@db.uskfnszcdqpcfrhjxitl.supabase.co:5432/postgres" -f scripts/clean-database.sql

# Then push new schema
npm run db:push
```

### Option 2: Use Prisma Migrations (Recommended for Production)

```bash
# Create and apply migration
npm run db:migrate

# This will:
# 1. Create migration files
# 2. Apply to database
# 3. Generate Prisma client
```

### Option 3: Direct Push (Quick Start)

```bash
# Push schema directly (will create tables)
npm run db:push
```

**Note**: If you get errors about existing tables, use Option 1 first to clean the database.

## After Database Setup

### 1. Seed Initial Data

```bash
npm run db:seed
```

Creates:
- Admin: `admin@lawai.example` / `admin123`
- Staff: `staff@lawai.example` / `staff123`

### 2. Verify Setup

```bash
# Open Prisma Studio to view database
npm run db:studio
```

### 3. Start Application

```bash
npm run dev
```

## Troubleshooting

### Error: Existing Tables

If you see errors about existing tables:

1. **Clean database first**:
   ```bash
   psql "postgresql://postgres:172Ul0q1BGSlkCPz@db.uskfnszcdqpcfrhjxitl.supabase.co:5432/postgres" -f scripts/clean-database.sql
   ```

2. **Then push schema**:
   ```bash
   npm run db:push
   ```

### Error: Connection Refused

- Verify Supabase project is active
- Check database password is correct
- Verify connection string format

### Error: Schema Conflicts

- Use `db:push` for development (overwrites)
- Use `db:migrate` for production (versioned)

## Database Schema

After setup, you'll have 7 tables:

1. `users` - User accounts
2. `cases` - Legal cases
3. `documents` - Case documents
4. `chat_sessions` - Chat sessions
5. `chat_messages` - Chat messages
6. `audit_logs` - System logs
7. `system_settings` - Configuration

## Next Steps

1. ✅ Database configured
2. ⏳ Run database setup (choose option above)
3. ⏳ Seed initial data
4. ⏳ Add OpenAI API key
5. ⏳ Start development server
