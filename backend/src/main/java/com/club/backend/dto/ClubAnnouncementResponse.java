package com.club.backend.dto;

import java.time.Instant;
import java.util.UUID;

import com.club.backend.entity.ClubAnnouncement;

public record ClubAnnouncementResponse(
        UUID id,
        UUID clubId,
        UUID authorId,
        String authorName,
        String content,
        Instant createdAt) {

    public static ClubAnnouncementResponse from(ClubAnnouncement announcement) {
        return new ClubAnnouncementResponse(
                announcement.getId(),
                announcement.getClub().getId(),
                announcement.getAuthor().getId(),
                announcement.getAuthor().getName(),
                announcement.getContent(),
                announcement.getCreatedAt());
    }
}
