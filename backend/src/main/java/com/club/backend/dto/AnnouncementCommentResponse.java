package com.club.backend.dto;

import java.time.Instant;
import java.util.UUID;

import com.club.backend.entity.AnnouncementComment;

public record AnnouncementCommentResponse(
        UUID id, UUID announcementId, UUID authorId, String authorName, String content, Instant createdAt) {

    public static AnnouncementCommentResponse from(AnnouncementComment comment) {
        return new AnnouncementCommentResponse(
                comment.getId(),
                comment.getAnnouncement().getId(),
                comment.getAuthor().getId(),
                comment.getAuthor().getName(),
                comment.getContent(),
                comment.getCreatedAt());
    }
}
