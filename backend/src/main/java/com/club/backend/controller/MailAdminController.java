package com.club.backend.controller;

import java.util.Map;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.club.backend.service.MailService;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

@RestController
@RequestMapping("/api/admin/mail")
@RequiredArgsConstructor
@Slf4j
public class MailAdminController {

    private final MailService mailService;

    @PostMapping("/test")
    @PreAuthorize("hasRole('SUPER_ADMIN')")
    public ResponseEntity<?> testMailDelivery(@RequestBody Map<String, String> payload) {
        String recipient = payload.get("email");
        if (recipient == null || recipient.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of(
                    "success", false,
                    "error", "Recipient email is required"
            ));
        }

        try {
            mailService.sendTestEmail(recipient.trim());
            return ResponseEntity.ok(Map.of(
                    "success", true,
                    "message", "Test email successfully sent to " + recipient.trim()
            ));
        } catch (Exception e) {
            log.error("Manual test email failed for {}: {}", recipient, e.getMessage(), e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(Map.of(
                    "success", false,
                    "error", e.getMessage() != null ? e.getMessage() : "SMTP dispatch failed",
                    "sender", mailService.getEffectiveFromAddress()
            ));
        }
    }
}
