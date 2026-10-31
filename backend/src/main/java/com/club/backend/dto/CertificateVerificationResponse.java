package com.club.backend.dto;

import java.time.Instant;

/** Public result of verifying a certificate code; only non-sensitive fields are exposed. */
public record CertificateVerificationResponse(
        boolean valid,
        String holderName,
        String clubName,
        String clubCategory,
        String clubLogoB64,
        Instant issuedAt) {

    public CertificateVerificationResponse(boolean valid, String holderName, String clubName, Instant issuedAt) {
        this(valid, holderName, clubName, null, null, issuedAt);
    }
}
