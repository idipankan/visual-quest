# SpotQuest

An AI-powered scavenger hunt built with React + TypeScript and powered by Jev. Find an everyday object that fits a mission, capture one webcam frame (or upload a JPG/PNG), and investigate it. Jev returns typed judgments; the app decides what to display and how many points to award.

The mission and hint come before the camera or image on mobile, so players know what to look for before capturing a photo.
Once the camera is enabled, tap the shutter-style **Investigate** button at the bottom of the live preview to capture and analyze a single frame without scrolling away. The control is disabled while processing or when Jev is offline; uploaded images are still investigated automatically.

## Game modes

Choose a mode before starting a quest. Each quest draws **10 unique random challenges** from a shared catalogue of **1,000** (350 Easy, 350 Medium, and 300 Hard).

- **Easy:** 10 Easy challenges about familiar objects.
- **Medium:** 10 Medium challenges about object functions, materials, and context.
- **Hard:** 10 Hard challenges focused on relationships, arrangements, and scenes.
- **Progressive:** 4 Easy, then 3 Medium, then 3 Hard, randomized within each tier.

The catalogue spans household objects, stationery, food, clothing, plants, crafts, music, sports, travel, and device accessories. Easy missions focus on recognizable objects, colors, shapes, and patterns. Medium missions add functions, materials, mechanisms, and design details. Hard missions ask for spatial arrangements, matching and contrasting groups, tool-and-result evidence, themed kits, and creative reuse. Hints suggest safe setups: tools can stay stationary, cookware cold, containers empty, and screens off; no private documents or demonstrations are needed.

The selected challenges stay fixed during the quest, including retries and skips. Skipping consumes one of the 10 missions. Reset or play again returns to mode selection; starting draws a fresh set (challenges may recur across separate quests). Final score limits and ranks use only the selected quest's challenges. The server validates every submitted challenge ID against the same full catalogue.

Every completed quest, including a zero-score quest, gets a postcard showing the score, maximum possible score, rank, mode, and mission count. **Share postcard** opens the device's native share sheet when image-file sharing is supported; otherwise it downloads the PNG with an explanatory message. **Download PNG** saves the same 1200 x 800 image directly. Postcards are generated locally in the browser and contain no captured or uploaded photos. Cancelling the share sheet leaves the result unchanged; export or sharing errors are shown with retry/download options.

The app is a React frontend plus a small Node/Express backend. **The TypeSafe API key lives only on the server**, read from the `TYPESAFE_API_KEY` environment variable. The browser never sees it.

```text
Browser: image + challengeId (no key)
  -> POST /api/jev on the same origin
  -> Express reads TYPESAFE_API_KEY, builds the Jev request from the trusted challenge catalogue
  -> POST https://api.typesafe.ai/v1/systemone (multipart image + experimental images header)
  -> Server validates the response shape and returns it
  -> Browser parses it -> presence gate -> overlay and scoring
```

In production the same Express process also serves the built frontend (`dist/`), so there is one deployable and no CORS.

## Project layout

| Path | Responsibility |
| --- | --- |
| [server/index.ts](server/index.ts) | Express backend: `/api/health`, `/api/jev`, static hosting, upload limits, per-IP rate limit |
| [src/App.tsx](src/App.tsx) | Game UI, consent modal, investigation orchestration, scoring and mission state |
| [src/services/jev/ServerJevClient.ts](src/services/jev/ServerJevClient.ts) | Browser client for `/api/jev` and `/api/health` |
| [src/services/jev/requestBuilder.ts](src/services/jev/requestBuilder.ts) | TypeSafe assets and questions (used by the server) |
| [src/services/jev/responseParser.ts](src/services/jev/responseParser.ts) | Runtime response validation (used by server and browser) |
| [src/data/challenges.ts](src/data/challenges.ts) | Challenge catalogue (the server only accepts known `challengeId`s) |
| [src/config.ts](src/config.ts) | Model, presence threshold, mirroring configuration |
| [vite.config.js](vite.config.js) | React plugin; proxies `/api` to the local backend in dev |
| [Dockerfile](Dockerfile) | Container image for Azure Container Apps |
| [.env.example](.env.example) | Template for local secrets |

