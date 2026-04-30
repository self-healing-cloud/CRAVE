# DevOps Architecture & Ecosystem Analysis

## Phase 1: Deep Codebase & Ecosystem Analysis

### 1. Architecture & Patterns
- **Current Pattern**: Monolithic API Gateway-ish Backend (FastAPI) and SPA Frontend (React). Containerised via Docker Compose.
- **Anti-patterns / Tech Debt**:
  - Frontend Dockerfile uses the Vite dev server (`npm run dev`) bound to all interfaces. This is highly unsuitable for production as it runs in development mode, uses excessive resources, and lacks production optimizations.
  - Backend Dockerfile runs `uvicorn ... --reload`, which is meant for development only and can cause memory leaks and performance drops in production.
  - Database initialization (`python init_db.py`) runs every time the backend container starts in `docker-compose.yml` inline. This can cause race conditions if scaled horizontally, though fine for a single instance.
- **Bottlenecks**: SQLite or unoptimized Postgres queries, lack of connection pooling. Redis is used but the current infrastructure doesn't configure it for high availability.

### 2. Dependencies & Security
- **Security Vulnerabilities**:
  - The containers run as root (no `USER` instruction in Dockerfiles).
  - Hardcoded secrets in `docker-compose.yml`.
  - CORS is relatively open (`["*"]` or multiple localhosts).

### 3. Surrounding Ecosystem
- **Existing Setup**: Simple Docker Compose file mapping local ports. Perfect for local dev.
- **Missing for Production**:
  - Production-ready Dockerfiles (multi-stage builds for frontend using Nginx, using production start commands for backend without `--reload`).
  - Kubernetes/Container Orchestration manifests (Deployments, Services, ConfigMaps, Secrets, Ingress).

## Phase 2: K8s vs. K3s Recommendation

### Resource Efficiency
The application consists of a FastAPI backend, a React frontend, a Python injector, Redis, and PostgreSQL. It is a typical medium-complexity stack. Full Kubernetes (K8s) requires a heavy control plane (etcd, kube-apiserver, etc.) which consumes significant RAM and CPU just to run the cluster. K3s replaces etcd with SQLite (by default) and strips out legacy cloud providers, making it incredibly lightweight and edge-optimized. Given this is an internal tool with peak load of 100-500 requests to be deployed on a single VPS, **K3s is far more resource-efficient and appropriate**.

### Scalability & High Availability
For the realistic scaling needs of this specific application (internal demo tool, low traffic), K3s can easily handle the load on a single server, while offering native kubernetes orchestration features. Full K8s would be massive overkill.

### Operational Complexity
K3s is a single binary. It is dramatically easier to install, upgrade, and maintain compared to full K8s. The operational burden of managing a full K8s cluster for a solo DevOps engineer is too high. K3s provides the best balance, giving the full Kubernetes API with a fraction of the maintenance burden.

### Final Verdict: K3s
**Recommendation**: **K3s**.
**Why**: The codebase is a well-contained multi-tier application. Given the operational constraints (solo devops/minimal resources, deployed on a single VPS) and scalability constraints (internal demo, 100-500 peak requests), K3s is the perfect fit. It provides 100% API compatibility for all necessary resources (Deployments, Services, Ingress, etc.) while keeping the infrastructure cost, resource footprint, and operational overhead to an absolute minimum.

## Phase 3: Actionable Roadmap

1. **Fix Dockerfiles for Production**
   - *Frontend*: Convert to a multi-stage build. Stage 1: `npm run build`. Stage 2: Serve static files using `nginx:alpine`.
   - *Backend*: Remove `--reload` from the startup command.
2. **Create Kubernetes (K3s) Manifests**
   - Create a `k8s/` directory.
   - Implement `ConfigMap` and `Secret` for environment variables.
   - Implement `Deployment` and `Service` for:
     - PostgreSQL (with PersistentVolumeClaim)
     - Redis (with PersistentVolumeClaim)
     - Backend API
     - Frontend (Nginx)
     - Injector Service
   - Implement an `Ingress` resource (using Traefik, the default in K3s) to route external traffic to the Frontend and Backend.
3. **Commit Unified Changes**
   - All code adjustments, Dockerfile rewrites, and K8s manifests will be committed to the current branch.
