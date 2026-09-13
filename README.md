# Student Club & Society Management System

Full spec: [`full-spec.md`](./full-spec.md).

This repo holds two independent projects side by side (not a monorepo with shared tooling/workspaces — each has its own dependencies and build):

- [`backend/`](./backend) — Spring Boot (Maven)
- [`frontend/`](./frontend) — React (Vite)

## Local dev

Copy the env template and fill in real values (see [`.env.example`](./.env.example)):

```bash
cp .env.example .env
cp .env.example backend/.env   # only needed if you run the backend outside Docker
```

```bash
docker compose up
```

- Backend: http://localhost:8080
- Frontend: http://localhost:5173
- Swagger UI: http://localhost:8080/swagger-ui.html
- MySQL: localhost:3306

> Note: `full-spec.md` specifies PostgreSQL, but this project runs on MySQL instead (project decision).

Or run each separately:

```bash
cd backend && ./mvnw spring-boot:run
cd frontend && npm install && npm run dev
```
