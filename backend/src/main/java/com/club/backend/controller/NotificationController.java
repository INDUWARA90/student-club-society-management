package com.club.backend.controller;

import java.util.List;
import java.util.UUID;

import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
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
    public ResponseEntity<List<NotificationResponse>> myNotifications(@AuthenticationPrincipal UserPrincipal principal,
            @RequestParam(required = false) Integer page, @RequestParam(required = false) Integer size) {
        Pageable pageable = PageSupport.pageable(page, size, Sort.unsorted());
        if (pageable != null) {
            return PageSupport.respond(notificationService.pageMyNotifications(principal.getId(), pageable));
        }
        return PageSupport.respond(notificationService.listMyNotifications(principal.getId()), null, null);
    }

    @PostMapping("/{notificationId}/read")
    public ResponseEntity<Void> markRead(@PathVariable UUID notificationId, @AuthenticationPrincipal UserPrincipal principal) {
        notificationService.markRead(notificationId, principal.getId());
        return ResponseEntity.ok().build();
    }

    @PostMapping("/read-all")
    public ResponseEntity<Void> markAllRead(@AuthenticationPrincipal UserPrincipal principal) {
        notificationService.markAllRead(principal.getId());
        return ResponseEntity.ok().build();
    }
}
