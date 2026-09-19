package com.club.backend.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.List;
import java.util.UUID;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.messaging.simp.SimpMessagingTemplate;

import com.club.backend.entity.Notification;
import com.club.backend.entity.Role;
import com.club.backend.entity.User;
import com.club.backend.repository.NotificationRepository;
import com.club.backend.repository.UserRepository;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class NotificationServiceTest {

    @Mock
    private NotificationRepository notificationRepository;
    @Mock
    private UserRepository userRepository;
    @Mock
    private MailService mailService;
    @Mock
    private SimpMessagingTemplate messagingTemplate;

    @InjectMocks
    private NotificationService notificationService;

    private User wantsEmail;
    private User noEmail;

    @BeforeEach
    void setUp() {
        wantsEmail = User.builder().id(UUID.randomUUID()).name("A").email("a@example.com").role(Role.STUDENT).build();
        noEmail = User.builder().id(UUID.randomUUID()).name("B").email("b@example.com").role(Role.STUDENT)
                .emailNotificationsEnabled(false).build();
        when(notificationRepository.save(any(Notification.class))).thenAnswer(inv -> inv.getArgument(0));
    }

    @Test
    void notify_sendsEmailWhenEnabled() {
        notificationService.notify(wantsEmail, "hello");

        verify(mailService).sendNotificationEmail("a@example.com", "hello");
        verify(messagingTemplate).convertAndSend(eq("/topic/notifications/" + wantsEmail.getId()), any(Object.class));
    }

    @Test
    void notify_stillRecordsInAppNotificationButSkipsEmailWhenOptedOut() {
        notificationService.notify(noEmail, "hello");

        verify(notificationRepository).save(any(Notification.class));
        verify(mailService, never()).sendNotificationEmail(anyString(), anyString());
        verify(messagingTemplate).convertAndSend(eq("/topic/notifications/" + noEmail.getId()), any(Object.class));
    }

    @Test
    void notifyUsers_savesOnePerUserInOneBatch_andEmailsOnlyThoseWhoWantIt() {
        List<UUID> ids = List.of(wantsEmail.getId(), noEmail.getId());
        when(userRepository.findAllById(ids)).thenReturn(List.of(wantsEmail, noEmail));

        notificationService.notifyUsers(ids, "Big announcement");

        @SuppressWarnings("unchecked")
        ArgumentCaptor<List<Notification>> saved = ArgumentCaptor.forClass(List.class);
        verify(notificationRepository).saveAll(saved.capture());
        assertThat(saved.getValue()).hasSize(2).allMatch(n -> n.getMessage().equals("Big announcement"));
        verify(mailService, times(1)).sendNotificationEmail(anyString(), anyString());
        verify(mailService).sendNotificationEmail("a@example.com", "Big announcement");
        verify(messagingTemplate, times(2)).convertAndSend(anyString(), any(Object.class));
    }


    @Test
    void notify_digestSubscribersGetNoImmediateEmail() {
        User digest = User.builder().id(UUID.randomUUID()).name("D").email("d@example.com").role(Role.STUDENT)
                .emailDigestEnabled(true).build();

        notificationService.notify(digest, "hello");

        verify(notificationRepository).save(any(Notification.class));
        verify(mailService, never()).sendNotificationEmail(anyString(), anyString());
        verify(messagingTemplate).convertAndSend(eq("/topic/notifications/" + digest.getId()), any(Object.class));
    }

    @Test
    void sendDailyDigests_emailsOnlySubscribersWhoHadNotifications() {
        User busy = User.builder().id(UUID.randomUUID()).name("Busy").email("busy@example.com").role(Role.STUDENT)
                .emailDigestEnabled(true).build();
        User quiet = User.builder().id(UUID.randomUUID()).name("Quiet").email("quiet@example.com").role(Role.STUDENT)
                .emailDigestEnabled(true).build();
        when(userRepository.findByEmailNotificationsEnabledTrueAndEmailDigestEnabledTrue()).thenReturn(List.of(busy, quiet));
        when(notificationRepository.findByUserIdAndCreatedAtAfterOrderByCreatedAtAsc(eq(busy.getId()), any(java.time.Instant.class)))
                .thenReturn(List.of(
                        Notification.builder().user(busy).message("first").build(),
                        Notification.builder().user(busy).message("second").build()));
        when(notificationRepository.findByUserIdAndCreatedAtAfterOrderByCreatedAtAsc(eq(quiet.getId()), any(java.time.Instant.class)))
                .thenReturn(List.of());

        int sent = notificationService.sendDailyDigests();

        assertThat(sent).isEqualTo(1);
        verify(mailService).sendDigestEmail("busy@example.com", "Busy", List.of("first", "second"));
        verify(mailService, never()).sendDigestEmail(eq("quiet@example.com"), anyString(), any());
    }

    @Test
    void notify_clipsVeryLongMessagesBeforeStoringThem() {
        notificationService.notify(wantsEmail, "x".repeat(5_000));

        ArgumentCaptor<Notification> saved = ArgumentCaptor.forClass(Notification.class);
        verify(notificationRepository).save(saved.capture());
        assertThat(saved.getValue().getMessage()).hasSize(InputLimits.MAX_NOTIFICATION_CHARS).endsWith("…");
    }

    @Test
    void pageMyNotifications_asksTheDatabaseForOnePage() {
        var pageable = org.springframework.data.domain.PageRequest.of(0, 2);
        when(notificationRepository.findByUserIdOrderByCreatedAtDesc(wantsEmail.getId(), pageable))
                .thenReturn(new org.springframework.data.domain.PageImpl<>(
                        List.of(Notification.builder().user(wantsEmail).message("m").build()), pageable, 9));

        var page = notificationService.pageMyNotifications(wantsEmail.getId(), pageable);

        assertThat(page.getTotalElements()).isEqualTo(9);
    }
}
