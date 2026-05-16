<p align="center">
  <img src="https://img.shields.io/badge/Next.js-16.1.6-000000?style=for-the-badge&logo=next.js" />
  <img src="https://img.shields.io/badge/React-19.2-61DAFB?style=for-the-badge&logo=react" />
  <img src="https://img.shields.io/badge/TypeScript-5.x-3178C6?style=for-the-badge&logo=typescript" />
  <img src="https://img.shields.io/badge/Tailwind_CSS-4.x-06B6D4?style=for-the-badge&logo=tailwind-css" />
  <img src="https://img.shields.io/badge/MongoDB-7.x-47A248?style=for-the-badge&logo=mongodb" />
  <img src="https://img.shields.io/badge/Clerk-Auth-6C47FF?style=for-the-badge&logo=clerk" />
</p>

# 🗓️ Anime Schedule — Weekly Anime Release Calendar

A **dark-themed, responsive** weekly anime timetable that pulls live airing data from the [AnimeSchedule.net](https://animeschedule.net) API, renders it in a 7-column calendar grid, and lets users build a personal watchlist with cloud sync — all powered by **Next.js App Router**, **Clerk Auth**, and **MongoDB Atlas**.

---

## Table of Contents

- [Architecture Overview](#architecture-overview)
- [Data Flow Diagrams](#data-flow-diagrams)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Key Features & Creative Solutions](#key-features--creative-solutions)
  - [1. Bidirectional Sync Engine](#1-bidirectional-sync-engine-syncprovidertsx)
  - [2. Smart Torrent Resolver](#2-smart-torrent-resolver-watchlist-download-api)
  - [3. Timezone-Aware Calendar Rendering](#3-timezone-aware-calendar-rendering)
  - [4. Filter Persistence System](#4-filter-persistence-system)
  - [5. Hidden Anime Deduplication](#5-hidden-anime-deduplication)
  - [6. Click-to-Bookmark UX](#6-click-to-bookmark-ux)
  - [7. Responsive Week/Day Navigation](#7-responsive-weekday-navigation)
- [Environment Variables](#environment-variables)
- [Getting Started](#getting-started)
- [Deployment](#deployment)

---

## Architecture Overview

```mermaid
graph TB
    subgraph Client["🖥️ Client (Browser)"]
        UI["React Components"]
        ZS["Zustand Store<br/>(localStorage)"]
        RQ["React Query<br/>(cache layer)"]
    end

    subgraph Server["⚙️ Next.js Server (Serverless)"]
        MW["Clerk Middleware<br/>(proxy.ts)"]
        API_S["/api/schedule"]
        API_U["/api/user-preferences"]
        API_D["/api/watchlist-download"]
    end

    subgraph External["🌐 External Services"]
        AS["AnimeSchedule API v3"]
        MDB["MongoDB Atlas"]
        CK["Clerk Auth"]
        NY["Torrent Provider"]
    end

    UI <--> ZS
    UI <--> RQ
    RQ -->|fetch| API_S
    ZS -->|debounced PUT| API_U
    UI -->|POST| API_D

    MW -->|auth check| API_U
    API_S -->|GET /timetable| AS
    API_U <-->|read/write| MDB
    API_D -->|search| AS
    API_D -->|Search| NY
    CK -->|JWT validation| MW

    style Client fill:#1a1a2e,color:#ededed,stroke:#3A75C4
    style Server fill:#2b2b2b,color:#ededed,stroke:#4caf50
    style External fill:#373737,color:#ededed,stroke:#f0c040
```

---

## Data Flow Diagrams

### User Sign-In & Sync Flow

```mermaid
sequenceDiagram
    participant B as Browser
    participant SP as SyncProvider
    participant ZS as Zustand Store
    participant API as /api/user-preferences
    participant DB as MongoDB

    Note over B: User clicks "Sign In"
    B->>SP: Clerk isSignedIn = true
    SP->>API: GET /api/user-preferences
    API->>DB: findOne({ clerkUserId })
    DB-->>API: { watchlist, hiddenAnime, savedFilters }
    API-->>SP: JSON response

    Note over SP: Union merge strategy
    SP->>SP: mergedWatchlist = Set(DB ∪ Local)
    SP->>SP: mergedHidden = Set(DB ∪ Local)
    SP->>SP: mergedFilters = DB ?? Local
    SP->>ZS: setState(merged)
    SP->>API: PUT merged data back
    API->>DB: updateOne({ $set }, { upsert: true })

    Note over SP: Subscribe to future changes
    ZS-->>SP: onChange (debounced 1.5s)
    SP->>API: PUT updated state
    API->>DB: updateOne(...)
```

### Torrent Download Pipeline

```mermaid
flowchart TD
    A["User clicks 'Download All'"] --> B["POST /api/watchlist-download"]
    B --> C{"For each watchlist item"}
    C --> D["Query AnimeSchedule API<br/>→ resolve romaji title"]
    D --> E["Fetch episode detail<br/>→ get latest aired ep#"]
    E --> F{"ep# > latest aired?"}
    F -->|Yes| G["⚠️ Skip: not yet aired"]
    F -->|No| H["Search Torrent Provider"]

    H --> I["Pass 1: First word<br/>of romaji title"]
    I --> J{"Fuzzy matches found?"}
    J -->|Yes| K["Filter by episode #"]
    J -->|No| L["Pass 2: Full romaji title"]
    L --> M{"Fuzzy matches found?"}
    M -->|Yes| K
    M -->|No| N["Pass 3: Canonical title<br/>first word"]
    N --> K

    K --> O{"Candidates with<br/>correct episode?"}
    O -->|Yes| P["Sort by seeders ↓<br/>Pick highest"]
    O -->|No| G
    P --> Q["Download .torrent file"]
    Q --> R["Add to ZIP archive"]

    R --> C
    C -->|All items processed| S["Return ZIP to browser"]

    style A fill:#3A75C4,color:white
    style S fill:#4caf50,color:white
    style G fill:#f0c040,color:#222
```

### Filter State Machine

```mermaid
stateDiagram-v2
    [*] --> Default: Page Load

    Default --> ActiveFilters: User toggles filter pill
    Default --> SavedPreset: savedFilters exists in store

    SavedPreset --> ActiveFilters: User changes a filter
    ActiveFilters --> Saved: Clicks "Save Filters"
    Saved --> SavedPreset: Filters match saved state

    ActiveFilters --> LoadSaved: Clicks "Load Saved"
    LoadSaved --> SavedPreset: Filters restored

    SavedPreset --> Default: Clicks trash icon (clear preset)
    Saved --> Default: Clicks trash icon

    state Default {
        [*] --> AllOff
        AllOff: showWatchlistOnly=false
    }

    state SavedPreset {
        [*] --> Applied
        Applied: ✓ "Saved Preset" badge shown
    }
```

---

## Tech Stack

| Layer | Technology | Purpose |
|:------|:-----------|:--------|
| **Framework** | Next.js 16 (App Router) | Full-stack React framework with serverless API routes |
| **Language** | TypeScript 5.x | End-to-end type safety |
| **UI Library** | React 19 | Component rendering |
| **Styling** | Tailwind CSS 4 | Utility-first CSS with custom theme tokens |
| **State** | Zustand 5 + `persist` middleware | Client-side state persisted to `localStorage` |
| **Data Fetching** | TanStack React Query 5 | Server state caching, deduplication, auto-refetch |
| **Auth** | Clerk (`@clerk/nextjs`) | OAuth / email auth, session management, middleware protection |
| **Database** | MongoDB Atlas (via `mongodb` driver) | Cloud-persisted user preferences |
| **Icons** | Lucide React | Consistent, tree-shakeable SVG icon set |
| **Torrent Parsing** | Custom XML parser | Lightweight XML parsing without heavy dependencies |
| **ZIP Generation** | JSZip | Client-downloadable torrent bundles |

---

## Project Structure

```
src/
├── app/
│   ├── layout.tsx              # Root layout: ClerkProvider + Providers wrapper
│   ├── page.tsx                # Entry point: renders <Timetable />
│   ├── globals.css             # Tailwind v4 @theme tokens + dark theme base
│   └── api/
│       ├── schedule/           # GET: proxies AnimeSchedule timetable API
│       ├── user-preferences/   # GET/PUT: Clerk-protected MongoDB CRUD
│       └── watchlist-download/ # POST: torrent search + ZIP generation
│
├── components/
│   ├── Timetable.tsx           # Main orchestrator: fetch → normalize → filter → render
│   ├── CalendarHeader.tsx      # 7-column day header with date labels
│   ├── AnimeCard.tsx           # Individual anime tile with hover overlay
│   ├── FilterBar.tsx           # Pill-based filter controls + save/load presets
│   ├── AuthButton.tsx          # Gradient sign-in button / user avatar
│   ├── SyncProvider.tsx        # Bidirectional Zustand ↔ MongoDB sync bridge
│   ├── Providers.tsx           # QueryClient + SyncProvider wrapper
│   ├── DayDropdown.tsx         # Per-day context menu with torrent actions
│   └── DownloadWatchlistButton.tsx  # ZIP download trigger
│
├── store/
│   └── useWatchlistStore.ts    # Zustand store: watchlist, hidden, savedFilters
│
├── lib/
│   └── mongodb.ts              # Singleton MongoDB client (global cache for HMR)
│
├── types/
│   └── types.ts                # Shared TypeScript interfaces
│
└── proxy.ts                    # Clerk middleware (renamed from middleware.ts)
```

---

## Key Features & Creative Solutions

### 1. Bidirectional Sync Engine (`SyncProvider.tsx`)

**Problem**: Users browse anonymously (data in `localStorage`), then sign in. How do we merge local and cloud data without data loss?

**Solution**: A **union-based merge strategy** executed once per sign-in:

```
mergedWatchlist  = Set(database.watchlist  ∪  local.watchlist)
mergedHidden     = Set(database.hiddenAnime ∪ local.hiddenAnime)
mergedFilters    = database.savedFilters   ?? local.savedFilters
```

The merged result is pushed to **both** the Zustand store and the database, ensuring consistency. After initial sync, all subsequent store changes are automatically saved to MongoDB via a **1.5-second debounced** subscription listener, preventing API spam during rapid interactions.

**Key decisions**:
- `hasSyncedRef` (a `useRef`) ensures the merge runs **exactly once** per auth session, not on every re-render.
- `isSavingRef` acts as a mutex to prevent overlapping PUT requests.
- Zustand's `subscribe()` provides a framework-agnostic way to watch for changes without coupling to React's render cycle.

### 2. Smart Torrent Resolver (Watchlist Download API)

**Problem**: Given an anime title like *"The Apothecary Diaries"*, find the correct `.torrent` file for a specific episode — despite inconsistent naming conventions across release groups.

**Solution**: A **3-pass fuzzy matching pipeline**:

| Pass | Search Query | Rationale |
|:-----|:-------------|:----------|
| **1** | First word of romaji title (e.g., `"Kusuriya"`) | Search indexes often use romaji titles; a single keyword minimizes noise |
| **2** | Full romaji title | Fallback if Pass 1 is too ambiguous |
| **3** | First word of canonical (English) title | Catches shows indexed under English names |

Each pass uses **Jaccard similarity** (threshold ≥ 35%) between tokenized title strings, with stop-word filtering for Japanese particles (`no`, `wo`, `wa`, etc.) to prevent false positives.

```
Jaccard(A, B) = |A ∩ B| / |A ∪ B|
```

The winning candidate is selected by **highest seeder count** after verifying the episode number matches.

---

### 3. Timezone-Aware Calendar Rendering

**Problem**: The API returns air times in UTC. Users in different timezones need to see shows on the correct day column.

**Solution**: The `normalizeShow()` function converts each show's `episodeDate` (UTC ISO string) to the user's **local timezone** at two levels:

1. **`getLocalDayIndex()`** — Maps `new Date(isoString).getDay()` (which auto-converts to local) into a Monday-first index (`0=Mon, 6=Sun`).
2. **`formatLocalTime()`** — Renders the display time via `toLocaleTimeString()`.

This means a show airing at `03:00 UTC Wednesday` correctly appears under **Tuesday** for a `UTC-5` user, and under **Wednesday** for a `UTC+5:30` user.

---

### 4. Filter Persistence System

**Problem**: Users repeatedly configure the same filter combination (e.g., "No Donghua + SUB only") every session.

**Solution**: A **saved filter preset** system with 3 states:

| State | UI Indicator | User Action |
|:------|:-------------|:------------|
| No preset saved, filters active | Green `Save Filters` button | Click to save current state |
| Preset saved, filters match | `✓ Saved Preset` badge | — (auto-applied on mount) |
| Preset saved, filters diverge | Amber `Load Saved` button | Click to restore preset |

The preset is stored in the Zustand store (`savedFilters: FilterState | null`), persisted to `localStorage`, and synced to MongoDB. On page load, a `useEffect` checks for saved filters and auto-applies them **before** the first render completes.

---

### 5. Hidden Anime Deduplication

**Problem**: Hiding "Naruto" should hide both its SUB and DUB entries, but the API returns them as separate items with different route IDs.

**Solution**: The `hiddenAnimeData` memo in `Timetable.tsx` groups hidden items by their **display title** using a `Map<string, { ids: string[], title: string }>`. When a user clicks "Show" on a grouped entry, **all associated route IDs** are unhidden simultaneously:

```typescript
const handleUnhideGroup = (ids: string[]) => {
    ids.forEach((id) => unhideAnime(id));
};
```

---

### 6. Click-to-Bookmark UX

**Problem**: Requiring users to hover → find the small bookmark icon → click was too many steps for the most common action.

**Solution**: **Dual interaction model** on `AnimeCard`:

- **Click anywhere on the tile** → Toggles bookmark (via `onClick` on the root `<div>`)
- **Hover** → Reveals an overlay with **both** the bookmark icon and the ✕ hide icon
- Overlay buttons use `e.stopPropagation()` to prevent double-toggling

This gives a one-tap bookmark experience on mobile while preserving the granular controls on desktop hover.

---

### 7. Responsive Week/Day Navigation

**Problem**: A 7-column calendar doesn't work on mobile screens.

**Solution**: Two separate navigation modes controlled by a single `dayOffset` state variable:

| Viewport | Navigation | Display |
|:---------|:-----------|:--------|
| Desktop (`md:` and up) | `← Prev Week` / `Next Week →` in the filter bar | All 7 columns visible |
| Mobile (`< md`) | `← Prev Day` / `Next Day →` below the filter bar | Only the selected day column shown |

The `dayOffset` drives both `weekOffset` (which week to fetch) and `selectedDayIndex` (which column to highlight/show), calculated via:

```typescript
const weekOffset = Math.floor(absoluteDayIndex / 7);
const selectedDayIndex = ((absoluteDayIndex % 7) + 7) % 7;
```

This elegantly handles crossing week boundaries in both directions with a single integer.

---

## Environment Variables

Create a `.env.local` file in the project root:

```env
# Clerk Authentication
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...

# MongoDB Atlas
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/
MONGODB_DB=anime_schedule

# AnimeSchedule API (optional — for torrent download feature)
ANIMESCHEDULE_TOKEN=your_bearer_token
```

| Variable | Required | Scope |
|:---------|:---------|:------|
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | ✅ | Client + Server |
| `CLERK_SECRET_KEY` | ✅ | Server only |
| `MONGODB_URI` | ✅ | Server only |
| `MONGODB_DB` | ❌ | Server only (defaults to `anime_schedule`) |
| `ANIMESCHEDULE_TOKEN` | ❌ | Server only (enables torrent downloads) |

---

## Getting Started

```bash
# 1. Clone the repository
git clone https://github.com/bijudamian/Anime_Schdule.git
cd Anime_Schdule

# 2. Install dependencies
npm install

# 3. Set up environment variables
cp .env.example .env.local
# Edit .env.local with your Clerk keys + MongoDB URI

# 4. Start the development server
npm run dev
# → http://localhost:3000
```

---

## Deployment

### Vercel (Recommended)

1. Push to GitHub
2. Connect the repo in [Vercel Dashboard](https://vercel.com/new)
3. Add the 3 required environment variables:
   - `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
   - `CLERK_SECRET_KEY`
   - `MONGODB_URI`
4. Deploy — Vercel auto-detects Next.js and handles the rest

### MongoDB Connection

The `mongodb.ts` utility uses a **global singleton pattern** to prevent connection pool exhaustion during Next.js HMR (Hot Module Replacement) in development:

```typescript
let cached = (global as any)._mongoClientPromise;
if (!cached) {
    const client = new MongoClient(MONGODB_URI);
    cached = client.connect();
    (global as any)._mongoClientPromise = cached;
}
```

This ensures only **one** `MongoClient` instance exists across all serverless function invocations in both dev and production.

---

<p align="center">
  Built with ☕ and <a href="https://nextjs.org">Next.js</a>
</p>
