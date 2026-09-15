package com.club.backend.controller;

import java.util.List;
import java.util.UUID;

import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.club.backend.dto.NotificationResponse;
import com.club.backend.security.UserPrincipal;
import com.club.backend.service.NotificationService;

import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/api/notifications")
@RequiredArgsConstructor
public class NotificationController {

    private final NotificationService notificationService;

    @GetMapping("/me")
    public ResponseEntity<List<NotificationResponse>> myNotifications(@AuthenticationPrincipal UserPrincipal principal) {
        return ResponseEntity.ok(notificationService.listMyNotifications(principal.getId()));
    }

    @PostMapping("/{notificationId}/read")
    public ResponseEntity<Void> markRead(@PathVariable UUID notificationId, @AuthenticationPrincipal UserPrincipal principal) {
        notificationService.markRead(notificationId, principal.getId());
        return ResponseEntity.ok().build();
    }
}
