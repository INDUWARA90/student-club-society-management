package com.club.backend.dto;

import java.math.BigDecimal;

import com.club.backend.entity.JoinPolicy;

public record CreateClubRequest(
        String name,
        String description,
        String category,
        JoinPolicy joinPolicy,
        String logoB64,
        BigDecimal membershipFee,
        Integer certificateThreshold) {

    public CreateClubRequest(String name, String description, String category, JoinPolicy joinPolicy, String logoB64) {
        this(name, description, category, joinPolicy, logoB64, null, null);
    }
}
