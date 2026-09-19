package com.club.backend.repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;

import com.club.backend.entity.EventFeedback;

public interface EventFeedbackRepository extends JpaRepository<EventFeedback, UUID> {

    Optional<EventFeedback> findByEventIdAndUserId(UUID eventId, UUID userId);

    List<EventFeedback> findByEventId(UUID eventId);
}
