package com.club.backend.controller;

import java.util.List;
import java.util.UUID;

import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.club.backend.dto.CreateUserRequest;
import com.club.backend.dto.UpdateUserRequest;
import com.club.backend.dto.UserAdminResponse;
import com.club.backend.entity.Role;
import com.club.backend.security.UserPrincipal;
import com.club.backend.service.UserAdminService;

import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/api/admin/users")
@PreAuthorize("hasRole('SUPER_ADMIN')")
@RequiredArgsConstructor
public class UserAdminController {

    private static final int DEFAULT_PAGE_SIZE = 20;

    private final UserAdminService userAdminService;

    @GetMapping
    public ResponseEntity<List<UserAdminResponse>> list(@RequestParam(required = false) String q,
            @RequestParam(required = false) Role role, @RequestParam(required = false) Integer page,
            @RequestParam(required = false) Integer size) {
        var pageable = PageSupport.pageable(page, size == null ? DEFAULT_PAGE_SIZE : size,
                Sort.by(Sort.Direction.DESC, "createdAt"));
        return PageSupport.respond(userAdminService.search(q, role, pageable));
    }

    @PostMapping
    public ResponseEntity<UserAdminResponse> create(@AuthenticationPrincipal UserPrincipal principal,
            @RequestBody CreateUserRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(userAdminService.create(principal, request));
    }

    @PutMapping("/{userId}")
    public ResponseEntity<UserAdminResponse> update(@AuthenticationPrincipal UserPrincipal principal,
            @PathVariable UUID userId, @RequestBody UpdateUserRequest request) {
        return ResponseEntity.ok(userAdminService.update(principal, userId, request));
    }

    @PostMapping("/{userId}/deactivate")
    public ResponseEntity<UserAdminResponse> deactivate(@AuthenticationPrincipal UserPrincipal principal,
            @PathVariable UUID userId) {
        return ResponseEntity.ok(userAdminService.setActive(principal, userId, false));
    }

    @PostMapping("/{userId}/activate")
    public ResponseEntity<UserAdminResponse> activate(@AuthenticationPrincipal UserPrincipal principal,
            @PathVariable UUID userId) {
        return ResponseEntity.ok(userAdminService.setActive(principal, userId, true));
    }
}
