package com.club.backend.security;

import java.io.IOException;
import java.time.Instant;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.lang.NonNull;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

/**
 * Fixed-window rate limit for the unauthenticated / abuse-prone auth endpoints (login, register, password reset,
 * email verification), keyed by client IP + path. Prevents credential-stuffing and email-bombing without external
 * deps. Authenticated routes such as {@code /api/auth/me} are deliberately not limited.
 *
 * <p>The client IP is the socket address unless {@code app.trust-forwarded-headers=true}, which must only be set
 * when the app sits behind a proxy that overwrites {@code X-Forwarded-For} (otherwise the header is spoofable).
 */
@Component
public class RateLimitFilter extends OncePerRequestFilter {

    private static final int MAX_REQUESTS_PER_WINDOW = 10;
    private static final long WINDOW_MILLIS = 60_000;
    private static final Set<String> LIMITED_PATHS = Set.of(
            "/api/auth/login",
            "/api/auth/register",
            "/api/auth/forgot-password",
            "/api/auth/reset-password",
            "/api/auth/verify-email",
            "/api/auth/resend-verification");

    private record Window(AtomicInteger count, long windowStart) {
    }

    private final Map<String, Window> windows = new ConcurrentHashMap<>();
    private volatile long lastPurge = System.currentTimeMillis();

    private final boolean trustForwardedHeaders;

    public RateLimitFilter(@Value("${app.trust-forwarded-headers:false}") boolean trustForwardedHeaders) {
        this.trustForwardedHeaders = trustForwardedHeaders;
    }

    @Override
    protected void doFilterInternal(
            @NonNull HttpServletRequest request,
            @NonNull HttpServletResponse response,
            @NonNull FilterChain filterChain) throws ServletException, IOException {

        if (!LIMITED_PATHS.contains(request.getRequestURI())) {
            filterChain.doFilter(request, response);
            return;
        }

        String key = clientIp(request) + ":" + request.getRequestURI();
        long now = Instant.now().toEpochMilli();
        purgeExpired(now);

        Window window = windows.compute(key, (k, existing) -> {
            if (existing == null || now - existing.windowStart() > WINDOW_MILLIS) {
                return new Window(new AtomicInteger(1), now);
            }
            existing.count().incrementAndGet();
            return existing;
        });

        if (window.count().get() > MAX_REQUESTS_PER_WINDOW) {
            response.setStatus(429); // HTTP 429 Too Many Requests
            response.setContentType("application/json");
            response.getWriter().write("{\"message\":\"Too many requests, please try again later.\"}");
            return;
        }

        filterChain.doFilter(request, response);
    }

    /** Drops windows that have expired so the map can't grow without bound; runs at most once a minute. */
    private void purgeExpired(long now) {
        if (now - lastPurge < WINDOW_MILLIS) {
            return;
        }
        lastPurge = now;
        windows.entrySet().removeIf(entry -> now - entry.getValue().windowStart() > WINDOW_MILLIS);
    }

    private String clientIp(HttpServletRequest request) {
        if (trustForwardedHeaders) {
            String forwardedFor = request.getHeader("X-Forwarded-For");
            if (forwardedFor != null && !forwardedFor.isBlank()) {
                return forwardedFor.split(",")[0].trim();
            }
        }
        return request.getRemoteAddr();
    }
}
