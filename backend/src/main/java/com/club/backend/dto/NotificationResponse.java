package com.club.backend.dto;

import java.time.Instant;
import java.util.UUID;

import com.club.backend.entity.Notification;

public record NotificationResponse(UUID id, String message, boolean read, Instant createdAt) {

    public static NotificationResponse from(Notification notification) {
        return new NotificationResponse(
                notification.getId(),
                notification.getMessage(),
                notification.isRead(),
                notification.getCreatedAt());
    }
}
