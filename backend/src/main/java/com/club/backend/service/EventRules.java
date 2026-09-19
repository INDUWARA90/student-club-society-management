package com.club.backend.service;

import java.time.Instant;

import com.club.backend.config.ApiException;
import com.club.backend.entity.Club;
import com.club.backend.entity.ClubStatus;
import com.club.backend.entity.Event;
import com.club.backend.entity.EventApprovalStatus;

/** Shared rules about whether an event/club is currently "live", so RSVP, payment and attendance agree. */
final class EventRules {

    private EventRules() {
    }

    static boolean isPublished(Event event) {
        return event.getApprovalStatus() == EventApprovalStatus.NOT_REQUIRED
                || event.getApprovalStatus() == EventApprovalStatus.APPROVED;
    }

    static boolean isClubActive(Club club) {
        return club.getStatus() == ClubStatus.APPROVED && !club.isArchived();
    }

    /** The event is published, not cancelled, its club is active, and it hasn't started yet. */
    static void requireOpenForSignup(Event event) {
        if (!isPublished(event)) {
            throw ApiException.badRequest("This event is not open for RSVPs yet");
        }
        if (event.isCancelled()) {
            throw ApiException.badRequest("This event has been cancelled");
        }
        if (!isClubActive(event.getClub())) {
            throw ApiException.badRequest("This club is not currently active");
        }
        if (event.getEventDate() != null && !event.getEventDate().isAfter(Instant.now())) {
            throw ApiException.badRequest("This event has already started");
        }
    }
}
