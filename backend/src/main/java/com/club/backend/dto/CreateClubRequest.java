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
        Integer certificateThreshold,
        Boolean showBudgetToMembers) {

    public CreateClubRequest(String name, String description, String category, JoinPolicy joinPolicy, String logoB64) {
        this(name, description, category, joinPolicy, logoB64, null, null, null);
    }

    public CreateClubRequest(String name, String description, String category, JoinPolicy joinPolicy, String logoB64,
            BigDecimal membershipFee, Integer certificateThreshold) {
        this(name, description, category, joinPolicy, logoB64, membershipFee, certificateThreshold, null);
    }
}
