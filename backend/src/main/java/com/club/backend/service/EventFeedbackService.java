package com.club.backend.service;

import java.util.List;
import java.util.UUID;

import org.springframework.stereotype.Service;

import com.club.backend.config.ApiException;
import com.club.backend.dto.CreateFeedbackRequest;
import com.club.backend.dto.EventFeedbackResponse;
import com.club.backend.entity.Event;
import com.club.backend.entity.EventFeedback;
import com.club.backend.entity.User;
import com.club.backend.repository.AttendanceRepository;
import com.club.backend.repository.EventFeedbackRepository;
import com.club.backend.repository.EventRepository;
import com.club.backend.repository.UserRepository;
import com.club.backend.security.UserPrincipal;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class EventFeedbackService {

    private final EventFeedbackRepository feedbackRepository;
    private final EventRepository eventRepository;
    private final AttendanceRepository attendanceRepository;
    private final UserRepository userRepository;

    public EventFeedbackResponse submitFeedback(UUID eventId, CreateFeedbackRequest request, UserPrincipal principal) {
        if (request.rating() < 1 || request.rating() > 5) {
            throw ApiException.badRequest("Rating must be between 1 and 5");
        }

        Event event = eventRepository.findById(eventId)
                .orElseThrow(() -> ApiException.notFound("Event not found"));

        User user = userRepository.findById(principal.getId())
                .orElseThrow(() -> ApiException.notFound("User not found"));

        attendanceRepository.findByEventIdAndUserId(eventId, user.getId())
                .orElseThrow(() -> ApiException.forbidden("Only attendees can leave feedback"));

        if (feedbackRepository.findByEventIdAndUserId(eventId, user.getId()).isPresent()) {
            throw ApiException.conflict("You have already left feedback for this event");
        }

        EventFeedback feedback = EventFeedback.builder()
                .event(event)
                .user(user)
                .rating(request.rating())
                .comment(request.comment())
                .build();
        feedback = feedbackRepository.save(feedback);

        return EventFeedbackResponse.from(feedback);
    }

    public List<EventFeedbackResponse> listFeedback(UUID eventId) {
        return feedbackRepository.findByEventId(eventId).stream().map(EventFeedbackResponse::from).toList();
    }

    public double getAverageRating(UUID eventId) {
        List<EventFeedback> feedback = feedbackRepository.findByEventId(eventId);
        return feedback.stream().mapToInt(EventFeedback::getRating).average().orElse(0);
    }
}
