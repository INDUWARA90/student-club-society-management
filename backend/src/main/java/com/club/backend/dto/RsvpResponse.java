package com.club.backend.dto;

import java.time.Instant;
import java.util.UUID;

import com.club.backend.entity.Rsvp;
import com.club.backend.entity.RsvpStatus;

public record RsvpResponse(
        UUID id,
        UUID eventId,
        UUID userId,
        String userName,
        RsvpStatus status,
        Integer waitlistOrder,
        Instant rsvpAt) {

    public static RsvpResponse from(Rsvp rsvp) {
        return new RsvpResponse(
                rsvp.getId(),
                rsvp.getEvent().getId(),
                rsvp.getUser().getId(),
                rsvp.getUser().getName(),
                rsvp.getStatus(),
                rsvp.getWaitlistOrder(),
                rsvp.getRsvpAt());
    }
}
