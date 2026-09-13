package com.club.backend.dto;

public record AuthResponse(String accessToken, UserResponse user) {
}
