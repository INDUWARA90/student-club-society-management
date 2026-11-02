package com.club.backend.service;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThatNoException;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import static org.mockito.ArgumentMatchers.any;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mail.MailSendException;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.test.util.ReflectionTestUtils;

import jakarta.mail.Session;
import jakarta.mail.internet.MimeMessage;

@ExtendWith(MockitoExtension.class)
class MailServiceTest {

    @Mock
    private JavaMailSender mailSender;

    @InjectMocks
    private MailService mailService;

    @BeforeEach
    void setUp() {
        ReflectionTestUtils.setField(mailService, "frontendUrl", "http://localhost:5173");
        ReflectionTestUtils.setField(mailService, "mailUsername", "test@campusclubs.edu");
        ReflectionTestUtils.setField(mailService, "configuredFrom", "noreply@campusclubs.edu");
    }

    private MimeMessage createDummyMimeMessage() {
        return new MimeMessage((Session) null);
    }

    @Test
    void sendNotificationEmail_sendsMimeMessage() {
        when(mailSender.createMimeMessage()).thenReturn(createDummyMimeMessage());

        assertThatNoException().isThrownBy(() ->
                mailService.sendNotificationEmail("user@example.com", "Your club was approved!")
        );

        verify(mailSender).send(any(MimeMessage.class));
    }

    @Test
    void sendVerificationEmail_sendsMimeMessage() {
        when(mailSender.createMimeMessage()).thenReturn(createDummyMimeMessage());

        assertThatNoException().isThrownBy(() ->
                mailService.sendVerificationEmail("newuser@example.com", "token-123")
        );

        verify(mailSender).send(any(MimeMessage.class));
    }

    @Test
    void sendPasswordResetEmail_sendsMimeMessage() {
        when(mailSender.createMimeMessage()).thenReturn(createDummyMimeMessage());

        assertThatNoException().isThrownBy(() ->
                mailService.sendPasswordResetEmail("user@example.com", "reset-token-456")
        );

        verify(mailSender).send(any(MimeMessage.class));
    }

    @Test
    void sendAccountExistsEmail_sendsMimeMessage() {
        when(mailSender.createMimeMessage()).thenReturn(createDummyMimeMessage());

        assertThatNoException().isThrownBy(() ->
                mailService.sendAccountExistsEmail("existing@example.com")
        );

        verify(mailSender).send(any(MimeMessage.class));
    }

    @Test
    void sendDigestEmail_sendsMimeMessage() {
        when(mailSender.createMimeMessage()).thenReturn(createDummyMimeMessage());

        assertThatNoException().isThrownBy(() ->
                mailService.sendDigestEmail("user@example.com", "Alex", List.of("Event 1 announced", "New announcement posted"))
        );

        verify(mailSender).send(any(MimeMessage.class));
    }

    @Test
    void sendAdvisorContactEmail_sendsMimeMessage() {
        when(mailSender.createMimeMessage()).thenReturn(createDummyMimeMessage());

        assertThatNoException().isThrownBy(() ->
                mailService.sendAdvisorContactEmail(
                        "advisor@example.com",
                        "Dr. Advisor",
                        "Alex Student",
                        "student@example.com",
                        "Need assistance",
                        "Can you help with club registration?",
                        "Robotics Club"
                )
        );

        verify(mailSender).send(any(MimeMessage.class));
    }

    @Test
    void sendEmail_handlesExceptionGracefully() {
        when(mailSender.createMimeMessage()).thenReturn(createDummyMimeMessage());
        doThrow(new MailSendException("SMTP server offline")).when(mailSender).send(any(MimeMessage.class));

        assertThatNoException().isThrownBy(() ->
                mailService.sendNotificationEmail("user@example.com", "Fail gracefully test")
        );
    }

    @Test
    void sendEmail_skipsWhenNotConfigured() {
        ReflectionTestUtils.setField(mailService, "mailUsername", "");
        ReflectionTestUtils.setField(mailService, "configuredFrom", "");

        mailService.sendNotificationEmail("user@example.com", "Hello");

        verify(mailSender, never()).send(any(MimeMessage.class));
    }

    @Test
    void sendTestEmail_sendsSuccessfully() {
        when(mailSender.createMimeMessage()).thenReturn(createDummyMimeMessage());

        assertThatNoException().isThrownBy(() ->
                mailService.sendTestEmail("admin@example.com")
        );

        verify(mailSender).send(any(MimeMessage.class));
    }

    @Test
    void sendTestEmail_throwsOnFailure() {
        when(mailSender.createMimeMessage()).thenReturn(createDummyMimeMessage());
        doThrow(new MailSendException("Connection refused")).when(mailSender).send(any(MimeMessage.class));

        assertThatThrownBy(() -> mailService.sendTestEmail("admin@example.com"))
                .isInstanceOf(RuntimeException.class)
                .hasMessageContaining("SMTP delivery failed");
    }
}
