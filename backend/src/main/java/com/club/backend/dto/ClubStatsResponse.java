package com.club.backend.dto;

public record ClubStatsResponse(long memberCount, long eventCount, long totalRsvps, long totalAttendance) {
}
