package com.club.backend.dto;

import java.time.Instant;
import java.util.UUID;

import com.club.backend.entity.Role;
import com.club.backend.entity.User;

public record UserResponse(
        UUID id, String name, String email, Role role, String profileImageB64, boolean emailVerified,
        Instant createdAt, Integer graduationYear,
        boolean emailNotificationsEnabled, boolean emailDigestEnabled) {

    public static UserResponse from(User user) {
        return new UserResponse(
                user.getId(), user.getName(), user.getEmail(), user.getRole(),
                user.getProfileImageB64(), user.isEmailVerified(), user.getCreatedAt(), user.getGraduationYear(),
                user.isEmailNotificationsEnabled(), user.isEmailDigestEnabled());
    }
}
