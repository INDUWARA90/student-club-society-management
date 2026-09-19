package com.club.backend.repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import com.club.backend.entity.Membership;
import com.club.backend.entity.MembershipPosition;
import com.club.backend.entity.MembershipStatus;

public interface MembershipRepository extends JpaRepository<Membership, UUID> {

    Optional<Membership> findByUserIdAndClubId(UUID userId, UUID clubId);

    List<Membership> findByClubId(UUID clubId);

    List<Membership> findByUserId(UUID userId);

    List<Membership> findByClubIdAndStatus(UUID clubId, MembershipStatus status);

    Page<Membership> findByClubIdAndStatus(UUID clubId, MembershipStatus status, Pageable pageable);

    Optional<Membership> findByClubIdAndPosition(UUID clubId, MembershipPosition position);
}
