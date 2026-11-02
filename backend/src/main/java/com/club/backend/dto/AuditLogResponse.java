package com.club.backend.dto;

import java.time.Instant;
import java.util.UUID;

import com.club.backend.entity.AuditLog;
import com.club.backend.entity.User;

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
        String actorName = "Unknown";
        String actorEmail = null;
        String actorRole = null;
        try {
            User actor = log.getActor();
            if (actor != null) {
                actorName = actor.getName() != null ? actor.getName() : "Unknown";
                actorEmail = actor.getEmail();
                actorRole = actor.getRole() != null ? actor.getRole().name() : null;
            }
        } catch (Exception ignored) {
            // Safe fallback if actor was deleted or cannot be resolved
        }

        return new AuditLogResponse(
                log.getId(),
                actorName,
                actorEmail,
                actorRole,
                log.getAction(),
                log.getTargetType(),
                log.getTargetId(),
                log.getDetails(),
                log.getCreatedAt());
    }
}
