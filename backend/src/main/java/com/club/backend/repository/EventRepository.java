package com.club.backend.repository;

import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.club.backend.entity.Event;
import com.club.backend.entity.EventApprovalStatus;

import jakarta.persistence.LockModeType;

public interface EventRepository extends JpaRepository<Event, UUID>, JpaSpecificationExecutor<Event> {

    List<Event> findByClubId(UUID clubId);

    /** Row-locks the event so concurrent RSVPs/cancellations for the same event are serialised. */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT e FROM Event e WHERE e.id = :id")
    Optional<Event> findByIdForUpdate(@Param("id") UUID id);

    long countByApprovalStatusInAndCancelledFalse(Collection<EventApprovalStatus> statuses);

    /** Upcoming, still-live events of a club (used when archiving a club). */
    List<Event> findByClubIdAndCancelledFalseAndEventDateAfter(UUID clubId, Instant after);

    List<Event> findByApprovalStatus(EventApprovalStatus approvalStatus);

    List<Event> findByEventDateBetween(Instant start, Instant end);

    List<Event> findByTitleContainingIgnoreCase(String title);

    /** Events at {@code venueId} (excluding {@code excludeEventId}) whose booking window overlaps [start, end). */
    @Query("SELECT e FROM Event e WHERE e.venue.id = :venueId AND e.id <> :excludeEventId "
            + "AND e.approvalStatus <> com.club.backend.entity.EventApprovalStatus.REJECTED AND e.cancelled = false "
            + "AND e.eventDate < :end AND e.endDate > :start")
    List<Event> findConflictingBookings(
            @Param("venueId") UUID venueId,
            @Param("start") Instant start,
            @Param("end") Instant end,
            @Param("excludeEventId") UUID excludeEventId);

    List<Event> findByVenueIdAndEventDateBetween(UUID venueId, Instant start, Instant end);

    List<Event> findByVenueId(UUID venueId);
}
