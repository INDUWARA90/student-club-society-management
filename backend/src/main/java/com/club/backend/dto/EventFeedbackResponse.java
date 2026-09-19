package com.club.backend.dto;

import java.time.Instant;
import java.util.UUID;

import com.club.backend.entity.EventFeedback;

public record EventFeedbackResponse(
        UUID id, UUID eventId, UUID userId, String userName, int rating, String comment, Instant createdAt) {

    public static EventFeedbackResponse from(EventFeedback feedback) {
        return new EventFeedbackResponse(
                feedback.getId(),
                feedback.getEvent().getId(),
                feedback.getUser().getId(),
                feedback.getUser().getName(),
                feedback.getRating(),
                feedback.getComment(),
                feedback.getCreatedAt());
    }
}
