# Student Club & Society Management System

Full spec: [`full-spec.md`](./full-spec.md).

This repo holds two independent projects side by side (not a monorepo with shared tooling/workspaces — each has its own dependencies and build):

- [`backend/`](./backend) — Spring Boot (Maven)
- [`frontend/`](./frontend) — React (Vite)

## Local dev

```bash
docker compose up
```

- Backend: http://localhost:8080
- Frontend: http://localhost:5173
- Swagger UI: http://localhost:8080/swagger-ui.html

Or run each separately:

```bash
cd backend && ./mvnw spring-boot:run
cd frontend && npm install && npm run dev
```
