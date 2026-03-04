# 📅 Anime Tracker & Scheduler

A highly-customized, production-ready weekly anime release schedule. This application is a fully functional web app designed to mimic the elegant, dark-themed user interface of AnimeSchedule.net, while adding powerful, personalized features like a local *"Watching"* dashboard and dynamic RSS scraping.


## 🎯 The Purpose
Keeping up with seasonal anime releases can be a massive headache. Different shows drop on different days, in different timezones, and tracking down the episodes across various groups right after they release is tedious.

This project solves that by giving you a **beautiful, local-timezone-converted weekly grid**. You can quickly filter what you want to see, bookmark the shows you're actively watching, and seamlessly download the latest release links straight from RSS feeds into a neat `.zip` package with the click of a button.

## ✨ Key Features

- **7-Day Dynamic Timetable:** A responsive, mobile-friendly schedule that snaps to a single-column block on mobile and a robust 7-column grid on desktop.
- **Local Time Conversion:** UTC air times are instantly converted to the user's localized browser time. 
- **Advanced Filtering:** Granular pill-filters allow you to sort out the noise. Strip out Chinese Donghua, isolate Web Releases (ONA) vs TV releases, or sort entirely by **SUB** vs **DUB**.
- **State-Persisted Watchlist:** Bookmark the anime you care about. Zustand saves your preferences into your browser's `localStorage` so they are always there when you return.
- **Batch RSS Scraping Engine:** When filtering by your Watchlist, click the `...` on any schedule day to instantly trigger a backend scraper. It searches relevant RSS feeds for the *exact* expected episode, bundles the release files into a `.zip`, and serves the final download straight to your desktop.

## 🛠️ The Tech Stack

This project was built to be blazing fast, strictly typed, and incredibly easy to deploy.

- **Framework:** Next.js 14+ (App Router)
- **Language:** TypeScript exactly configured for frontend and backend API typing
- **Styling:** Tailwind CSS (Vanilla utilities + Glassmorphism / Dark Theme design system)
- **State Management:** Zustand (with `persist` middleware)
- **Data Fetching & Caching:** TanStack React Query v5
- **Icons:** `lucide-react`
- **Utility Libraries:** `jszip` (for on-the-fly archive generation)

## 🚀 Getting Started

To run this application locally, you will need a valid AnimeSchedule v3 API Token.

**1. Clone the repository:**
```bash
git clone https://github.com/bijudamian/Anime_Schdule.git
cd Anime_Schdule
```

**2. Install dependencies:**
```bash
npm install
```

**3. Configure Environment Variables:**
Create a `.env.local` file in the root directory and add your API credentials:
```env
ANIMESCHEDULE_API_BASE=https://animeschedule.net/api/v3
ANIMESCHEDULE_CLIENT_ID=your_client_id_here
ANIMESCHEDULE_TOKEN=your_token_here
```

**4. Start the development server:**
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result. All API requests are securely proxied through the Next.js backend (`/api/schedule`) so your credentials are never exposed to the client.

## 🛡️ License

This project is intended for educational purposes and personal use.
