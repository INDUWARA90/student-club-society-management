package com.club.backend.dto;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

public record UniversityStatsResponse(
        long totalClubs,
        long totalStudents,
        long totalEvents,
        BigDecimal totalPaymentsCollected,
        long pendingClubProposals,
        long pendingEventApprovals,
        List<ClubPaymentStat> clubPayments) {

    public UniversityStatsResponse(
            long totalClubs,
            long totalStudents,
            long totalEvents,
            BigDecimal totalPaymentsCollected,
            long pendingClubProposals,
            long pendingEventApprovals) {
        this(totalClubs, totalStudents, totalEvents, totalPaymentsCollected,
                pendingClubProposals, pendingEventApprovals, List.of());
    }

    public record ClubPaymentStat(
            UUID clubId,
            String clubName,
            String clubCategory,
            BigDecimal membershipPayments,
            BigDecimal eventPayments,
            BigDecimal totalCollected,
            long transactionCount) {}
}
