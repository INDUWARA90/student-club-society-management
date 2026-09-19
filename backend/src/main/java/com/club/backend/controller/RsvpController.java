package com.club.backend.controller;

import java.util.List;
import java.util.UUID;

import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.club.backend.dto.RsvpResponse;
import com.club.backend.security.UserPrincipal;
import com.club.backend.service.RsvpService;

import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
public class RsvpController {

    private final RsvpService rsvpService;

    @PostMapping("/events/{eventId}/rsvp")
    public ResponseEntity<RsvpResponse> rsvp(@PathVariable UUID eventId, @AuthenticationPrincipal UserPrincipal principal) {
        return ResponseEntity.ok(rsvpService.rsvp(eventId, principal));
    }

    @DeleteMapping("/events/{eventId}/rsvp")
    public ResponseEntity<Void> cancelRsvp(@PathVariable UUID eventId, @AuthenticationPrincipal UserPrincipal principal) {
        rsvpService.cancelRsvp(eventId, principal);
        return ResponseEntity.ok().build();
    }

    @GetMapping("/events/{eventId}/rsvps")
    public ResponseEntity<List<RsvpResponse>> listRsvps(@PathVariable UUID eventId) {
        return ResponseEntity.ok(rsvpService.listRsvps(eventId));
    }

    @GetMapping("/events/{eventId}/waitlist")
    public ResponseEntity<List<RsvpResponse>> listWaitlist(@PathVariable UUID eventId) {
        return ResponseEntity.ok(rsvpService.listWaitlist(eventId));
    }

    @GetMapping("/rsvps/me")
    public ResponseEntity<List<RsvpResponse>> myRsvps(@AuthenticationPrincipal UserPrincipal principal) {
        return ResponseEntity.ok(rsvpService.listMyRsvps(principal));
    }
}
