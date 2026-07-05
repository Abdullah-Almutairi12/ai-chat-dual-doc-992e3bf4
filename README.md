# PDF Quanta

**The Quantum Leap in Document Intelligence**

PDF Quanta is a bilingual (Arabic / English) AI-powered document workspace. Upload a PDF and chat with it, extract tables to Excel, proofread Arabic and English text, convert documents, generate quizzes, and analyze financial or legal clauses — all in one unified interface.

---

## ✨ Features

| Tool | Description |
|------|-------------|
| **Chat & Summary** | Ask natural-language questions about any PDF and get grounded, instant answers. |
| **Table & Excel Extractor** | Detect tables inside PDFs and export them as clean `.xlsx` files. |
| **Proofreader & Smart Editor** | Catch spelling, grammar, and style issues in Arabic and English. |
| **Smart Document Converter** | Convert PDF to Word or run OCR on scanned documents with Arabic-character optimization. |
| **AI Quiz Generator** | Turn any document into interactive multiple-choice or true/false quizzes. |
| **Financial & Legal Analyzer** | Extract key metrics into charts and flag risky legal clauses. |

Additional capabilities:

- 🌐 **Bilingual UI** — full Arabic and English support with RTL layout.
- 🔐 **Authentication** — email/password and Google sign-in via Lovable Cloud Auth.
- 💳 **SAR Payments** — subscription tiers powered by Tap Payments (with a simulated checkout fallback for testing).
- 🪙 **Credit-based Usage** — credits are stored per user in the database and topped up on successful payments.
- 📧 **Transactional Email** — welcome and invoice emails sent from `support@pdfquanta.online` via Resend.
- 📱 **Responsive Design** — built to work across desktop and mobile.

---

## 🚀 Tech Stack

- **Framework:** [TanStack Start](https://tanstack.com/start) (React 19 full-stack framework)
- **Build Tool:** Vite 7
- **Styling:** Tailwind CSS v4 + shadcn/ui primitives
- **Backend / Database:** Lovable Cloud (Supabase) — Postgres, Auth, and Row-Level Security
- **Payments:** Tap Payments (sandbox/test keys for simulation)
- **Email:** Resend
- **Language:** TypeScript (strict mode)

---

## 📦 Pricing Tiers

| Tier | Price | Use case |
|------|-------|----------|
| Free | 0 SAR | Explore the core tools. |
| Basic | 19 SAR | Everyday document tasks. |
| Pro | 49 SAR | Higher volume and advanced analysis. |
| Enterprise | 99 SAR | Maximum quota and premium features. |

---

## 🛠️ Local Development

### Prerequisites

- [Node.js](https://nodejs.org/) (Bun runtime is used in this project)
- A Lovable Cloud / Supabase project with the required tables and policies
- Tap Payments test credentials (for payment simulation)
- Resend API key and a verified sender domain (`pdfquanta.online`)

### Install dependencies

```bash
bun install
```

### Run the development server

```bash
bun dev
```

The app will be available at `http://localhost:8080`.

### Build for production

```bash
bun run build
```

---

## 🔑 Environment Variables

The following variables are expected by the runtime. **Never commit secrets to the repository.**

| Variable | Description |
|----------|-------------|
| `VITE_SUPABASE_URL` | Supabase project URL (public) |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Supabase public/anon key |
| `SUPABASE_URL` | Server-side Supabase URL |
| `SUPABASE_PUBLISHABLE_KEY` | Server-side Supabase publishable key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (server-only) |
| `TAP_SECRET_KEY` | Tap Payments secret key |
| `RESEND_API_KEY` | Resend API key |
| `CRON_SECRET` | Secret for verifying cron / webhook requests |

---

## 📁 Project Structure

```text
src/
  components/       # Reusable UI components
  hooks/            # Custom React hooks
  integrations/     # Supabase, Lovable Cloud Auth, Tap clients
  lib/              # Business logic, helpers, server functions
  routes/           # TanStack Start file-based routes
  styles.css        # Tailwind v4 theme and global styles
supabase/
  migrations/       # Database schema migrations
```

---

## 🤝 Contributing

This is a private Lovable Cloud project. Changes made in Lovable are synced to the connected GitHub repository in real time, and changes pushed to GitHub are synced back to Lovable.

---

## 📄 License

All rights reserved — © PDF Quanta.

---

<p align="center">
  <strong>PDF Quanta</strong> — Your intelligent document workspace.
</p>
