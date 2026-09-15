package com.club.backend.dto;

import com.club.backend.entity.JoinPolicy;

public record CreateClubRequest(
        String name,
        String description,
        String category,
        JoinPolicy joinPolicy,
        String logoB64) {
}
