package com.club.backend.controller;

import java.util.List;
import java.util.UUID;

import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.club.backend.dto.CommentReportResponse;
import com.club.backend.dto.ReportCommentRequest;
import com.club.backend.dto.ResolveReportRequest;
import com.club.backend.security.UserPrincipal;
import com.club.backend.service.CommentReportService;

import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
public class CommentReportController {

    private final CommentReportService reportService;

    @PostMapping("/clubs/{clubId}/announcements/{announcementId}/comments/{commentId}/report")
    public ResponseEntity<CommentReportResponse> reportAnnouncementComment(@PathVariable UUID clubId,
            @PathVariable UUID announcementId, @PathVariable UUID commentId,
            @RequestBody(required = false) ReportCommentRequest request, @AuthenticationPrincipal UserPrincipal principal) {
        return ResponseEntity.ok(reportService.reportAnnouncementComment(clubId, announcementId, commentId, request, principal));
    }

    @PostMapping("/events/{eventId}/comments/{commentId}/report")
    public ResponseEntity<CommentReportResponse> reportEventComment(@PathVariable UUID eventId,
            @PathVariable UUID commentId, @RequestBody(required = false) ReportCommentRequest request,
            @AuthenticationPrincipal UserPrincipal principal) {
        return ResponseEntity.ok(reportService.reportEventComment(eventId, commentId, request, principal));
    }

    /** Club Admin only: comments members have reported and that still need a decision. */
    @GetMapping("/clubs/{clubId}/comment-reports")
    public ResponseEntity<List<CommentReportResponse>> listOpenReports(@PathVariable UUID clubId,
            @AuthenticationPrincipal UserPrincipal principal) {
        return ResponseEntity.ok(reportService.listOpenReports(clubId, principal));
    }

    @PostMapping("/clubs/{clubId}/comment-reports/{reportId}/resolve")
    public ResponseEntity<CommentReportResponse> resolve(@PathVariable UUID clubId, @PathVariable UUID reportId,
            @RequestBody ResolveReportRequest request, @AuthenticationPrincipal UserPrincipal principal) {
        return ResponseEntity.ok(reportService.resolve(clubId, reportId, request, principal));
    }
}
