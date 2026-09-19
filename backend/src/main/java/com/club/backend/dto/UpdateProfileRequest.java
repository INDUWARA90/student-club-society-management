package com.club.backend.dto;

public record UpdateProfileRequest(String name, String email, Integer graduationYear,
        Boolean emailNotificationsEnabled, Boolean emailDigestEnabled) {

    public UpdateProfileRequest(String name, String email, Integer graduationYear) {
        this(name, email, graduationYear, null, null);
    }

    public UpdateProfileRequest(String name, String email, Integer graduationYear, Boolean emailNotificationsEnabled) {
        this(name, email, graduationYear, emailNotificationsEnabled, null);
    }
}
