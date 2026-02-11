# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

BiblioHispa is a full-stack school library management system. Spanish-only UI (hardcoded, no i18n framework). Features: book catalog, lending/returns, QR scanning, gamification (points/badges/streaks), Google OAuth login, AI-powered recommendations via Google Gemini, PDF reports, and student ID card generation.

## Development Commands

```bash
# Install dependencies
npm install

# Start frontend dev server (Vite, port 5173, proxies /api to :3000)
npm run dev

# Start backend server (Express, port 3000)
node server.js

# Build frontend for production
npm run build

# Preview production build
npm run preview
```

Both `npm run dev` and `node server.js` must run simultaneously during development. The Vite dev server proxies `/api` requests to the Express backend on port 3000.

## Environment Variables

Copy `.env.example` to `.env`. Required variables:
- `VITE_GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_ID` — Google OAuth (server falls back to VITE_ prefix)
- `VITE_API_KEY` — Google Gemini API key (injected at build time as `process.env.API_KEY`)
- `PRISMA_API_SECRET` (or `API_SECRET`) — Optional, for Prisma EDU student sync
- `PORT` — Backend port (default 3000)

## Architecture

### Frontend (React 19 + TypeScript + Vite)

- **Entry:** `index.tsx` → `App.tsx` (main container, holds all global state)
- **State management:** React hooks in App.tsx. State passed via props to views. Persistence via useEffect hooks that auto-save to backend on change.
- **Session:** `currentUser` stored in localStorage key `biblio_session_user`
- **Styling:** Tailwind CSS (loaded via CDN in `index.html`), custom glassmorphism design system (`.glass-panel`, `.glass-card`, `.glass-input`), fonts Fredoka (headings) + Inter (body)

### Backend (Express 5 + Node.js)

- **Entry:** `server.js` — single file, all API routes
- **Database:** JSON file at `data/db.json` with automatic backups in `data/backups/`
- **External APIs:** Google Books API (book metadata search), Google Gemini (AI features), Prisma EDU (student sync)

### Key Files

| File | Purpose |
|------|---------|
| `App.tsx` | Main container, global state, auth flow, data loading |
| `server.js` | Express backend, all API routes, DB read/write |
| `types.ts` | All TypeScript interfaces (User, Book, Transaction, Review, etc.) |
| `components/AdminView.tsx` | Admin dashboard (largest component ~124KB) |
| `components/StudentView.tsx` | Student-facing catalog and borrowing UI |
| `services/storageService.ts` | HTTP client wrapping all `/api/*` endpoints |
| `services/gamificationService.ts` | Points, badges, streak logic |
| `services/bookService.ts` | Book cover search (Google Books + Open Library + Gemini), metadata |
| `services/geminiService.ts` | Google Gemini AI integration (lazy-loaded): chat, age rating, book identification |
| `services/reportService.ts` | PDF generation with jsPDF |
| `prismaImportService.js` | Prisma EDU API sync for students/teachers |

### Data Flow

1. App.tsx fetches all data from `GET /api/db` on mount
2. State updates flow through React hooks
3. useEffect hooks auto-persist changes (transactions, reviews, pointHistory, settings) back to the API
4. Users and books use granular CRUD endpoints (`POST/PUT/DELETE /api/users/:id`, `/api/books/:id`)

### User Roles

- `SUPERADMIN` — Full access (default: `superadmin`/`admin123`)
- `ADMIN` — Teachers/library staff
- `STUDENT` — Student catalog and borrowing

### API Routes Pattern

All backend routes are in `server.js`. Pattern: `/api/{resource}` for collections, `/api/{resource}/:id` for individual items, `/api/actions/{action}` for operations (checkout, return, review).

### Book Cover Search Flow (`bookService.ts`)

`searchBookCandidates(query)` is the main entry point, called when adding books or searching alternative covers:

1. **Parallel**: `identifyBook(query)` via Gemini + `fetchGoogleBooks(query)` via Google Books API
2. **Precise search**: If Gemini returned ISBN → search Google Books with `isbn:{isbn}` and insert at front. If only title/author → refined Google Books search
3. **Open Library fallback**: For candidates still missing covers, try `covers.openlibrary.org` by ISBN, then by text search
4. Returns candidates with best available covers

Key design decisions:
- **Gemini `identifyBook()`** returns `{title, author, isbn}` from vague queries. Falls back to `null` gracefully if API key missing or error
- **`searchOpenLibraryCover()`** tries ISBN first (`/b/isbn/{isbn}-L.jpg?default=false` with HEAD check), then Open Library search API for `cover_i`
- **`validateImageUrl()`** exists (line ~72) but is NOT called — it was found to reject valid Google Books/Open Library URLs via `new Image()` browser loading. Do not reactivate without thorough testing
- **Covers are stored in `db.json`** once found. The search only runs when adding books or explicitly clicking "Buscar Portada Alternativa"
- **`handleStartEditing()`** in AdminView does NOT pre-load candidates (was causing slowness). Candidates load on-demand only

### Broken Image Pattern

All `<img>` tags for book covers use a fallback pattern to avoid broken image icons:
```tsx
<div className="... relative overflow-hidden">
  <span>{title}</span>
  {coverUrl && <img src={coverUrl} className="absolute inset-0 ..." onError={(e) => { e.currentTarget.style.display = 'none'; }}/>}
</div>
```
Title text sits behind the image. If image fails to load, `onError` hides it and the title shows through. This pattern is used in: book list, edit modal, candidate grid, and candidate list.

## Conventions

- All UI text is in Spanish
- Date formatting uses `es-ES` locale
- String comparison uses `normalizeString()` from `services/utils.ts` (strips accents)
- Book covers: multi-source (Google Books → Open Library), stored in db.json. No runtime image validation
- Gemini model used: `gemini-2.5-flash`
- Production deployment uses PM2 + Nginx on Ubuntu (see `install.sh`)
