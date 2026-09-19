package com.club.backend.dto;

import java.util.UUID;

import com.club.backend.entity.User;

public record AlumniResponse(UUID id, String name, Integer graduationYear) {

    public static AlumniResponse from(User user) {
        return new AlumniResponse(user.getId(), user.getName(), user.getGraduationYear());
    }
}
