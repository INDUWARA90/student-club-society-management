package com.club.backend.dto;

import java.time.Instant;
import java.util.UUID;

import com.club.backend.entity.Club;
import com.club.backend.entity.ClubStatus;
import com.club.backend.entity.JoinPolicy;

public record ClubResponse(
        UUID id,
        String name,
        String description,
        String category,
        ClubStatus status,
        JoinPolicy joinPolicy,
        String logoB64,
        UUID createdBy,
        Instant createdAt) {

    public static ClubResponse from(Club club) {
        return new ClubResponse(
                club.getId(),
                club.getName(),
                club.getDescription(),
                club.getCategory(),
                club.getStatus(),
                club.getJoinPolicy(),
                club.getLogoB64(),
                club.getCreatedBy().getId(),
                club.getCreatedAt());
    }
}
