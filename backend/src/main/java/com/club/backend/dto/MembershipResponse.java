package com.club.backend.dto;

import java.time.Instant;
import java.util.UUID;

import com.club.backend.entity.Membership;
import com.club.backend.entity.MembershipPosition;
import com.club.backend.entity.MembershipStatus;

public record MembershipResponse(
        UUID id,
        UUID userId,
        String userName,
        UUID clubId,
        String clubName,
        MembershipPosition position,
        MembershipStatus status,
        Instant joinedAt) {

    public static MembershipResponse from(Membership membership) {
        return new MembershipResponse(
                membership.getId(),
                membership.getUser().getId(),
                membership.getUser().getName(),
                membership.getClub().getId(),
                membership.getClub().getName(),
                membership.getPosition(),
                membership.getStatus(),
                membership.getJoinedAt());
    }
}
