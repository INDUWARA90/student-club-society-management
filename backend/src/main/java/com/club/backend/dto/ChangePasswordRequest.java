package com.club.backend.dto;

public record ChangePasswordRequest(String currentPassword, String newPassword) {
}
