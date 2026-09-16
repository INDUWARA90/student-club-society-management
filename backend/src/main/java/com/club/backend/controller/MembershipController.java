package com.club.backend.controller;

import java.util.List;
import java.util.UUID;

import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.club.backend.dto.MembershipResponse;
import com.club.backend.dto.UpdatePositionRequest;
import com.club.backend.security.UserPrincipal;
import com.club.backend.service.MembershipService;

import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
public class MembershipController {

    private final MembershipService membershipService;

    @PostMapping("/clubs/{clubId}/join")
    public ResponseEntity<MembershipResponse> joinClub(@PathVariable UUID clubId,
            @AuthenticationPrincipal UserPrincipal principal) {
        return ResponseEntity.ok(membershipService.joinClub(clubId, principal));
    }

    @GetMapping("/clubs/{clubId}/members")
    public ResponseEntity<List<MembershipResponse>> listMembers(@PathVariable UUID clubId) {
        return ResponseEntity.ok(membershipService.listMembers(clubId));
    }

    @GetMapping("/clubs/{clubId}/members/csv")
    public ResponseEntity<String> listMembersCsv(@PathVariable UUID clubId) {
        return ResponseEntity.ok()
                .contentType(org.springframework.http.MediaType.parseMediaType("text/csv"))
                .header(org.springframework.http.HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"members.csv\"")
                .body(membershipService.listMembersCsv(clubId));
    }

    @GetMapping("/clubs/{clubId}/members/pending")
    public ResponseEntity<List<MembershipResponse>> listPendingRequests(@PathVariable UUID clubId) {
        return ResponseEntity.ok(membershipService.listPendingRequests(clubId));
    }

    @GetMapping("/memberships/me")
    public ResponseEntity<List<MembershipResponse>> myMemberships(@AuthenticationPrincipal UserPrincipal principal) {
        return ResponseEntity.ok(membershipService.listMyMemberships(principal));
    }

    @PostMapping("/memberships/{membershipId}/approve")
    public ResponseEntity<MembershipResponse> approve(@PathVariable UUID membershipId) {
        return ResponseEntity.ok(membershipService.reviewJoinRequest(membershipId, true));
    }

    @PostMapping("/memberships/{membershipId}/reject")
    public ResponseEntity<MembershipResponse> reject(@PathVariable UUID membershipId) {
        return ResponseEntity.ok(membershipService.reviewJoinRequest(membershipId, false));
    }

    @PutMapping("/memberships/{membershipId}/position")
    public ResponseEntity<MembershipResponse> updatePosition(@PathVariable UUID membershipId,
            @RequestBody UpdatePositionRequest request) {
        return ResponseEntity.ok(membershipService.assignPosition(membershipId, request.position()));
    }
}
