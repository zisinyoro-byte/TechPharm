# PharmaFlow PMS

A modern, installable Pharmacy Management System (PMS) combining the best features from industry-leading systems like PioneerRx, Rx30, PrimeRx, and Liberty Software.

## Features

### 🔄 Workflow Management (PioneerRx Style)
- Kanban-style prescription workflow board
- Real-time status tracking: Queue → Data Entry → Filling → Verify → Complete
- Drag-and-drop prescription cards between stages
- Quick stats dashboard

### 👥 Patient Management
- Comprehensive patient demographics
- Allergy tracking with visual warnings
- Prescription history per patient
- Search and filter capabilities

### 💊 Inventory Management (Rx30 Style)
- Drug catalog with NDC tracking
- Stock level monitoring with color-coded alerts
- Low stock and out-of-stock notifications
- Controlled substance tracking

### 📊 Reports & Analytics (PrimeRx Style)
- Weekly prescription trends
- Top dispensed drugs
- Revenue analytics
- Visual charts with Recharts

### 📱 PWA Support
- Installable as a standalone app on desktop and mobile
- Offline-capable architecture
- Native app-like experience

## Tech Stack

- **Framework**: Next.js 16 (App Router)
- **Database**: Neon PostgreSQL
- **ORM**: Prisma
- **UI**: Tailwind CSS + Shadcn/UI
- **Charts**: Recharts
- **Icons**: Lucide React

## Getting Started

### Prerequisites

- Node.js 18+ or Bun
- A Neon database account (free tier available)

### Setup

1. **Clone the repository**
   ```bash
   git clone <your-repo-url>
   cd pharmaflow
   ```

2. **Install dependencies**
   ```bash
   bun install
   # or
   npm install
   ```

3. **Configure your Neon database**
   
   Create a `.env` file in the root directory:
   ```env
   DATABASE_URL="postgres://username:password@ep-xxxx.us-east-2.aws.neon.tech/neondb?sslmode=require"
   ```
   
   Get your connection string from the Neon dashboard.

4. **Push the database schema**
   ```bash
   bun run db:push
   # or
   npx prisma db push
   ```

5. **Seed sample data (optional)**
   ```bash
   bun run db:seed
   ```

6. **Start the development server**
   ```bash
   bun run dev
   # or
   npm run dev
   ```

7. **Open your browser**
   Navigate to [http://localhost:3000](http://localhost:3000)

### Installing as a PWA

1. Open the app in Chrome or Edge
2. Look for the "Install" icon in the address bar
3. Click to install as a standalone application

## Deployment to Vercel

1. Push your code to GitHub
2. Connect your repository to Vercel
3. Add the `DATABASE_URL` environment variable in Vercel settings
4. Deploy!

## Project Structure

```
src/
├── app/
│   ├── actions/          # Server actions for data mutations
│   │   ├── dashboard.ts
│   │   ├── drugs.ts
│   │   ├── patients.ts
│   │   └── prescriptions.ts
│   ├── api/              # API routes
│   ├── patients/         # Patient management pages
│   ├── inventory/        # Inventory management pages
│   ├── prescriptions/    # Prescription pages
│   ├── reports/          # Analytics dashboard
│   └── page.tsx          # Main dashboard
├── components/
│   └── ui/               # Shadcn UI components
├── lib/
│   └── db.ts             # Prisma client
└── hooks/
prisma/
├── schema.prisma         # Database schema
└── seed.ts               # Sample data
public/
├── manifest.json         # PWA manifest
└── icons/                # App icons
```

## Key Features by Page

### Dashboard (`/`)
- Real-time workflow kanban board
- Quick stats (patients, drugs, pending, completed)
- Low stock alerts
- Quick action cards

### Patients (`/patients`)
- Patient list with search
- Add new patient dialog
- Allergy badges
- Quick "New Rx" action

### Inventory (`/inventory`)
- Drug catalog management
- Stock level indicators (green/yellow/red)
- Low stock alerts tab
- Add new drug dialog

### New Prescription (`/prescriptions/new`)
- Step-by-step prescription creation
- Patient search with allergy display
- Drug search with stock status
- Drug-allergy interaction warnings
- Direction (Sig) input

### Reports (`/reports`)
- Weekly prescription trends chart
- Top 10 dispensed drugs
- Drug distribution pie chart

## License

MIT License - feel free to use for personal or commercial projects.
