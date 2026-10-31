package com.club.backend.dto;

import java.math.BigDecimal;
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
        Instant createdAt,
        BigDecimal membershipFee,
        Integer certificateThreshold,
        boolean archived,
        Long memberCount,
        boolean showBudgetToMembers) {

    public ClubResponse(UUID id, String name, String description, String category, ClubStatus status,
            JoinPolicy joinPolicy, String logoB64, UUID createdBy, Instant createdAt, BigDecimal membershipFee,
            Integer certificateThreshold, boolean archived) {
        this(id, name, description, category, status, joinPolicy, logoB64, createdBy, createdAt, membershipFee,
                certificateThreshold, archived, null, false);
    }

    public ClubResponse(UUID id, String name, String description, String category, ClubStatus status,
            JoinPolicy joinPolicy, String logoB64, UUID createdBy, Instant createdAt, BigDecimal membershipFee,
            Integer certificateThreshold, boolean archived, Long memberCount) {
        this(id, name, description, category, status, joinPolicy, logoB64, createdBy, createdAt, membershipFee,
                certificateThreshold, archived, memberCount, false);
    }

    public static ClubResponse from(Club club) {
        return from(club, null);
    }

    public static ClubResponse from(Club club, Long memberCount) {
        return new ClubResponse(
                club.getId(),
                club.getName(),
                club.getDescription(),
                club.getCategory(),
                club.getStatus(),
                club.getJoinPolicy(),
                club.getLogoB64(),
                club.getCreatedBy().getId(),
                club.getCreatedAt(),
                club.getMembershipFee(),
                club.getCertificateThreshold(),
                club.isArchived(),
                memberCount,
                club.isShowBudgetToMembers());
    }
}
