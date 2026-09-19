package com.club.backend.dto;

import java.util.UUID;

import com.club.backend.entity.AttendanceMethod;

public record MarkAttendanceRequest(UUID userId, AttendanceMethod method) {
}
