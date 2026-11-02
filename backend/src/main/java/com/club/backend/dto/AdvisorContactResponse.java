package com.club.backend.dto;

import java.util.List;

public record AdvisorContactResponse(
        boolean success,
        String message,
        List<String> advisorsNotified
) {}
