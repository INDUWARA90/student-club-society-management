package com.club.backend.controller;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.club.backend.dto.CreateEventRequest;
import com.club.backend.dto.EventResponse;
import com.club.backend.dto.ReasonRequest;
import com.club.backend.security.UserPrincipal;
import com.club.backend.service.EventService;

import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
public class EventController {

    private final EventService eventService;

    @PostMapping("/clubs/{clubId}/events")
    public ResponseEntity<EventResponse> createEvent(@PathVariable UUID clubId,
            @RequestBody CreateEventRequest request, @AuthenticationPrincipal UserPrincipal principal) {
        return ResponseEntity.ok(eventService.createEvent(clubId, request, principal));
    }

    /** Filters: clubId, q (title/description), category (club category), from/to (ISO instants); page/size optional. */
    @GetMapping("/events")
    public ResponseEntity<List<EventResponse>> listEvents(
            @RequestParam(required = false) UUID clubId,
            @RequestParam(required = false) String q,
            @RequestParam(required = false) String category,
            @RequestParam(required = false) Instant from,
            @RequestParam(required = false) Instant to,
            @RequestParam(required = false) Integer page,
            @RequestParam(required = false) Integer size) {
        Pageable pageable = PageSupport.pageable(page, size, Sort.by("eventDate"));
        if (pageable != null) {
            return PageSupport.respond(eventService.pagePublishedEvents(clubId, q, category, from, to, pageable));
        }
        return PageSupport.respond(eventService.listPublishedEvents(clubId, q, category, from, to), null, null);
    }

    @GetMapping("/events/{eventId}")
    public ResponseEntity<EventResponse> getEvent(@PathVariable UUID eventId,
            @AuthenticationPrincipal UserPrincipal principal) {
        return ResponseEntity.ok(eventService.getEvent(eventId, principal));
    }

    @PostMapping("/events/{eventId}/cancel")
    public ResponseEntity<EventResponse> cancelEvent(@PathVariable UUID eventId,
            @RequestBody(required = false) ReasonRequest body, @AuthenticationPrincipal UserPrincipal principal) {
        return ResponseEntity.ok(eventService.cancelEvent(eventId, body != null ? body.reason() : null, principal));
    }

    @PutMapping("/events/{eventId}")
    public ResponseEntity<EventResponse> updateEvent(@PathVariable UUID eventId, @RequestBody CreateEventRequest request,
            @AuthenticationPrincipal UserPrincipal principal) {
        return ResponseEntity.ok(eventService.updateEvent(eventId, request, principal));
    }

    @GetMapping("/events/{eventId}/ics")
    public ResponseEntity<String> downloadIcs(@PathVariable UUID eventId) {
        String ics = eventService.generateIcs(eventId);
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType("text/calendar"))
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"event.ics\"")
                .body(ics);
    }

    @GetMapping("/events/{eventId}/qr-code")
    public ResponseEntity<byte[]> qrCode(@PathVariable UUID eventId, @AuthenticationPrincipal UserPrincipal principal) {
        return ResponseEntity.ok()
                .contentType(MediaType.IMAGE_PNG)
                .cacheControl(CacheControl.noStore())
                .body(eventService.generateQrCode(eventId, principal));
    }

    @GetMapping("/events/pending")
    @PreAuthorize("hasRole('FACULTY_ADVISOR')")
    public ResponseEntity<List<EventResponse>> listPendingApprovals() {
        return ResponseEntity.ok(eventService.listPendingApprovals());
    }

    @PostMapping("/events/{eventId}/approve")
    @PreAuthorize("hasRole('FACULTY_ADVISOR')")
    public ResponseEntity<EventResponse> approveEvent(@PathVariable UUID eventId, @AuthenticationPrincipal UserPrincipal principal) {
        return ResponseEntity.ok(eventService.reviewEvent(eventId, true, principal));
    }

    @PostMapping("/events/{eventId}/reject")
    @PreAuthorize("hasRole('FACULTY_ADVISOR')")
    public ResponseEntity<EventResponse> rejectEvent(@PathVariable UUID eventId,
            @RequestBody(required = false) ReasonRequest body, @AuthenticationPrincipal UserPrincipal principal) {
        return ResponseEntity.ok(eventService.reviewEvent(eventId, false, body != null ? body.reason() : null, principal));
    }
}
