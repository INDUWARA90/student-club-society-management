package com.club.backend.controller;

import java.util.List;
import java.util.Map;
import java.util.UUID;

import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.club.backend.dto.CreateFeedbackRequest;
import com.club.backend.dto.EventFeedbackResponse;
import com.club.backend.security.UserPrincipal;
import com.club.backend.service.EventFeedbackService;

import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/api/events/{eventId}/feedback")
@RequiredArgsConstructor
public class EventFeedbackController {

    private final EventFeedbackService feedbackService;

    @PostMapping
    public ResponseEntity<EventFeedbackResponse> submitFeedback(@PathVariable UUID eventId,
            @RequestBody CreateFeedbackRequest request, @AuthenticationPrincipal UserPrincipal principal) {
        return ResponseEntity.ok(feedbackService.submitFeedback(eventId, request, principal));
    }

    @GetMapping
    public ResponseEntity<List<EventFeedbackResponse>> listFeedback(@PathVariable UUID eventId) {
        return ResponseEntity.ok(feedbackService.listFeedback(eventId));
    }

    @GetMapping("/average")
    public ResponseEntity<Map<String, Double>> averageRating(@PathVariable UUID eventId) {
        return ResponseEntity.ok(Map.of("averageRating", feedbackService.getAverageRating(eventId)));
    }
}
