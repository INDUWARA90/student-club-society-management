package com.club.backend.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

@Service
@RequiredArgsConstructor
@Slf4j
public class MailService {

    private final JavaMailSender mailSender;

    @Value("${app.frontend-url}")
    private String frontendUrl;

    @Async
    public void sendNotificationEmail(String toEmail, String message) {
        SimpleMailMessage mail = new SimpleMailMessage();
        mail.setTo(toEmail);
        mail.setSubject("Club & Society Management notification");
        mail.setText(message);
        try {
            mailSender.send(mail);
        } catch (Exception e) {
            log.warn("Failed to send notification email to {}: {}", toEmail, e.getMessage());
        }
    }

    @Async
    public void sendVerificationEmail(String toEmail, String token) {
        String verifyLink = frontendUrl + "/verify-email?token=" + token;
        SimpleMailMessage message = new SimpleMailMessage();
        message.setTo(toEmail);
        message.setSubject("Verify your email");
        message.setText("Welcome! Click the link below to verify your email address:\n\n" + verifyLink);
        try {
            mailSender.send(message);
        } catch (Exception e) {
            log.warn("Failed to send verification email to {}: {}", toEmail, e.getMessage());
        }
    }

    /** Sent instead of a verification link when someone registers with an address that already has an account. */
    @Async
    public void sendAccountExistsEmail(String toEmail) {
        SimpleMailMessage message = new SimpleMailMessage();
        message.setTo(toEmail);
        message.setSubject("You already have an account");
        message.setText("Someone (hopefully you) tried to create a Club & Society Management account with this email "
                + "address, but one already exists.\n\nYou can sign in at " + frontendUrl + "/login, or reset your "
                + "password at " + frontendUrl + "/forgot-password if you've forgotten it.\n\n"
                + "If this wasn't you, you can ignore this email.");
        try {
            mailSender.send(message);
        } catch (Exception e) {
            log.warn("Failed to send account-exists email to {}: {}", toEmail, e.getMessage());
        }
    }

    @Async
    public void sendDigestEmail(String toEmail, String name, java.util.List<String> messages) {
        SimpleMailMessage mail = new SimpleMailMessage();
        mail.setTo(toEmail);
        mail.setSubject("Your daily Club & Society Management digest");
        StringBuilder body = new StringBuilder("Hi " + name + ",\n\nHere's what happened in the last 24 hours:\n\n");
        messages.forEach(m -> body.append("• ").append(m).append("\n"));
        body.append("\nOpen the app: ").append(frontendUrl).append("/notifications");
        mail.setText(body.toString());
        try {
            mailSender.send(mail);
        } catch (Exception e) {
            log.warn("Failed to send digest email to {}: {}", toEmail, e.getMessage());
        }
    }

    @Async
    public void sendPasswordResetEmail(String toEmail, String token) {
        String resetLink = frontendUrl + "/reset-password?token=" + token;
        SimpleMailMessage message = new SimpleMailMessage();
        message.setTo(toEmail);
        message.setSubject("Reset your password");
        message.setText("Click the link below to reset your password:\n\n" + resetLink
                + "\n\nIf you didn't request this, you can ignore this email.");
        try {
            mailSender.send(message);
        } catch (Exception e) {
            log.warn("Failed to send password reset email to {}: {}", toEmail, e.getMessage());
        }
    }
}
