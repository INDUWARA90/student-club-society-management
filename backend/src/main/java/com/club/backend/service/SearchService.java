package com.club.backend.service;

import org.springframework.stereotype.Service;

import com.club.backend.dto.ClubAnnouncementResponse;
import com.club.backend.dto.ClubResponse;
import com.club.backend.dto.EventResponse;
import com.club.backend.dto.SearchResponse;
import com.club.backend.entity.ClubStatus;
import com.club.backend.entity.EventApprovalStatus;
import com.club.backend.repository.ClubAnnouncementRepository;
import com.club.backend.repository.ClubRepository;
import com.club.backend.repository.EventRepository;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class SearchService {

    private final ClubRepository clubRepository;
    private final EventRepository eventRepository;
    private final ClubAnnouncementRepository announcementRepository;

    public SearchResponse search(String query) {
        if (query == null || query.trim().isEmpty()) {
            return new SearchResponse(java.util.List.of(), java.util.List.of(), java.util.List.of());
        }
        String q = query.trim();

        var clubs = clubRepository.findByStatusAndNameContainingIgnoreCase(ClubStatus.APPROVED, q)
                .stream().map(ClubResponse::from).toList();

        var events = eventRepository.findByTitleContainingIgnoreCase(q).stream()
                .filter(e -> e.getApprovalStatus() == EventApprovalStatus.NOT_REQUIRED
                        || e.getApprovalStatus() == EventApprovalStatus.APPROVED)
                .map(EventResponse::from)
                .toList();

        var announcements = announcementRepository.findByContentContainingIgnoreCase(q)
                .stream().map(ClubAnnouncementResponse::from).toList();

        return new SearchResponse(clubs, events, announcements);
    }
}
