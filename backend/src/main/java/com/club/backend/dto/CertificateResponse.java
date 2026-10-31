package com.club.backend.dto;

import java.time.Instant;
import java.util.UUID;

import com.club.backend.entity.Certificate;

public record CertificateResponse(
        UUID id,
        UUID userId,
        UUID clubId,
        String clubName,
        String clubCategory,
        String clubLogoB64,
        String holderName,
        Instant issuedAt,
        String verificationCode) {

    public static CertificateResponse from(Certificate certificate) {
        String category = certificate.getClub() != null ? certificate.getClub().getCategory() : "General";
        String logo = certificate.getClub() != null ? certificate.getClub().getLogoB64() : null;
        String holder = certificate.getUser() != null ? certificate.getUser().getName() : "Student";
        return new CertificateResponse(
                certificate.getId(),
                certificate.getUser().getId(),
                certificate.getClub().getId(),
                certificate.getClub().getName(),
                category,
                logo,
                holder,
                certificate.getIssuedAt(),
                certificate.getVerificationCode());
    }
}
