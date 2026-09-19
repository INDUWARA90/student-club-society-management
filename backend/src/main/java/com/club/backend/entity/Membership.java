package com.club.backend.entity;

import java.time.Instant;
import java.util.UUID;

import org.hibernate.annotations.UuidGenerator;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * position = PRESIDENT is the automatically-derived Club Admin; enforcing
 * exactly one PRESIDENT per club is a service-level invariant (Hibernate
 * auto-DDL can't express the schema.sql partial unique index), see Phase 2.
 */
@Entity
@Table(name = "memberships", uniqueConstraints = @UniqueConstraint(columnNames = { "user_id", "club_id" }))
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Membership {

    @Id
    @UuidGenerator
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "club_id", nullable = false)
    private Club club;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    @Builder.Default
    private MembershipPosition position = MembershipPosition.MEMBER;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    @Builder.Default
    private MembershipStatus status = MembershipStatus.PENDING;

    @Column(name = "joined_at", nullable = false, updatable = false)
    @Builder.Default
    private Instant joinedAt = Instant.now();

    /**
     * Mirrors the club id while this membership is the PRESIDENT, otherwise null. The unique constraint on it gives
     * a database-level "exactly one President per club" guarantee (MySQL has no partial unique indexes, and unique
     * indexes allow many NULLs).
     */
    @Column(name = "president_club_id", unique = true)
    private UUID presidentClubId;

    @PrePersist
    @PreUpdate
    void syncPresidentMarker() {
        presidentClubId = position == MembershipPosition.PRESIDENT && club != null ? club.getId() : null;
    }
}
