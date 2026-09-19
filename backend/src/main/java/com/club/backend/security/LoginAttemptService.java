package com.club.backend.security;

import java.time.Instant;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

import org.springframework.stereotype.Service;

/**
 * Per-account brute-force protection: after {@value #MAX_FAILURES} consecutive failed logins an account is locked
 * for {@value #LOCK_MINUTES} minutes, regardless of source IP (the IP rate limit alone can't stop a distributed
 * attack, and shared campus NATs make it too coarse). Unknown emails are tracked the same way so lockout
 * behaviour doesn't reveal which accounts exist.
 */
@Service
public class LoginAttemptService {

    static final int MAX_FAILURES = 5;
    static final long LOCK_MINUTES = 15;
    private static final int PURGE_THRESHOLD = 10_000;

    private record Attempts(int failures, Instant lockedUntil, Instant lastFailure) {
    }

    private final Map<String, Attempts> attempts = new ConcurrentHashMap<>();

    public boolean isLocked(String email) {
        Attempts entry = attempts.get(email);
        return entry != null && entry.lockedUntil() != null && entry.lockedUntil().isAfter(Instant.now());
    }

    public void recordFailure(String email) {
        Instant now = Instant.now();
        purgeIfLarge(now);
        attempts.compute(email, (key, existing) -> {
            int failures = 1;
            // A lock that has run out (or stale failures long ago) starts a fresh count.
            if (existing != null && existing.lastFailure().isAfter(now.minusSeconds(LOCK_MINUTES * 60))) {
                failures = existing.failures() + 1;
            }
            Instant lockedUntil = failures >= MAX_FAILURES ? now.plusSeconds(LOCK_MINUTES * 60) : null;
            return new Attempts(failures, lockedUntil, now);
        });
    }

    public void recordSuccess(String email) {
        attempts.remove(email);
    }

    private void purgeIfLarge(Instant now) {
        if (attempts.size() > PURGE_THRESHOLD) {
            Instant cutoff = now.minusSeconds(LOCK_MINUTES * 60);
            attempts.values().removeIf(a -> a.lastFailure().isBefore(cutoff));
        }
    }
}
