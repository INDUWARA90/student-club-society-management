package com.club.backend.controller;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.club.backend.dto.EventResponse;
import com.club.backend.dto.NextAvailableSlotResponse;
import com.club.backend.dto.VenueRequest;
import com.club.backend.dto.VenueResponse;
import com.club.backend.dto.VenueUtilizationResponse;
import com.club.backend.service.VenueService;

import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/api/venues")
@RequiredArgsConstructor
public class VenueController {

    private final VenueService venueService;

    @GetMapping
    public ResponseEntity<List<VenueResponse>> listVenues() {
        return ResponseEntity.ok(venueService.listActiveVenues());
    }

    @PostMapping
    @PreAuthorize("hasRole('SUPER_ADMIN')")
    public ResponseEntity<VenueResponse> createVenue(@RequestBody VenueRequest request) {
        return ResponseEntity.ok(venueService.createVenue(request));
    }

    @PutMapping("/{venueId}")
    @PreAuthorize("hasRole('SUPER_ADMIN')")
    public ResponseEntity<VenueResponse> updateVenue(@PathVariable UUID venueId, @RequestBody VenueRequest request) {
        return ResponseEntity.ok(venueService.updateVenue(venueId, request));
    }

    @DeleteMapping("/{venueId}")
    @PreAuthorize("hasRole('SUPER_ADMIN')")
    public ResponseEntity<VenueResponse> deactivateVenue(@PathVariable UUID venueId) {
        return ResponseEntity.ok(venueService.deactivateVenue(venueId));
    }

    @GetMapping("/{venueId}/bookings")
    public ResponseEntity<List<EventResponse>> getBookings(
            @PathVariable UUID venueId, @RequestParam Instant from, @RequestParam Instant to) {
        return ResponseEntity.ok(venueService.getBookings(venueId, from, to));
    }

    @GetMapping("/utilization")
    public ResponseEntity<List<VenueUtilizationResponse>> getUtilization() {
        return ResponseEntity.ok(venueService.getUtilizationSummary());
    }

    @GetMapping("/{venueId}/next-available-slot")
    public ResponseEntity<NextAvailableSlotResponse> getNextAvailableSlot(
            @PathVariable UUID venueId, @RequestParam Instant desiredStart, @RequestParam long durationMinutes) {
        return ResponseEntity.ok(venueService.findNextAvailableSlot(venueId, desiredStart, durationMinutes * 60));
    }
}
