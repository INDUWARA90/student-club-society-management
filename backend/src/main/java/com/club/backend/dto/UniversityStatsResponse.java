package com.club.backend.dto;

import java.math.BigDecimal;

public record UniversityStatsResponse(
        long totalClubs,
        long totalStudents,
        long totalEvents,
        BigDecimal totalPaymentsCollected,
        long pendingClubProposals,
        long pendingEventApprovals) {
}
