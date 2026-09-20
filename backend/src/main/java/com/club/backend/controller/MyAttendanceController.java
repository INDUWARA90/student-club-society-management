package com.club.backend.controller;

import java.util.List;

import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.club.backend.dto.MyAttendanceResponse;
import com.club.backend.security.UserPrincipal;
import com.club.backend.service.AttendanceService;

import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/api/attendance")
@RequiredArgsConstructor
public class MyAttendanceController {

    private final AttendanceService attendanceService;

    @GetMapping("/me")
    public ResponseEntity<List<MyAttendanceResponse>> myAttendance(@AuthenticationPrincipal UserPrincipal principal) {
        return ResponseEntity.ok(attendanceService.listMine(principal));
    }
}
