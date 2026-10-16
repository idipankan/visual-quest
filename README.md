# Jev Vision Quest

A React + TypeScript visual common-sense game powered by Jev. Find an object that fits a mission, capture one webcam frame (or upload a JPG/PNG), and investigate it. Jev returns typed judgments; the app decides what to display and how many points to award.

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
| [Dockerfile](Dockerfile) | Container image for Azure Container Apps / App Service |
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

## Deploy to Azure

Never put the key in the repository, the Dockerfile, or a frontend build variable. Store it as a secret/app setting.

### Option A: Azure Container Apps (container)

```powershell
$RG = "jev-rg"; $ENV = "jev-env"; $APP = "jev-vision-quest"; $ACR = "<your-unique-acr-name>"
az group create -n $RG -l westeurope
az acr create -n $ACR -g $RG --sku Basic
az acr build -r $ACR -t jev-vision-quest:1 .
az containerapp env create -n $ENV -g $RG -l westeurope

az containerapp create -n $APP -g $RG --environment $ENV `
  --image "$ACR.azurecr.io/jev-vision-quest:1" `
  --registry-server "$ACR.azurecr.io" --registry-identity system `
  --target-port 8080 --ingress external `
  --secrets typesafe-api-key="<your-typesafe-key>" `
  --env-vars TYPESAFE_API_KEY=secretref:typesafe-api-key
```

Rotate the key with `az containerapp secret set -n $APP -g $RG --secrets typesafe-api-key=<new>` and then create a new revision (`az containerapp update ...`), because secret changes do not apply to running revisions. For stronger handling, reference an Azure Key Vault secret using the app's managed identity.

### Option B: Azure App Service (Linux)

Step-by-step guide, including GitHub Actions auto-deploy on every push: **[docs/DEPLOY_APP_SERVICE.md](docs/DEPLOY_APP_SERVICE.md)**. In short: create a Linux Node 22 App Service, set the `TYPESAFE_API_KEY` app setting, set the startup command to `node dist-server/index.js`, and connect the repo; the workflow in [.github/workflows/azure-app-service.yml](.github/workflows/azure-app-service.yml) builds and deploys it. (App Service does not build this app from a bare repo on its own.) You can alternatively deploy the same container image from Option A.

### Verify

```powershell
curl https://<your-app-host>/api/health   # {"jevConfigured":true}
```

## Security and abuse notes

- The browser sends only an image and a `challengeId`. The server owns the prompts, model, headers, and key, and rejects unknown challenges, non-JPG/PNG uploads, and images over 12 MiB.
- The key is never logged or returned. Errors to the browser are generic.
- Anyone who can open the site can spend your TypeSafe quota. The built-in limiter is a small in-memory per-IP guard (it resets on restart and is per instance). Before public use, add authentication (App Service/Container Apps built-in auth), a shared rate limiter or gateway (e.g. Azure API Management/Front Door), monitoring, and TypeSafe budget alerts.
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
