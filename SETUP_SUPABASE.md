# Supabase Setup Guide

## Database Configuration

Your Supabase database is already configured. Use these credentials:

### Connection String
```
postgresql://postgres:172Ul0q1BGSlkCPz@db.uskfnszcdqpcfrhjxitl.supabase.co:5432/postgres
```

### Supabase URL
```
https://uskfnszcdqpcfrhjxitl.supabase.co
```

## Environment Variables

Create a `.env` file in the root directory with:

```bash
# Database - Supabase PostgreSQL
DATABASE_URL="postgresql://postgres:172Ul0q1BGSlkCPz@db.uskfnszcdqpcfrhjxitl.supabase.co:5432/postgres"

# Supabase (Optional - for future Supabase features)
NEXT_PUBLIC_SUPABASE_URL="https://uskfnszcdqpcfrhjxitl.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVza2Zuc3pjZHFwY2ZyaGp4aXRsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc1MTM4ODksImV4cCI6MjA4MzA4OTg4OX0.xonuiDGearLOS6lxc9Z5F8Lt712nKLEkCyLC4VSzV5U"
SUPABASE_SERVICE_ROLE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVza2Zuc3pjZHFwY2ZyaGp4aXRsIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NzUxMzg4OSwiZXhwIjoyMDgzMDg5ODg5fQ.GSzCMKEuXx8JXYOjwylP_HoNgiQlKbKSnuXG7PK47ts"

# NextAuth
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="[generate-with-openssl-rand-base64-32]"

# OpenAI
OPENAI_API_KEY="sk-..."
OPENAI_MODEL="gpt-4-turbo-preview"
```

## Setup Steps

### 1. Create .env File

```bash
cp .env.example .env
```

Then edit `.env` and add:
- Your `DATABASE_URL` (already provided above)
- Generate `NEXTAUTH_SECRET`: `openssl rand -base64 32`
- Add your `OPENAI_API_KEY`

### 2. Run Database Migrations

```bash
npm run db:migrate
```

This will create all tables in your Supabase database.

### 3. Seed Initial Data

```bash
npm run db:seed
```

This creates:
- Admin user: `admin@lawai.example` / `admin123`
- Staff user: `staff@lawai.example` / `staff123`

### 4. Verify Connection

```bash
npm run db:studio
```

This opens Prisma Studio where you can view your database tables.

### 5. Start Development Server

```bash
npm run dev
```

Visit http://localhost:3000

## Supabase Dashboard

Access your Supabase dashboard at:
https://supabase.com/dashboard/project/uskfnszcdqpcfrhjxitl

## Security Notes

⚠️ **Important Security Reminders:**

1. **Never commit `.env` file** - It's already in `.gitignore`
2. **Service Role Key** - Keep this secret, never expose to client-side
3. **Database Password** - Keep secure, rotate periodically
4. **Change Default Passwords** - Update admin/staff passwords in production

## Troubleshooting

### Connection Issues

If you get connection errors:

1. Verify database is accessible:
   ```bash
   psql "postgresql://postgres:172Ul0q1BGSlkCPz@db.uskfnszcdqpcfrhjxitl.supabase.co:5432/postgres"
   ```

2. Check Supabase dashboard for connection status

3. Verify firewall rules allow connections

### Migration Issues

If migrations fail:

1. Check Prisma schema matches Supabase setup
2. Verify DATABASE_URL is correct
3. Check Supabase logs in dashboard

## Next Steps

1. ✅ Configure `.env` file
2. ✅ Run migrations
3. ✅ Seed database
4. ✅ Test application
5. ✅ Deploy to production
