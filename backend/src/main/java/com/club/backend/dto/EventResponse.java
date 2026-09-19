package com.club.backend.dto;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

import com.club.backend.entity.Event;
import com.club.backend.entity.EventApprovalStatus;

public record EventResponse(
        UUID id,
        UUID clubId,
        String clubName,
        String title,
        String description,
        String location,
        String bannerB64,
        Instant eventDate,
        BigDecimal fee,
        Integer capacity,
        boolean requiresFaApproval,
        EventApprovalStatus approvalStatus,
        Instant createdAt,
        UUID venueId,
        String venueName,
        String venueBuilding,
        Instant endDate,
        boolean cancelled,
        String cancelReason,
        String rejectionReason,
        BigDecimal budget) {

    public static EventResponse from(Event event) {
        return new EventResponse(
                event.getId(),
                event.getClub().getId(),
                event.getClub().getName(),
                event.getTitle(),
                event.getDescription(),
                event.getLocation(),
                event.getBannerB64(),
                event.getEventDate(),
                event.getFee(),
                event.getCapacity(),
                event.isRequiresFaApproval(),
                event.getApprovalStatus(),
                event.getCreatedAt(),
                event.getVenue() != null ? event.getVenue().getId() : null,
                event.getVenue() != null ? event.getVenue().getName() : null,
                event.getVenue() != null ? event.getVenue().getBuilding() : null,
                event.getEndDate(),
                event.isCancelled(),
                event.getCancelReason(),
                event.getRejectionReason(),
                event.getBudget());
    }
}
