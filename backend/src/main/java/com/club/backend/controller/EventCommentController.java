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

import com.club.backend.dto.CreateCommentRequest;
import com.club.backend.dto.EventCommentResponse;
import com.club.backend.security.UserPrincipal;
import com.club.backend.service.EventCommentService;

import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/api/events/{eventId}/comments")
@RequiredArgsConstructor
public class EventCommentController {

    private final EventCommentService commentService;

    @PostMapping
    public ResponseEntity<EventCommentResponse> postComment(@PathVariable UUID eventId,
            @RequestBody CreateCommentRequest request, @AuthenticationPrincipal UserPrincipal principal) {
        return ResponseEntity.ok(commentService.postComment(eventId, request, principal));
    }

    @GetMapping
    public ResponseEntity<List<EventCommentResponse>> listComments(@PathVariable UUID eventId) {
        return ResponseEntity.ok(commentService.listComments(eventId));
    }

    @DeleteMapping("/{commentId}")
    public ResponseEntity<Void> deleteComment(@PathVariable UUID eventId, @PathVariable UUID commentId,
            @AuthenticationPrincipal UserPrincipal principal) {
        commentService.deleteComment(eventId, commentId, principal);
        return ResponseEntity.ok().build();
    }
}
