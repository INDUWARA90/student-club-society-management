package com.club.backend.dto;

import java.time.Instant;
import java.util.UUID;

import com.club.backend.entity.Attendance;
import com.club.backend.entity.AttendanceMethod;

public record AttendanceResponse(
        UUID id,
        UUID eventId,
        UUID userId,
        String userName,
        AttendanceMethod method,
        Instant markedAt) {

    public static AttendanceResponse from(Attendance attendance) {
        return new AttendanceResponse(
                attendance.getId(),
                attendance.getEvent().getId(),
                attendance.getUser().getId(),
                attendance.getUser().getName(),
                attendance.getMethod(),
                attendance.getMarkedAt());
    }
}
