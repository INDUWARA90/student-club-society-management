package com.club.backend.dto;

import java.time.Instant;
import java.util.UUID;

import com.club.backend.entity.Role;
import com.club.backend.entity.User;

/** A user as the Super Admin's user-management screen sees them (no profile image, to keep the list light). */
public record UserAdminResponse(
        UUID id, String name, String email, Role role, boolean active, boolean emailVerified, Instant createdAt,
        Integer graduationYear) {

    public static UserAdminResponse from(User user) {
        return new UserAdminResponse(
                user.getId(), user.getName(), user.getEmail(), user.getRole(), user.isActive(),
                user.isEmailVerified(), user.getCreatedAt(), user.getGraduationYear());
    }
}
