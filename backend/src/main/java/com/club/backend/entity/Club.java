package com.club.backend.entity;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

import org.hibernate.annotations.ColumnDefault;
import org.hibernate.Length;
import org.hibernate.annotations.UuidGenerator;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.Lob;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "clubs")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Club {

    @Id
    @UuidGenerator
    private UUID id;

    @Column(nullable = false, length = 150)
    private String name;

    @Lob
    private String description;

    @Column(nullable = false, length = 50)
    private String category;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    @Builder.Default
    private ClubStatus status = ClubStatus.PENDING;

    @Enumerated(EnumType.STRING)
    @Column(name = "join_policy", nullable = false, length = 20)
    @Builder.Default
    private JoinPolicy joinPolicy = JoinPolicy.OPEN;

    /** One-off fee to join; zero means free. Must be paid (simulated) before a join request is accepted. */
    @Column(name = "membership_fee", nullable = false, precision = 10, scale = 2)
    @ColumnDefault("0")
    @Builder.Default
    private BigDecimal membershipFee = BigDecimal.ZERO;

    /** Events a member must attend to earn the club's certificate; null falls back to the sitewide default. */
    @Column(name = "certificate_threshold")
    @Builder.Default
    private Integer certificateThreshold = 3;

    /** Archived clubs are closed: hidden from browsing, no joins, no new events. Kept for the record. */
    @Column(nullable = false)
    @ColumnDefault("false")
    @Builder.Default
    private boolean archived = false;

    @Lob
    @Column(name = "logo_b64", length = Length.LONG32)
    private String logoB64;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "created_by", nullable = false)
    private User createdBy;

    @Column(name = "created_at", nullable = false, updatable = false)
    @Builder.Default
    private Instant createdAt = Instant.now();
}
