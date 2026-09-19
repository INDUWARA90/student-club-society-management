package com.club.backend.dto;

import java.time.Instant;
import java.util.UUID;

import com.club.backend.entity.ClubResource;

public record ClubResourceResponse(
        UUID id, UUID clubId, String title, String fileName, UUID uploadedById, String uploadedByName,
        Instant createdAt) {

    public static ClubResourceResponse from(ClubResource resource) {
        return new ClubResourceResponse(
                resource.getId(), resource.getClub().getId(), resource.getTitle(), resource.getFileName(),
                resource.getUploadedBy().getId(), resource.getUploadedBy().getName(), resource.getCreatedAt());
    }
}
