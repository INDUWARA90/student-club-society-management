package com.club.backend.dto;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

public record ClubStatsResponse(
        long memberCount, long eventCount, long totalRsvps, long totalAttendance,
        BigDecimal totalIncome, BigDecimal totalExpenses, BigDecimal balance,
        double attendanceRatePercent, double averageEventRating, List<EventEngagement> events) {

    /** Per-event RSVP vs attendance, so officers can see no-shows and how well the event was received. */
    public record EventEngagement(
            UUID eventId, String title, long going, long attended, long noShows, double averageRating) {
    }

    public ClubStatsResponse(long memberCount, long eventCount, long totalRsvps, long totalAttendance,
            BigDecimal totalIncome, BigDecimal totalExpenses, BigDecimal balance) {
        this(memberCount, eventCount, totalRsvps, totalAttendance, totalIncome, totalExpenses, balance,
                0, 0, List.of());
    }
}
