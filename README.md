# FinTracker

Personal finance tracker — dark mode, mobile-first, Claude-powered logging.

## Stack
- **Next.js 14** (App Router)
- **Upstash Redis** (data store)
- **Vercel** (hosting)
- **Tailwind CSS**

## Setup

### 1. Clone and install
```bash
git clone <your-repo>
cd fintracker
npm install
```

### 2. Configure environment
```bash
cp .env.local.example .env.local
# Fill in your Upstash credentials from console.upstash.com
```

### 3. Migrate your existing data
```bash
npx tsx scripts/migrate.ts
```
This seeds all your June 2026 data (expenses, CC charges, investments) into Redis. Run once.

### 4. Run locally
```bash
npm run dev
# Open http://localhost:3000
```

### 5. Deploy to Vercel
```bash
npx vercel
# Add env vars in Vercel dashboard:
#   UPSTASH_REDIS_REST_URL
#   UPSTASH_REDIS_REST_TOKEN
#   NEXT_PUBLIC_APP_URL
```

---

## Logging via Claude Code

The fastest way to log entries is to tell Claude in a Claude Code session:

> "782 ubereats openbank"
> "625 usd income treeline"  
> "750 nubank stock mine"

Claude runs:
```bash
npx tsx scripts/log.ts "782 ubereats openbank"
```

The script parses the natural language and POSTs to `/api/log`. Data is live instantly.

### What gets inferred automatically
| Pattern | Result |
|---|---|
| `openbank`, `amex`, `invex` | CC charge to that card |
| `dolarapp` | Direct expense (debit) |
| `usd` / `income` / `treeline` | Income entry |
| `fintual`, `fund`, `fondo` | Investment → fund type |
| `nubank`, `nu`, `stock` | Investment → stock type |
| `gf`, `her` | Marked as GF investment |
| `3 msi`, `12 meses` | Installment CC charge |
| Name contains `uber`, `taxi` | Transport category |
| Name contains `ubereats`, `lunch` | Food & Dining |
| Name contains `super`, `walmart` | Groceries |
| Name contains `amazon` | Shopping |

---

## API Reference

| Endpoint | Methods | Description |
|---|---|---|
| `/api/entries` | GET, POST, DELETE | Expenses and income |
| `/api/cc` | GET, POST, DELETE, PATCH | CC charges + settle |
| `/api/investments` | GET, POST, DELETE, PATCH | Investments + price update |
| `/api/budgets` | GET, POST, DELETE | Monthly category budgets |
| `/api/fx` | GET | Live MXN/USD rate |
| `/api/fintual` | GET, POST | Fintual fund NAV |
| `/api/export` | GET | CSV export |
| `/api/log` | POST | Natural language log endpoint |
