package com.club.backend.dto;

import java.time.Instant;
import java.util.UUID;

import com.club.backend.entity.EventComment;

public record EventCommentResponse(
        UUID id, UUID eventId, UUID authorId, String authorName, String content, Instant createdAt) {

    public static EventCommentResponse from(EventComment comment) {
        return new EventCommentResponse(
                comment.getId(), comment.getEvent().getId(), comment.getAuthor().getId(),
                comment.getAuthor().getName(), comment.getContent(), comment.getCreatedAt());
    }
}
