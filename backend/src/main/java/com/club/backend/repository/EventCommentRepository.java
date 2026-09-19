package com.club.backend.repository;

import java.util.List;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;

import com.club.backend.entity.EventComment;

public interface EventCommentRepository extends JpaRepository<EventComment, UUID> {

    List<EventComment> findByEventIdOrderByCreatedAtAsc(UUID eventId);
}