## Run locally

Prerequisites: Node.js 22.12+ and npm, a TypeSafe API key, and a camera on `localhost`/HTTPS (or a JPG/PNG to upload).

### Where to put the key locally

1. Copy the template: `Copy-Item .env.example .env`
2. Open `.env` in the project root and set:

   ```dotenv
   TYPESAFE_API_KEY=your-typesafe-key-here
   ```

3. Run `npm install`, then `npm run dev`.

`.env` is git-ignored and Docker-ignored. The server loads it at startup using Node's built-in `process.loadEnvFile`; variables already set in the environment (for example Azure app settings) always take precedence. Do **not** use a `VITE_` prefix: Vite bundles those into browser code.

`npm run dev` starts the Vite frontend (printed URL, normally `http://localhost:5173`) and the backend on `http://localhost:8787` together. The header shows **Jev online** when the server has a key. Restart `npm run dev` after editing `.env`; the key is read from the environment when the process starts.

### Checks and build

```powershell
npm run lint
npm run typecheck
npm test
npm run build      # vite build -> dist/, then esbuild -> dist-server/index.js
npm start          # serves dist/ and /api from one process (set TYPESAFE_API_KEY first)
```

## Configuration

| Variable | Required | Default | Purpose |
| --- | --- | --- | --- |
| `TYPESAFE_API_KEY` | yes | none | Secret TypeSafe key used by the backend |
| `PORT` | no | `8787` (container image: `8080`) | HTTP port |
| `JEV_RATE_LIMIT_PER_MINUTE` | no | `20` | Per-IP analysis requests per minute (in-memory, per instance) |
| `TYPESAFE_API_URL` | no | `https://api.typesafe.ai/v1/systemone` | Override upstream endpoint |

## Security and abuse notes

- The browser sends only an image and a `challengeId`. The server owns the prompts, model, headers, and key, and rejects unknown challenges, non-JPG/PNG uploads, and images over 12 MiB.
- The key is never logged or returned. Errors to the browser are generic.
- Anyone who can open the site can spend your TypeSafe quota. The built-in limiter is a small in-memory per-IP guard (it resets on restart and is per instance). Before public use, add authentication (Container Apps built-in auth), a shared rate limiter or gateway (e.g. Azure API Management/Front Door), monitoring, and TypeSafe budget alerts.
- Images are held in server memory only for the duration of the request and are not written to disk or logged by this app.

## Privacy

Camera access starts only after an explicit action; one still frame is captured per investigation. A consent modal appears at the start of every session: images are sent through this app's server to TypeSafe for processing; TypeSafe does not reuse them for training but may store them temporarily for security reasons ([Legal - TypeSafe](https://docs.typesafe.ai/legal)). Avoid IDs, payment cards, passwords, private correspondence, sensitive screens, and other people without consent.

## Jev contract notes

- Model `jev-preview`, set in [src/config.ts](src/config.ts). Images and Box are experimental in TypeSafe's documentation; recheck the docs before changing the integration.
- Multipart upload: first part `request` (JSON), image bytes in a separate named part, with header `TypeSafe-Danger-Zone-Images: true`.
- Questions: `presence` (Noul), `target` (Box), `match` (Score, 5 levels), `category` (Choice).
- A Box always returns coordinates, so only a presence probability at or above `PROTOTYPE_PRESENCE_THRESHOLD` (`0.72`) displays it and awards points. Probabilities below `0.35` mean no match; in between is inconclusive.
- Scoring is deterministic frontend code; model confidence is not factual correctness.

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| Header shows **Jev offline** | `TYPESAFE_API_KEY` is missing, or the backend is not running. Check `.env` / app settings and `/api/health`. |
| Analysis returns 503 "TYPESAFE_API_KEY is missing" | Create `.env` from `.env.example` and restart. |
| "credentials were rejected" | The configured key is invalid or expired; rotate it. |
| Port already in use | Set `PORT` (and update the proxy in [vite.config.js](vite.config.js) for local dev). |
| Camera blocked | Use `localhost` or HTTPS and allow camera permission, or upload an image. |
