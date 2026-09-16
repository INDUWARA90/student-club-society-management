package com.club.backend.dto;

import java.math.BigDecimal;
import java.time.Instant;

public record CreateEventRequest(
        String title,
        String description,
        String location,
        String bannerB64,
        Instant eventDate,
        BigDecimal fee,
        Integer capacity) {
}
