package com.club.backend.repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;

import com.club.backend.entity.Rsvp;
import com.club.backend.entity.RsvpStatus;

public interface RsvpRepository extends JpaRepository<Rsvp, UUID> {

    Optional<Rsvp> findByEventIdAndUserId(UUID eventId, UUID userId);

    List<Rsvp> findByEventIdAndStatus(UUID eventId, RsvpStatus status);

    List<Rsvp> findByEventIdAndStatusOrderByWaitlistOrderAsc(UUID eventId, RsvpStatus status);

    List<Rsvp> findByUserId(UUID userId);

    long countByEventIdAndStatus(UUID eventId, RsvpStatus status);

    long countByEvent_Club_IdAndStatus(UUID clubId, RsvpStatus status);
}
