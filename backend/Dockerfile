# syntax=docker/dockerfile:1

# ---- build -----------------------------------------------------------------------------------------------------
FROM maven:3-eclipse-temurin-21 AS build
WORKDIR /app
COPY pom.xml .
# Standard layer caching for dependencies instead of a cache mount
RUN mvn -q -B dependency:go-offline
COPY src ./src
RUN mvn -q -B -DskipTests package

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

ARG GIT_SHA=""
ENV APP_VERSION=${GIT_SHA} \
    JAVA_OPTS="-XX:MaxRAMPercentage=75 -XX:+ExitOnOutOfMemoryError"

# Render uses its own port mapping and health checks, so we omit the Docker HEALTHCHECK block here.
EXPOSE 5000

ENTRYPOINT ["sh", "-c", "exec java $JAVA_OPTS -Dapp.version=${APP_VERSION:-${RENDER_GIT_COMMIT:-unknown}} -jar app.jar"]
