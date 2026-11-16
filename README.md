# EcoRotate Frontend

Frontend for the EcoRotate crop rotation analysis tool — NASA Space Apps Challenge 2026.

## Tech Stack

- **Vite** for building and dev server
- **Tailwind CSS** for styling
- **Chart.js** for data visualization
- **Gemini AI** for chatbot (via backend API)

## Getting Started

```bash
npm install
npm run dev
```

## Deployment

Deployed on [Vercel](https://vercel.com) — auto-deploys on push to `master`.

## Backend API

The frontend connects to the backend at `http://13.48.153.251:8081` for all API calls including analysis, chat, and health checks.
