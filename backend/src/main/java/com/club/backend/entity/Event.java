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
@Table(name = "events")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Event {

    @Id
    @UuidGenerator
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "club_id", nullable = false)
    private Club club;

    @Column(nullable = false, length = 150)
    private String title;

    @Lob
    private String description;

    @Column(length = 255)
    private String location;

    @Lob
    @Column(name = "banner_b64", length = Length.LONG32)
    private String bannerB64;

    @Column(name = "event_date", nullable = false)
    private Instant eventDate;

    /** End of the venue booking window; only meaningful when {@code venue} is set. */
    @Column(name = "end_date")
    private Instant endDate;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "venue_id")
    private Venue venue;

    @Column(nullable = false, precision = 10, scale = 2)
    @Builder.Default
    private BigDecimal fee = BigDecimal.ZERO;

    /** null = unlimited */
    @Column
    private Integer capacity;

    @Column(name = "requires_fa_approval", nullable = false)
    @Builder.Default
    private boolean requiresFaApproval = false;

    @Enumerated(EnumType.STRING)
    @Column(name = "approval_status", nullable = false, length = 20)
    @Builder.Default
    private EventApprovalStatus approvalStatus = EventApprovalStatus.NOT_REQUIRED;

    /** Optional spending plan for the event, compared against expenses linked to it in the club ledger. */
    @Column(precision = 10, scale = 2)
    private BigDecimal budget;

    @Column(nullable = false)
    @ColumnDefault("false")
    @Builder.Default
    private boolean cancelled = false;

    @Column(name = "cancel_reason", length = 500)
    private String cancelReason;

    /** Why the Faculty Advisor rejected the event; cleared when the event is resubmitted. */
    @Column(name = "rejection_reason", length = 500)
    private String rejectionReason;

    @Column(name = "created_at", nullable = false, updatable = false)
    @Builder.Default
    private Instant createdAt = Instant.now();
}
