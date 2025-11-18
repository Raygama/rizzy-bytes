# Setup Guide for Developers

## Issue: `PathError [TypeError]: Missing parameter name at index 5`

If you're seeing errors like:
```
PathError [TypeError]: Missing parameter name at index 5
```
in containers (mail-service, broker-service, etc.) while other developers' setups work fine, follow these steps.

### Root Cause
This is a **dependency version mismatch** in `node_modules`. The issue occurs when `npm install` picks transitive dependency versions that differ from those locked in `package-lock.json`.

---

## Solution Steps

### 1. Clean Your Local Environment
```bash
# Delete node_modules and npm cache
rm -r node_modules package-lock.json   # macOS/Linux
rmdir /s node_modules                   # Windows (if no lock file)

# Clear npm cache globally
npm cache clean --force
```

### 2. Reinstall Dependencies (Use `npm ci`)
**Important:** Always use `npm ci` (clean install) instead of `npm install` in development and CI/CD. This respects `package-lock.json` exactly.

```bash
# For the entire project (if using a monorepo structure):
npm ci

# Or for individual services:
cd mail-service && npm ci
cd ../broker-service && npm ci
cd ../authentication-service && npm ci
# ... etc for each service
```

### 3. Rebuild Docker Images
If using Docker Compose, force a rebuild of images (this will apply the updated Dockerfiles):

```bash
# Rebuild all services with no cache
docker-compose build --no-cache

# Then start them
docker-compose up -d

# Or rebuild + start in one command
docker-compose up -d --build
```

### 4. Verify Node & npm Versions Match
Ensure you're using **Node.js v20.x** (the project uses `node:20-alpine` Docker images).

```bash
node --version    # Should be >= 20.0.0
npm --version     # Should be >= 10.0.0
```

If you have an older version, upgrade Node.js from [nodejs.org](https://nodejs.org).

---

## What Changed (Automatic Fixes)

- **Dockerfiles**: Updated all services to use `npm ci --only=production` instead of `npm install`
  - `npm ci` respects lock files exactly, preventing transitive dependency upgrades
  - `--only=production` skips dev dependencies in containers (faster, cleaner images)

- **.npmrc files**: Added per-service `.npmrc` files to enforce:
  - `legacy-peer-deps=false` (strict peer dependency handling)
  - Deterministic installs from lock files

---

## Troubleshooting

### If errors persist after clean install:

1. **Update npm globally:**
   ```bash
   npm install -g npm@latest
   ```

2. **Regenerate lock files (if they're corrupted):**
   ```bash
   # Back up old lock files first
   cp package-lock.json package-lock.json.backup
   
   # Delete and regenerate
   rm package-lock.json
   npm install
   ```

3. **Check for Node.js version conflicts:**
   - If using **nvm** (Node Version Manager): `nvm use 20`
   - If using **Docker**, ensure you're not mixing host Node with container Node

4. **Verify the error isn't in the code:**
   - Run a single service locally (without Docker) to isolate the issue:
     ```bash
     cd mail-service
     npm ci
     npm run dev
     ```

### Still stuck?

- Check Docker logs: `docker-compose logs mail-service`
- Check the actual service startup: Does it run fine if you `npm ci && npm run dev` locally?
- Share the full error output and Node/npm versions.

---

## Best Practices Going Forward

✅ **Always commit `package-lock.json`** to git (and `package.json`)  
✅ **Use `npm ci`** for reproducible installs (in CI, Docker, local dev)  
✅ **Use `npm install`** only when intentionally adding/updating dependencies  
✅ **Test locally before pushing** (especially Dockerfile changes)  
✅ **Use Node v20.x** to match the Docker base image  

