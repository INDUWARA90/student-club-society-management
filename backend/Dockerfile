# syntax=docker/dockerfile:1

# ---- build -----------------------------------------------------------------------------------------------------
FROM maven:3-eclipse-temurin-24 AS build
WORKDIR /app
COPY pom.xml .
RUN --mount=type=cache,target=/root/.m2 mvn -q -B dependency:go-offline
COPY src ./src
# Tests need a database, so they run in CI (backend workflow) rather than inside the image build.
RUN --mount=type=cache,target=/root/.m2 mvn -q -B -DskipTests package

# ---- run -------------------------------------------------------------------------------------------------------
FROM eclipse-temurin:21-jre-noble
RUN apt-get update \
    && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/* \
    && groupadd --system app \
    && useradd --system --gid app --home-dir /app --shell /usr/sbin/nologin app
WORKDIR /app
COPY --from=build /app/target/*.jar app.jar
USER app

# The commit this image was built from; reported by /api/health so a deploy can be verified.
ARG GIT_SHA=""
ENV APP_VERSION=${GIT_SHA} \
    JAVA_OPTS="-XX:MaxRAMPercentage=75 -XX:+ExitOnOutOfMemoryError"

EXPOSE 5000
HEALTHCHECK --interval=30s --timeout=5s --start-period=120s --retries=3 \
    CMD curl -fsS "http://localhost:${PORT:-5000}/api/health" || exit 1

# APP_VERSION is empty unless built by the pipeline; fall back to the host's own commit variable (e.g. Render).
ENTRYPOINT ["sh", "-c", "exec java $JAVA_OPTS -Dapp.version=${APP_VERSION:-${RENDER_GIT_COMMIT:-unknown}} -jar app.jar"]
