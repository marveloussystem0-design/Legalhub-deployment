# Legal Services Platform

A comprehensive legal services platform built with Next.js 14, Flutter, and Supabase.

## 🚀 Getting Started

### Prerequisites

- Node.js 18+ and npm
- Supabase account
- Git

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd Law\ App
   ```

2. **Set up the web application**
   ```bash
   cd web
   npm install
   ```

3. **Configure environment variables**
   
   Copy `.env.example` to `.env.local` and fill in your Supabase credentials:
   ```bash
   cp .env.example .env.local
   ```

   Required environment variables:
   - `NEXT_PUBLIC_SUPABASE_URL` - Your Supabase project URL
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Your Supabase anonymous key
   - `SUPABASE_SERVICE_ROLE_KEY` - Your Supabase service role key (for admin operations)

4. **Set up the database**

   Go to your Supabase project and run the SQL from `database-schema.sql` in the SQL Editor.

5. **Run the development server**
   ```bash
   npm run dev
   ```

   Open [http://localhost:3000](http://localhost:3000) in your browser.

## 📁 Project Structure

```
Law App/
├── web/                      # Next.js web application
│   ├── src/
│   │   ├── app/             # Next.js 14 App Router
│   │   ├── components/      # React components
│   │   ├── lib/             # Utility functions and configs
│   │   └── types/           # TypeScript type definitions
│   ├── public/              # Static assets
│   └── package.json
├── mobile/                   # Flutter mobile app (coming soon)
└── database-schema.sql       # Database schema
```

## 🎯 MVP Features

### Phase 1: Core Features
- ✅ Project setup and configuration
- ⏳ User authentication (Advocate, Client, Admin, Clerk roles)
- ⏳ Case search and filtering
- ⏳ Document management
- ⏳ Legal API integration

### Planned Features
- User profiles and verification
- Case tracking and timeline
- Document drafting with AI assistance
- Knowledge base (Acts, statutes, judgments)
- Notifications and alerts
- Payment integration

## 🛠️ Technology Stack

- **Frontend**: Next.js 14, React, TypeScript, Tailwind CSS
- **Mobile**: Flutter (coming soon)
- **Backend**: Supabase (PostgreSQL, Auth, Storage)
- **AI**: OpenAI GPT-4 (for legal assistance)
- **Payments**: Razorpay (coming soon)

## 📚 Documentation

- [Implementation Plan](brain/implementation_plan.md)
- [Task List](brain/task.md)

## 🔐 Security

- Row-level security (RLS) enabled on all tables
- End-to-end encryption for messages
- Multi-factor authentication support
- Secure file storage

## 📝 License

Proprietary - All rights reserved

## 🤝 Contributing

This is a private project. Please contact the maintainers for contribution guidelines.
