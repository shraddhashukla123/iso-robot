# ISO-Robot frontend

Vite + React 18 + TypeScript UI for the ISO-Robot API.

## Prerequisites

- Node 20+ (recommended)
- Backend running at `http://127.0.0.1:8000` (see [`../backend/README.md`](../backend/README.md))

## Setup

```bash
cd frontend
npm install
```

## Development

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173). The UI calls `http://127.0.0.1:8000/api/v1` by default (`VITE_API_BASE` overrides this).

## Production build

```bash
npm run build
```

Output is in `frontend/dist/`.

## Azure-dependent flows

Control extraction, issue classification, and risk discovery require Azure Document Intelligence and Azure OpenAI credentials on the backend (see backend `.env.example`). Without keys, those actions return API errors surfaced as inline toasts.
