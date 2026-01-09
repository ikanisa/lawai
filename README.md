# LawAI - AI Agent Portal

A unified, simplified AI agent system for legal assistance with staff interaction and admin management.

## Features

### For Staff
- 💬 AI-powered legal chat interface
- 📚 Access to Francophone legal knowledge
- 📁 Case management (create, view, update cases)
- 📄 Document management
- 📝 Query history and session management
- 🤖 AI case summaries and action suggestions
- 🔒 Secure authentication

### For System Admins
- 👥 User management (create, edit, delete users)
- 📊 System dashboard with key metrics
- 🔍 Audit logs and activity monitoring
- ⚙️ System settings and configuration
- 📁 Full case management (all cases)
- 🤖 Agent system management
- 🤖 Agent system management

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Database**: PostgreSQL with Prisma ORM
- **Authentication**: NextAuth.js
- **AI**: OpenAI GPT-4
- **UI**: TailwindCSS
- **Language**: TypeScript

## Prerequisites

- Node.js 18+
- PostgreSQL 14+
- OpenAI API key

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Environment Setup

Create `.env` file:

```bash
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/lawai"

# NextAuth
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="your-secret-key-here"

# OpenAI
OPENAI_API_KEY="sk-..."
OPENAI_MODEL="gpt-4-turbo-preview"  # Optional
```

### 3. Database Setup

```bash
# Run migrations
npm run db:migrate

# Seed initial data (creates admin and staff users)
npm run db:seed
```

### 4. Run Development Server

```bash
npm run dev
```

Visit http://localhost:3000

### Default Credentials

**Admin Account**
- Email: admin@lawai.example
- Password: admin123

**Staff Account**
- Email: staff@lawai.example
- Password: staff123

**⚠️ Change these passwords immediately in production!**

## Project Structure

```
lawai/
├── app/                    # Next.js App Router
│   ├── (auth)/            # Authentication pages
│   ├── (staff)/           # Staff role pages
│   │   ├── chat/          # AI chat interface
│   │   ├── documents/      # Document management
│   │   └── history/        # Query history
│   ├── (admin)/           # Admin role pages
│   │   ├── dashboard/     # System overview
│   │   ├── users/         # User management
│   │   ├── settings/      # System configuration
│   │   └── logs/          # Audit logs
│   └── api/               # API routes
├── components/            # React components
│   ├── staff/            # Staff-specific components
│   └── admin/            # Admin-specific components
├── lib/                   # Utilities and core logic
│   ├── auth.ts          # NextAuth configuration
│   ├── db.ts            # Prisma client
│   ├── ai-agent.ts      # OpenAI integration
│   └── permissions.ts   # Role-based access control
├── prisma/              # Database schema and migrations
└── types/               # TypeScript type definitions
```

## Database Schema

The application uses a minimal database schema with 7 essential tables:

- `users` - User accounts and authentication
- `cases` - Legal cases
- `documents` - Case documents with AI analysis
- `chat_sessions` - Chat conversation sessions (can link to cases)
- `chat_messages` - Individual chat messages
- `audit_logs` - System activity logs
- `system_settings` - Application configuration

## Development

```bash
# Run development server
npm run dev

# Run database migrations
npm run db:migrate

# Open Prisma Studio (database GUI)
npm run db:studio

# Reset database (WARNING: deletes all data)
npm run db:reset
```

## Deployment

### Vercel (Recommended)

1. Push code to GitHub
2. Import project to Vercel
3. Add environment variables
4. Deploy

### Environment Variables for Production

- `DATABASE_URL` - PostgreSQL connection string
- `NEXTAUTH_URL` - Your production URL
- `NEXTAUTH_SECRET` - Random secret (generate with `openssl rand -base64 32`)
- `OPENAI_API_KEY` - Your OpenAI API key

## Security Notes

- All passwords are hashed using bcrypt
- Role-based access control enforced at API level
- Audit logging for all admin actions
- Session-based authentication with JWT

## License

MIT
