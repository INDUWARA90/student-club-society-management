package com.club.backend.controller;

import java.util.List;
import java.util.UUID;

import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.club.backend.dto.AnnouncementCommentResponse;
import com.club.backend.dto.CreateCommentRequest;
import com.club.backend.security.UserPrincipal;
import com.club.backend.service.AnnouncementCommentService;

import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/api/clubs/{clubId}/announcements/{announcementId}/comments")
@RequiredArgsConstructor
public class AnnouncementCommentController {

    private final AnnouncementCommentService commentService;

    @PostMapping
    public ResponseEntity<AnnouncementCommentResponse> postComment(@PathVariable UUID clubId,
            @PathVariable UUID announcementId, @RequestBody CreateCommentRequest request,
            @AuthenticationPrincipal UserPrincipal principal) {
        return ResponseEntity.ok(commentService.postComment(clubId, announcementId, request, principal));
    }

    @GetMapping
    public ResponseEntity<List<AnnouncementCommentResponse>> listComments(@PathVariable UUID announcementId) {
        return ResponseEntity.ok(commentService.listComments(announcementId));
    }

    @DeleteMapping("/{commentId}")
    public ResponseEntity<Void> deleteComment(@PathVariable UUID clubId, @PathVariable UUID commentId,
            @AuthenticationPrincipal UserPrincipal principal) {
        commentService.deleteComment(clubId, commentId, principal);
        return ResponseEntity.ok().build();
    }
}
