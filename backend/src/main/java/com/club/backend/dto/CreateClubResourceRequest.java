package com.club.backend.dto;

public record CreateClubResourceRequest(String title, String fileName, String contentType, String fileB64) {
}
