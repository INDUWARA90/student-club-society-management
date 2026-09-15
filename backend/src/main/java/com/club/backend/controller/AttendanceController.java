package com.club.backend.controller;

import java.util.List;
import java.util.UUID;

import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.club.backend.dto.AttendanceResponse;
import com.club.backend.dto.MarkAttendanceRequest;
import com.club.backend.security.UserPrincipal;
import com.club.backend.service.AttendanceService;

import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/api/events/{eventId}/attendance")
@RequiredArgsConstructor
public class AttendanceController {

    private final AttendanceService attendanceService;

    @PostMapping("/manual")
    public ResponseEntity<AttendanceResponse> markManual(@PathVariable UUID eventId,
            @RequestBody MarkAttendanceRequest request, @AuthenticationPrincipal UserPrincipal principal) {
        return ResponseEntity.ok(attendanceService.markManual(eventId, request.userId(), principal));
    }

    @PostMapping("/qr-check-in")
    public ResponseEntity<AttendanceResponse> checkInViaQr(@PathVariable UUID eventId,
            @AuthenticationPrincipal UserPrincipal principal) {
        return ResponseEntity.ok(attendanceService.checkInViaQr(eventId, principal));
    }

    @GetMapping
    public ResponseEntity<List<AttendanceResponse>> listAttendance(@PathVariable UUID eventId) {
        return ResponseEntity.ok(attendanceService.listAttendance(eventId));
    }
}
