package com.club.backend.dto;

import java.util.UUID;

import com.club.backend.entity.User;

public record AdvisorSummaryResponse(
        UUID id,
        String name,
        String email,
        String profileImageB64
) {
    public static AdvisorSummaryResponse from(User user) {
        return new AdvisorSummaryResponse(
                user.getId(),
                user.getName(),
                user.getEmail(),
                user.getProfileImageB64()
        );
    }
}
