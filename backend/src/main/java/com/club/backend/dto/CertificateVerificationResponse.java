package com.club.backend.dto;

import java.time.Instant;

/** Public result of verifying a certificate code; only non-sensitive fields are exposed. */
public record CertificateVerificationResponse(boolean valid, String holderName, String clubName, Instant issuedAt) {
}
