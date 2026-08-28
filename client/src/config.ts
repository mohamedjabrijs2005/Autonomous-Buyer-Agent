// In local dev, Vite's proxy (see vite.config.ts) forwards relative paths
// like /catalog to http://localhost:3001, so API_BASE stays empty.
//
// In production, frontend and backend are deployed as separate services on
// different domains, so we need the backend's real URL. Set VITE_API_BASE
// in your deploy platform's environment variables to the backend's public
// URL (e.g. https://your-app.onrender.com) — no trailing slash.
export const API_BASE = import.meta.env.VITE_API_BASE || "";
