package com.club.backend.dto;

import java.util.UUID;

import com.club.backend.entity.User;

public record AlumniResponse(UUID id, String name, String email, String profileImageB64, Integer graduationYear) {

    public static AlumniResponse from(User user) {
        return new AlumniResponse(user.getId(), user.getName(), user.getEmail(), user.getProfileImageB64(),
                user.getGraduationYear());
    }
}
