package com.club.backend.dto;

import java.util.UUID;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record ContactAdvisorRequest(
        UUID advisorId,
        UUID clubId,
        @NotBlank(message = "Subject is required")
        @Size(max = 200, message = "Subject cannot exceed 200 characters")
        String subject,
        @NotBlank(message = "Message is required")
        @Size(max = 5000, message = "Message cannot exceed 5000 characters")
        String message
) {}
