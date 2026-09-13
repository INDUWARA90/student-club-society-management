package com.club.backend.dto;

public record ResetPasswordRequest(String token, String newPassword) {
}
