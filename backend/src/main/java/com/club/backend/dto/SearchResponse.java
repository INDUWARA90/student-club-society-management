package com.club.backend.dto;

import java.util.List;

public record SearchResponse(
        List<ClubResponse> clubs,
        List<EventResponse> events,
        List<ClubAnnouncementResponse> announcements) {
}
