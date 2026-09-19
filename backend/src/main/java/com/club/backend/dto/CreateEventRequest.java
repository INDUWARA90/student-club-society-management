package com.club.backend.dto;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

public record CreateEventRequest(
        String title,
        String description,
        String location,
        String bannerB64,
        Instant eventDate,
        BigDecimal fee,
        Integer capacity,
        UUID venueId,
        Instant endDate,
        BigDecimal budget) {

    public CreateEventRequest(String title, String description, String location, String bannerB64, Instant eventDate,
            BigDecimal fee, Integer capacity, UUID venueId, Instant endDate) {
        this(title, description, location, bannerB64, eventDate, fee, capacity, venueId, endDate, null);
    }
}
