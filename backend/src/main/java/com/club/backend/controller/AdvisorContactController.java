package com.club.backend.controller;

import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import com.club.backend.dto.AdvisorContactResponse;
import com.club.backend.dto.AdvisorSummaryResponse;
import com.club.backend.dto.ContactAdvisorRequest;
import com.club.backend.security.UserPrincipal;
import com.club.backend.service.AdvisorContactService;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/api/advisors")
@RequiredArgsConstructor
public class AdvisorContactController {

    private final AdvisorContactService advisorContactService;

    @GetMapping
    @PreAuthorize("isAuthenticated()")
    public List<AdvisorSummaryResponse> getActiveAdvisors() {
        return advisorContactService.getActiveAdvisors();
    }

    @PostMapping("/contact")
    @ResponseStatus(HttpStatus.OK)
    @PreAuthorize("isAuthenticated()")
    public AdvisorContactResponse contactAdvisor(
            @AuthenticationPrincipal UserPrincipal principal,
            @Valid @RequestBody ContactAdvisorRequest request) {
        return advisorContactService.contactAdvisor(principal, request);
    }
}
