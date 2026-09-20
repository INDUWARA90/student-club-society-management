package com.club.backend.dto;

import java.time.Instant;
import java.util.UUID;

import com.club.backend.entity.Attendance;
import com.club.backend.entity.AttendanceMethod;

/** One row of a student's own participation history: which event, which club, and how/when they were checked in. */
public record MyAttendanceResponse(
        UUID eventId, String eventTitle, Instant eventDate, UUID clubId, String clubName,
        AttendanceMethod method, Instant markedAt) {

    public static MyAttendanceResponse from(Attendance attendance) {
        var event = attendance.getEvent();
        return new MyAttendanceResponse(
                event.getId(), event.getTitle(), event.getEventDate(), event.getClub().getId(),
                event.getClub().getName(), attendance.getMethod(), attendance.getMarkedAt());
    }
}
