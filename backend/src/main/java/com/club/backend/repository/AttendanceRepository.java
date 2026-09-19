package com.club.backend.repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;

import com.club.backend.entity.Attendance;

public interface AttendanceRepository extends JpaRepository<Attendance, UUID> {

    Optional<Attendance> findByEventIdAndUserId(UUID eventId, UUID userId);

    List<Attendance> findByEventId(UUID eventId);

    List<Attendance> findByUserId(UUID userId);

    long countByUserIdAndEvent_Club_Id(UUID userId, UUID clubId);

    long countByEvent_Club_Id(UUID clubId);

    long countByEventId(UUID eventId);
}
