package com.club.backend.dto;

public record AuthResponse(String accessToken, UserResponse user) {

    /** Registration outcome that reveals nothing about the account: no token, the user must verify by email first. */
    public static AuthResponse pending() {
        return new AuthResponse(null, null);
    }
}
