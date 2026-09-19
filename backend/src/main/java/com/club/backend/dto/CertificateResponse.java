package com.club.backend.dto;

import java.time.Instant;
import java.util.UUID;

import com.club.backend.entity.Certificate;

public record CertificateResponse(UUID id, UUID userId, UUID clubId, String clubName, Instant issuedAt,
        String verificationCode) {

    public static CertificateResponse from(Certificate certificate) {
        return new CertificateResponse(
                certificate.getId(),
                certificate.getUser().getId(),
                certificate.getClub().getId(),
                certificate.getClub().getName(),
                certificate.getIssuedAt(),
                certificate.getVerificationCode());
    }
}
