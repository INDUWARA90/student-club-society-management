package com.club.backend.controller;

import java.util.List;
import java.util.UUID;

import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.club.backend.dto.ImportMembersRequest;
import com.club.backend.dto.ImportMembersResponse;
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

    @DeleteMapping("/clubs/{clubId}/join")
    public ResponseEntity<Void> leaveClub(@PathVariable UUID clubId, @AuthenticationPrincipal UserPrincipal principal) {
        membershipService.leaveClub(clubId, principal);
        return ResponseEntity.ok().build();
    }

    @GetMapping("/clubs/{clubId}/members")
    public ResponseEntity<List<MembershipResponse>> listMembers(@PathVariable UUID clubId,
            @RequestParam(required = false) Integer page, @RequestParam(required = false) Integer size) {
        Pageable pageable = PageSupport.pageable(page, size, Sort.by("joinedAt"));
        if (pageable != null) {
            return PageSupport.respond(membershipService.pageMembers(clubId, pageable));
        }
        return PageSupport.respond(membershipService.listMembers(clubId), null, null);
    }

    /** Succession: the Vice President takes over a club whose President has graduated. */
    @PostMapping("/clubs/{clubId}/claim-presidency")
    public ResponseEntity<MembershipResponse> claimPresidency(@PathVariable UUID clubId,
            @AuthenticationPrincipal UserPrincipal principal) {
        return ResponseEntity.ok(membershipService.claimPresidency(clubId, principal));
    }

    /** President removes a member (or turns away an applicant); the President can't be removed. */
    @DeleteMapping("/memberships/{membershipId}")
    public ResponseEntity<Void> removeMember(@PathVariable UUID membershipId,
            @AuthenticationPrincipal UserPrincipal principal) {
        membershipService.removeMember(membershipId, principal);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/clubs/{clubId}/members/csv")
    public ResponseEntity<String> listMembersCsv(@PathVariable UUID clubId,
            @AuthenticationPrincipal UserPrincipal principal) {
        return ResponseEntity.ok()
                .contentType(org.springframework.http.MediaType.parseMediaType("text/csv"))
                .header(org.springframework.http.HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"members.csv\"")
                .body(membershipService.listMembersCsv(clubId, principal));
    }

    @PostMapping("/clubs/{clubId}/members/import")
    public ResponseEntity<ImportMembersResponse> importMembers(@PathVariable UUID clubId,
            @RequestBody ImportMembersRequest request, @AuthenticationPrincipal UserPrincipal principal) {
        return ResponseEntity.ok(membershipService.importMembers(clubId, request, principal));
    }

    @GetMapping("/clubs/{clubId}/members/pending")
    public ResponseEntity<List<MembershipResponse>> listPendingRequests(@PathVariable UUID clubId,
            @AuthenticationPrincipal UserPrincipal principal) {
        return ResponseEntity.ok(membershipService.listPendingRequests(clubId, principal));
    }

    @GetMapping("/memberships/me")
    public ResponseEntity<List<MembershipResponse>> myMemberships(@AuthenticationPrincipal UserPrincipal principal) {
        return ResponseEntity.ok(membershipService.listMyMemberships(principal));
    }

    @PostMapping("/memberships/{membershipId}/approve")
    public ResponseEntity<MembershipResponse> approve(@PathVariable UUID membershipId,
            @AuthenticationPrincipal UserPrincipal principal) {
        return ResponseEntity.ok(membershipService.reviewJoinRequest(membershipId, true, principal));
    }

    @PostMapping("/memberships/{membershipId}/reject")
    public ResponseEntity<MembershipResponse> reject(@PathVariable UUID membershipId,
            @AuthenticationPrincipal UserPrincipal principal) {
        return ResponseEntity.ok(membershipService.reviewJoinRequest(membershipId, false, principal));
    }

    @PutMapping("/memberships/{membershipId}/position")
    public ResponseEntity<MembershipResponse> updatePosition(@PathVariable UUID membershipId,
            @RequestBody UpdatePositionRequest request, @AuthenticationPrincipal UserPrincipal principal) {
        return ResponseEntity.ok(membershipService.assignPosition(membershipId, request.position(), principal));
    }
}
