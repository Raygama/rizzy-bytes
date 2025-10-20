# 🧩 AI Helpdesk Chatbot

This repository contains the implementation for the **AI Helpdesk Chatbot** project.  
It follows a **microservices architecture** where each core responsibility is separated into its own service.  

The goal is to support features described in the SRS:
- Student/Staff/Sponsor authentication with OTP
- Multi-turn chatbot backed by Knowledge Base (KB)
- Asynchronous compute tasks for KB indexing & LLM jobs
- Email notifications from OTP
- Logging & monitoring
- Scalable infrastructure with RabbitMQ, MongoDB, Redis

---

## 📦 Service Responsibilities

authentication-service:
- User login via email OTP
- Integrates with Keycloak to issue JWTs
- Stores OTPs temporarily in Redis

broker-service:
- Exposes API endpoints that publish tasks to RabbitMQ

listener-service:
- Consumes RabbitMQ jobs asynchronously
- Processes updates, background tasks, etc

logger-service:
- Collects logs from other services

mail-service:
- Sends OTP codes and notifications via SMTP
- Uses template system for consistent emails

front-end
- UI service Next.js 
- Can be expanded to admin dashboard / student portal

project:
- Contains Docker Compose config
- Manages infra dependencies (Mongo, Redis, RabbitMQ)

---


## 🧰 Core Technologies

- **Node.js + Express** → Service framework  
- **MongoDB** → Knowledge Base & metadata store  
- **Redis** → OTP storage, caching  
- **RabbitMQ** → Message broker for async jobs  
- **Keycloak** → Identity provider (RBAC, JWT)  
- **Docker Compose** → Local orchestration  
- **Prometheus/Grafana** (later) → Monitoring & compute evaluation  

---

## Getting Started

### 1. Clone Repo
```bash
git clone github.com/Raygama/rizzy-bytes
```
### 2. Start Services with Docker Compose
```bash
cd project
docker compose up --build
```

## For dev and prod:
For dev:
```bash
docker compose -f docker-compose.yml -f docker-compose.override.yml up
```
→ Runs npm run dev with hot reload.

For prod:
```bash
docker compose up --build
```

→ Runs the optimized build (npm run build && npm run start).


## Development Notes
- Each service is self-contained with its own package.json.
- Use .env inside each service for secrets & configs.
- Use docker-compose for local dev;
- Write unit tests inside each service (__tests__/ or test/ directories) (if needed)


# Rebuilding Docker Containers

In most cases, you **do not need to rebuild the Docker images** every time you change your code.  
Thanks to **volumes** and **hot reload**, code changes update live.  
However, there are specific situations where a rebuild is required.


## When you add new dependencies

If you install a new npm package inside a service:

```bash
cd authentication-service
npm install some-package
```

Then you must rebuild that container so the new dependency is included:
``` bash
docker compose build authentication-service
docker compose up
```

## When you change Dockerfile or docker-compose.yml

If you modify:
- The Dockerfile (e.g., base image, build steps, commands)
- The docker-compose.yml (e.g., new service, environment variables)

Then you need to rebuild all services:
``` bash
docker compose build
docker compose up
```
## When you do NOT need to rebuild
- Editing code files (JavaScript/TypeScript, routes, controllers, etc.)
- Updating configs inside .env (unless baked into Dockerfile)
- Using Next.js hot reload or nodemon in development mode

# 🛑 Shutting Down the Application

When you are done testing or developing, you can stop the running containers in several ways.  
This prevents services like MongoDB, Redis, RabbitMQ, and the microservices from running in the background.

---

## Stop All Containers

If you started services with:
```bash
docker compose up
```
then simply press:
CTRL + C (in the terminal) → this will stop all running services.

docker compose -f docker-compose.yml -f docker-compose.override.yml down

If you want to stop and remove containers explicitly:
```bash
docker compose -f docker-compose.yml -f docker-compose.override.yml down
```

## Summary
- Dev Start → docker compose -f docker-compose.yml -f docker-compose.override.yml up
- Dev Stop → docker compose -f docker-compose.yml -f docker-compose.override.yml down or CTRL+C
- Prod Start → docker compose up --build
- Prod Stop → docker compose down or CTRL+C
