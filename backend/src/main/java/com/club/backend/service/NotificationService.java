package com.club.backend.service;

import java.util.List;
import java.util.UUID;

import org.springframework.stereotype.Service;

import com.club.backend.config.ApiException;
import com.club.backend.dto.NotificationResponse;
import com.club.backend.entity.Notification;
import com.club.backend.entity.NotificationChannel;
import com.club.backend.entity.User;
import com.club.backend.repository.NotificationRepository;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class NotificationService {

    private final NotificationRepository notificationRepository;
    private final MailService mailService;

    /** Records an in-app notification and fires an async email for the same message. */
    public void notify(User user, String message) {
        Notification notification = Notification.builder()
                .user(user)
                .channel(NotificationChannel.IN_APP)
                .message(message)
                .build();
        notificationRepository.save(notification);
        mailService.sendNotificationEmail(user.getEmail(), message);
    }

    public List<NotificationResponse> listMyNotifications(UUID userId) {
        return notificationRepository.findByUserIdOrderByCreatedAtDesc(userId)
                .stream().map(NotificationResponse::from).toList();
    }

    public void markRead(UUID notificationId, UUID requestingUserId) {
        Notification notification = notificationRepository.findById(notificationId)
                .orElseThrow(() -> ApiException.notFound("Notification not found"));

        if (!notification.getUser().getId().equals(requestingUserId)) {
            throw ApiException.forbidden("You can only mark your own notifications as read");
        }

        notification.setRead(true);
        notificationRepository.save(notification);
    }
}
