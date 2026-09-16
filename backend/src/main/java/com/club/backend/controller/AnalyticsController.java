package com.club.backend.controller;

import java.util.UUID;

import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.club.backend.dto.ClubStatsResponse;
import com.club.backend.dto.UniversityStatsResponse;
import com.club.backend.service.AnalyticsService;

import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/api/analytics")
@RequiredArgsConstructor
public class AnalyticsController {

    private final AnalyticsService analyticsService;

    @GetMapping("/clubs/{clubId}")
    public ResponseEntity<ClubStatsResponse> clubStats(@PathVariable UUID clubId) {
        return ResponseEntity.ok(analyticsService.getClubStats(clubId));
    }

    @GetMapping("/university")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN', 'FACULTY_ADVISOR')")
    public ResponseEntity<UniversityStatsResponse> universityStats() {
        return ResponseEntity.ok(analyticsService.getUniversityStats());
    }

    @GetMapping("/university/csv")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN', 'FACULTY_ADVISOR')")
    public ResponseEntity<String> universityStatsCsv() {
        return csvResponse(analyticsService.getUniversityStatsCsv(), "university-stats.csv");
    }

    @GetMapping("/clubs/{clubId}/csv")
    public ResponseEntity<String> clubStatsCsv(@PathVariable UUID clubId) {
        return csvResponse(analyticsService.getClubStatsCsv(clubId), "club-stats.csv");
    }

    private ResponseEntity<String> csvResponse(String csv, String filename) {
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType("text/csv"))
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + filename + "\"")
                .body(csv);
    }
}
