package com.club.backend.dto;

import java.time.Instant;
import java.util.UUID;

import com.club.backend.entity.AuditLog;

public record AuditLogResponse(
        UUID id, String actorName, String action, String targetType, UUID targetId, String details, Instant createdAt) {

    public static AuditLogResponse from(AuditLog log) {
        return new AuditLogResponse(
                log.getId(),
                log.getActor().getName(),
                log.getAction(),
                log.getTargetType(),
                log.getTargetId(),
                log.getDetails(),
                log.getCreatedAt());
    }
}
