package com.club.backend.controller;

import java.util.List;
import java.util.UUID;

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

import com.club.backend.dto.ClubResponse;
import com.club.backend.dto.CreateClubRequest;
import com.club.backend.security.UserPrincipal;
import com.club.backend.service.ClubService;

import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/api/clubs")
@RequiredArgsConstructor
public class ClubController {

    private final ClubService clubService;

    @PostMapping
    public ResponseEntity<ClubResponse> createClub(@RequestBody CreateClubRequest request,
            @AuthenticationPrincipal UserPrincipal principal) {
        return ResponseEntity.ok(clubService.createClub(request, principal));
    }

    @GetMapping
    public ResponseEntity<List<ClubResponse>> listClubs(@RequestParam(required = false) String category) {
        return ResponseEntity.ok(clubService.listApprovedClubs(category));
    }

    @GetMapping("/{clubId}")
    public ResponseEntity<ClubResponse> getClub(@PathVariable UUID clubId) {
        return ResponseEntity.ok(clubService.getClub(clubId));
    }

    @PutMapping("/{clubId}")
    public ResponseEntity<ClubResponse> updateClub(@PathVariable UUID clubId, @RequestBody CreateClubRequest request,
            @AuthenticationPrincipal UserPrincipal principal) {
        return ResponseEntity.ok(clubService.updateClub(clubId, request, principal));
    }

    @GetMapping("/pending")
    @PreAuthorize("hasRole('SUPER_ADMIN')")
    public ResponseEntity<List<ClubResponse>> listPendingClubs() {
        return ResponseEntity.ok(clubService.listPendingClubs());
    }

    @GetMapping("/all")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN', 'FACULTY_ADVISOR')")
    public ResponseEntity<List<ClubResponse>> listAllClubs() {
        return ResponseEntity.ok(clubService.listAllClubs());
    }

    @PostMapping("/{clubId}/approve")
    @PreAuthorize("hasRole('SUPER_ADMIN')")
    public ResponseEntity<ClubResponse> approveClub(@PathVariable UUID clubId, @AuthenticationPrincipal UserPrincipal principal) {
        return ResponseEntity.ok(clubService.approveClub(clubId, true, principal));
    }

    @PostMapping("/{clubId}/reject")
    @PreAuthorize("hasRole('SUPER_ADMIN')")
    public ResponseEntity<ClubResponse> rejectClub(@PathVariable UUID clubId, @AuthenticationPrincipal UserPrincipal principal) {
        return ResponseEntity.ok(clubService.approveClub(clubId, false, principal));
    }
}
