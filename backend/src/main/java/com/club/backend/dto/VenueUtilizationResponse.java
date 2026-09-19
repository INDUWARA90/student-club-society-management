package com.club.backend.dto;

import java.time.Instant;
import java.util.UUID;

public record VenueUtilizationResponse(
        UUID venueId,
        String venueName,
        String building,
        long totalBookings,
        long upcomingBookingCount,
        NextBookingSummary nextBooking) {

    public record NextBookingSummary(UUID eventId, String title, String clubName, Instant eventDate, Instant endDate) {
    }
}
