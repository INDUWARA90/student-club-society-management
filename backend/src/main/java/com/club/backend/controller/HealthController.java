package com.club.backend.controller;

import java.util.Map;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

/**
 * Public liveness/readiness probe for load balancers, Docker and the deployment pipeline: 200 only when the app can
 * actually reach its database, 503 otherwise. Reveals nothing beyond up/down.
 */
@RestController
@RequestMapping("/api/health")
@RequiredArgsConstructor
@Slf4j
public class HealthController {

    private final JdbcTemplate jdbcTemplate;

    /** The deployed commit (set by the container or host); lets the pipeline confirm the new version is the live one. */
    @Value("${app.version:unknown}")
    private String version;

    @GetMapping
    public ResponseEntity<Map<String, String>> health() {
        try {
            jdbcTemplate.queryForObject("SELECT 1", Integer.class);
            return ResponseEntity.ok(Map.of("status", "UP", "database", "UP", "version", version));
        } catch (Exception e) {
            log.warn("Health check failed: {}", e.getMessage());
            return ResponseEntity.status(503).body(Map.of("status", "DOWN", "database", "DOWN", "version", version));
        }
    }
}
