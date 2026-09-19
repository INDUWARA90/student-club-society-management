package com.club.backend.service;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Collection;
import java.util.List;
import java.util.UUID;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.club.backend.config.ApiException;
import com.club.backend.dto.NotificationResponse;
import com.club.backend.entity.Notification;
import com.club.backend.entity.NotificationChannel;
import com.club.backend.entity.User;
import com.club.backend.repository.NotificationRepository;
import com.club.backend.repository.UserRepository;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class NotificationService {

    private final NotificationRepository notificationRepository;
    private final UserRepository userRepository;
    private final MailService mailService;
    private final SimpMessagingTemplate messagingTemplate;

    /** Records an in-app notification, pushes it live over WebSocket, and (if the user allows it) fires an async email. */
    public void notify(User user, String message) {
        Notification notification = Notification.builder()
                .user(user)
                .channel(NotificationChannel.IN_APP)
                .message(InputLimits.clip(message, InputLimits.MAX_NOTIFICATION_CHARS))
                .build();
        notification = notificationRepository.save(notification);
        deliver(user, notification);
    }

    /**
     * Fan-out to many users off the request thread, so posting an announcement to a large club doesn't hold the
     * HTTP request open while thousands of rows are written and emails queued.
     */
    @Async
    @Transactional
    public void notifyUsers(Collection<UUID> userIds, String message) {
        List<User> users = userRepository.findAllById(userIds);
        List<Notification> notifications = users.stream()
                .map(user -> Notification.builder().user(user).channel(NotificationChannel.IN_APP)
                        .message(InputLimits.clip(message, InputLimits.MAX_NOTIFICATION_CHARS)).build())
                .toList();
        notificationRepository.saveAll(notifications);
        notifications.forEach(n -> deliver(n.getUser(), n));
    }

    private void deliver(User user, Notification notification) {
        // Digest subscribers get one summary email a day instead of one email per notification.
        if (user.isEmailNotificationsEnabled() && !user.isEmailDigestEnabled()) {
            mailService.sendNotificationEmail(user.getEmail(), notification.getMessage());
        }
        messagingTemplate.convertAndSend(
                "/topic/notifications/" + user.getId(), NotificationResponse.from(notification));
    }

    public List<NotificationResponse> listMyNotifications(UUID userId) {
        return notificationRepository.findByUserIdOrderByCreatedAtDesc(userId)
                .stream().map(NotificationResponse::from).toList();
    }

    @Transactional(readOnly = true)
    public Page<NotificationResponse> pageMyNotifications(UUID userId, Pageable pageable) {
        return notificationRepository.findByUserIdOrderByCreatedAtDesc(userId, pageable).map(NotificationResponse::from);
    }

    /** Emails each digest subscriber the notifications from the last 24 hours (skipping people with none). */
    @Transactional(readOnly = true)
    public int sendDailyDigests() {
        Instant since = Instant.now().minus(24, ChronoUnit.HOURS);
        int sent = 0;
        for (User user : userRepository.findByEmailNotificationsEnabledTrueAndEmailDigestEnabledTrue()) {
            List<String> messages = notificationRepository
                    .findByUserIdAndCreatedAtAfterOrderByCreatedAtAsc(user.getId(), since)
                    .stream().map(Notification::getMessage).toList();
            if (!messages.isEmpty()) {
                mailService.sendDigestEmail(user.getEmail(), user.getName(), messages);
                sent++;
            }
        }
        return sent;
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

    public void markAllRead(UUID userId) {
        List<Notification> unread = notificationRepository.findByUserIdOrderByCreatedAtDesc(userId)
                .stream().filter(n -> !n.isRead()).toList();
        unread.forEach(n -> n.setRead(true));
        notificationRepository.saveAll(unread);
    }
}
