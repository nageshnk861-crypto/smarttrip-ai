# SmartTrip AI Travel Planner

SmartTrip is an intelligent, AI-powered travel planning platform designed to deliver constraint-first, budget-accurate travel itineraries.

---

## 📁 Segregated Architecture

```text
smarttrip-app/
│
├── frontend/                 ← 🎨 FRONTEND (Next.js App Router)
│   ├── app/
│   │   ├── about/            # About page
│   │   ├── dashboard/        # User dashboard
│   │   ├── explore/          # Destination discovery
│   │   ├── login/            # Authentication
│   │   ├── planner/          # Interactive trip planner
│   │   ├── profile/          # User profile
│   │   ├── register/         # User registration
│   │   ├── trips/            # Saved itineraries
│   │   ├── layout.tsx        # Root layout & providers
│   │   └── page.tsx          # Landing hero page
│   │
│   ├── components/
│   │   ├── navigation/       # Navbar, Footer
│   │   └── planner/          # Destination search & origin inputs
│   │
│   ├── public/               # Manifest, service worker, icons
│   ├── styles/               # Global CSS & theme styles
│   ├── package.json          # Frontend dependencies
│   └── next.config.ts        # Next.js config & API proxy rewrites
│
├── backend/                  ← ⚙️ BACKEND (Express + TypeScript)
│   ├── routes/
│   │   ├── trips.ts          # CRUD for trips & saved itineraries
│   │   ├── attractions.ts    # Overpass & GeoJSON place search
│   │   ├── hotels.ts         # Accommodation search
│   │   ├── weather.ts        # Open-Meteo multi-day weather
│   │   └── ai.ts             # Ollama / OpenAI & multi-agent planner
│   │
│   ├── controllers/          # Request handlers & logic
│   ├── services/
│   │   ├── overpass.ts       # OpenStreetMap / Overpass queries
│   │   ├── ollama.ts         # Ollama LLM integration
│   │   ├── weather.ts        # Open-Meteo live weather
│   │   ├── routing.ts        # Transit & distance estimation
│   │   ├── planner.ts        # Budget calculation & itinerary builder
│   │   ├── travel-agent.ts   # Multi-agent orchestrator
│   │   └── supabase.ts       # Supabase database client
│   │
│   ├── models/
│   │   └── types.ts          # Data models & interfaces
│   │
│   ├── data/
│   │   └── india-attractions.geojson  # Heritage & tourist locations
│   │
│   ├── server.ts             # Express server entry point (Port 5000)
│   └── package.json          # Backend dependencies
│
├── database/
│   └── supabase/
│       └── migrations/       # SQL schemas (tables, RLS, RAG embeddings)
│
├── .env                      # Environment variables
├── .gitignore
└── README.md
```

---

## 🚀 Getting Started

### 1. Install Dependencies
```bash
# Install for both frontend and backend
npm run install:all
```

### 2. Run Backend (Port 5000)
```bash
npm run dev:backend
```

### 3. Run Frontend (Port 3000)
```bash
npm run dev:frontend
```

---

## 📡 API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/attractions/destinations` | Curated Indian destinations |
| `GET` | `/api/attractions/search` | OpenStreetMap place search |
| `GET` | `/api/hotels` | Accommodation search |
| `GET` | `/api/weather` | Open-Meteo forecast |
| `POST` | `/api/ai/plan-trip` | Full AI multi-agent itinerary |
| `POST` | `/api/ai/plan` | Deterministic budget breakdown |
| `GET` | `/api/trips` | User saved trips |