package com.club.backend.entity;

import java.time.Instant;
import java.util.UUID;

import org.hibernate.annotations.UuidGenerator;

import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import jakarta.persistence.Column;
import jakarta.persistence.UniqueConstraint;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/** A verified certificate awarded to a student for attending a specific event. */
@Entity
@Table(name = "certificates", uniqueConstraints = @UniqueConstraint(columnNames = { "user_id", "event_id" }))
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Certificate {

    @Id
    @UuidGenerator
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "club_id", nullable = false)
    private Club club;

    /** The attended event this certificate recognizes. Legacy club certificates have no event. */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "event_id")
    private Event event;

    /** Public code printed on the PDF so anyone can verify the certificate is genuine. */
    @Column(name = "verification_code", unique = true, length = 36)
    private String verificationCode;

    @Column(name = "issued_at", nullable = false, updatable = false)
    @Builder.Default
    private Instant issuedAt = Instant.now();
}
