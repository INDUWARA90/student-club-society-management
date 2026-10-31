package com.club.backend.dto;

import java.time.Instant;
import java.util.UUID;

import com.club.backend.entity.AuditLog;

public record AuditLogResponse(
        UUID id,
        String actorName,
        String actorEmail,
        String actorRole,
        String action,
        String targetType,
        UUID targetId,
        String details,
        Instant createdAt) {

    public AuditLogResponse(
            UUID id, String actorName, String action, String targetType, UUID targetId, String details, Instant createdAt) {
        this(id, actorName, null, null, action, targetType, targetId, details, createdAt);
    }

    public static AuditLogResponse from(AuditLog log) {
        return new AuditLogResponse(
                log.getId(),
                log.getActor() != null ? log.getActor().getName() : "Unknown",
                log.getActor() != null ? log.getActor().getEmail() : null,
                log.getActor() != null && log.getActor().getRole() != null ? log.getActor().getRole().name() : null,
                log.getAction(),
                log.getTargetType(),
                log.getTargetId(),
                log.getDetails(),
                log.getCreatedAt());
    }
}
