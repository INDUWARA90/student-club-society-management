package com.club.backend.service;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Instant;
import java.util.Base64;
import java.util.UUID;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

/**
 * Short-lived, unguessable tokens embedded in the check-in QR code. A token is an HMAC of the event id and a
 * 5-minute window; the current and previous window are accepted, so a QR shown on screen rotates and a link
 * copied out of it stops working within ~10 minutes. Knowing only the event id is no longer enough to check in.
 */
@Service
public class CheckInTokenService {

    static final long WINDOW_SECONDS = 300;

    private final byte[] key;

    public CheckInTokenService(@Value("${app.jwt.secret}") String secret) {
        this.key = ("checkin:" + secret).getBytes(StandardCharsets.UTF_8);
    }

    public String generate(UUID eventId) {
        return sign(eventId, currentWindow());
    }

    public boolean isValid(UUID eventId, String token) {
        if (token == null || token.isBlank()) {
            return false;
        }
        long window = currentWindow();
        return matches(token, sign(eventId, window)) || matches(token, sign(eventId, window - 1));
    }

    private long currentWindow() {
        return Instant.now().getEpochSecond() / WINDOW_SECONDS;
    }

    private boolean matches(String provided, String expected) {
        return MessageDigest.isEqual(provided.getBytes(StandardCharsets.UTF_8), expected.getBytes(StandardCharsets.UTF_8));
    }

    private String sign(UUID eventId, long window) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(key, "HmacSHA256"));
            byte[] digest = mac.doFinal((eventId + ":" + window).getBytes(StandardCharsets.UTF_8));
            return Base64.getUrlEncoder().withoutPadding().encodeToString(digest).substring(0, 24);
        } catch (Exception e) {
            throw new IllegalStateException("Could not sign check-in token", e);
        }
    }
}
