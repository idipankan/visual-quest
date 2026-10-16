# Deploy to Azure App Service (from GitHub)

**Short answer:** yes. Push the code to GitHub and let GitHub Actions build and deploy it to App Service on every push to `main`. App Service does not build this app by itself from a bare repo; it needs a build step (Vite frontend + bundled server), which the included workflow [.github/workflows/azure-app-service.yml](../.github/workflows/azure-app-service.yml) performs. You set up the connection once; after that, `git push` deploys.

```text
git push main -> GitHub Actions: install, lint, typecheck, test, build
              -> package dist/ + dist-server/ + production node_modules
              -> deploy to App Service -> node dist-server/index.js
```

The TypeSafe key is **not** in the repo or the workflow. It is an App Service application setting.

## Prerequisites

- An Azure subscription and the [Azure CLI](https://learn.microsoft.com/cli/azure/install-azure-cli) (`az login`), or use the Azure Portal.
- A GitHub repository containing this project (`.env` is git-ignored; never commit it).
- Your TypeSafe API key.

## 1. Create the App Service

Pick a globally unique app name.

```powershell
$RG = "jev-rg"; $PLAN = "jev-plan"; $APP = "<your-unique-app-name>"

az group create -n $RG -l westeurope
az appservice plan create -n $PLAN -g $RG --is-linux --sku B1
az webapp create -n $APP -g $RG --plan $PLAN --runtime "NODE:22-lts"
```

`B1` is a sensible minimum (Free/F1 has no Always On and tight quotas). Use any region near your users.

## 2. Configure the app

```powershell
# The secret key: stored encrypted by App Service, exposed to the app as an environment variable
az webapp config appsettings set -n $APP -g $RG --settings TYPESAFE_API_KEY="<your-typesafe-key>"

# Start the bundled server (App Service sets PORT automatically)
az webapp config set -n $APP -g $RG --startup-file "node dist-server/index.js"

# Redirect HTTP to HTTPS (the camera API requires HTTPS)
az webapp update -n $APP -g $RG --https-only true
```

In the Portal: **App Service > Settings > Environment variables > App settings**. Optional extra setting: `JEV_RATE_LIMIT_PER_MINUTE`. Do not set `SCM_DO_BUILD_DURING_DEPLOYMENT`; the workflow deploys a prebuilt package.

Stronger option: store the key in Azure Key Vault and set the app setting to `@Microsoft.KeyVault(SecretUri=https://<vault>.vault.azure.net/secrets/typesafe-api-key/)` using the app's managed identity.

## 3. Connect GitHub

### Option 1 (simplest): publish profile

1. Allow basic-auth publishing, which the publish profile needs:

   ```powershell
   az resource update --resource-group $RG --name scm --namespace Microsoft.Web --resource-type basicPublishingCredentialsPolicies --parent sites/$APP --set properties.allow=true
   ```

2. Download the profile (it is a secret):

   ```powershell
   az webapp deployment list-publishing-profiles -n $APP -g $RG --xml
   ```

3. In GitHub: **Settings > Secrets and variables > Actions > New repository secret**, name `AZURE_WEBAPP_PUBLISH_PROFILE`, paste the full XML.
4. In GitHub: **Settings > Environments**, create an environment named `production` (optionally add required reviewers for approval before deploys).
5. Edit `AZURE_WEBAPP_NAME` in [azure-app-service.yml](../.github/workflows/azure-app-service.yml) to your app name.

### Option 2 (recommended for production): OIDC, no stored secret

Use a Microsoft Entra app registration with a federated credential for your repo, then replace the deploy step's `publish-profile` with an `azure/login@v2` step (`client-id`, `tenant-id`, `subscription-id` secrets, plus `permissions: id-token: write`). See Microsoft's guide: [Deploy to App Service using GitHub Actions](https://learn.microsoft.com/azure/app-service/deploy-github-actions). The Portal's **Deployment Center** can also set this up and generate a workflow for you, but replace its generated build steps with the ones in this repo's workflow (it must run `npm run build` and ship `dist-server/`).

## 4. Deploy

```powershell
git add .
git commit -m "Initial deployment"
git push origin main
```

Watch the run under the repo's **Actions** tab. You can also trigger it manually (**Run workflow**).

## 5. Verify

```powershell
curl https://$APP.azurewebsites.net/api/health   # {"jevConfigured":true}
```

Then open `https://<app>.azurewebsites.net`, accept the consent modal, and run an investigation. If the header says **Jev offline**, the `TYPESAFE_API_KEY` setting is missing. To see startup output, use **Log stream** in the Portal or `az webapp log tail -n $APP -g $RG`.

## Rotating the key

```powershell
az webapp config appsettings set -n $APP -g $RG --settings TYPESAFE_API_KEY="<new-key>"
```

The app restarts and picks up the new value; no redeploy is needed.

## Before opening it to the public

Anyone who can reach the site can spend your TypeSafe quota. The built-in rate limiter is per instance and in-memory. Consider App Service Authentication (Entra ID or others), access restrictions, Azure Front Door/API Management rate limits, Application Insights, and TypeSafe budget alerts.

## Troubleshooting

| Symptom | Likely cause / fix |
| --- | --- |
| "Application Error" / container exits | Startup command wrong or `dist-server/` missing from the package. Check Log stream; confirm startup command `node dist-server/index.js`. |
| `Cannot find package 'express'` | Package was deployed without `node_modules`. Keep the "Assemble release package" step (`npm ci --omit=dev`). |
| Deploy step fails with 401/403 | Basic-auth publishing disabled or an outdated publish profile; redo step 3.1-3.3. |
| Health shows `jevConfigured:false` | `TYPESAFE_API_KEY` app setting missing or misspelled. |
| 502 "credentials were rejected" | The key is invalid/expired; rotate it. |
| Camera does not start | Must use HTTPS (default on `azurewebsites.net`) and allow permission, or upload an image instead. |
| Large uploads fail | The server limit is 12 MiB; scale/proxy limits can be lower. |
