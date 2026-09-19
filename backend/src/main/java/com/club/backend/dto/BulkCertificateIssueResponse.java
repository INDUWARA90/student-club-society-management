package com.club.backend.dto;

public record BulkCertificateIssueResponse(
        int consideredCount, int issuedCount, int alreadyIssuedCount, int notYetEligibleCount) {
}
