package com.club.backend.controller;

import java.util.List;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.club.backend.dto.AlumniResponse;
import com.club.backend.service.AlumniService;

import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/api/users/alumni")
@RequiredArgsConstructor
public class AlumniController {

    private final AlumniService alumniService;

    @GetMapping
    public ResponseEntity<List<AlumniResponse>> listAlumni() {
        return ResponseEntity.ok(alumniService.listAlumni());
    }
}
