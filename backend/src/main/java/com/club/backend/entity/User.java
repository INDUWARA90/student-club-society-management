package com.club.backend.entity;

import java.time.Instant;
import java.util.UUID;

import org.hibernate.annotations.ColumnDefault;
import org.hibernate.Length;
import org.hibernate.annotations.UuidGenerator;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Lob;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "users")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class User {

    @Id
    @UuidGenerator
    private UUID id;

    @Column(nullable = false, length = 150)
    private String name;

    @Column(nullable = false, unique = true, length = 255)
    private String email;

    @Column(name = "password_hash", nullable = false, length = 255)
    private String passwordHash;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    @Builder.Default
    private Role role = Role.STUDENT;

    @Lob
    @Column(name = "profile_image_b64", length = Length.LONG32)
    private String profileImageB64;

    /** A deactivated account keeps its data but can no longer sign in or use existing tokens. */
    @Column(nullable = false)
    @ColumnDefault("true")
    @Builder.Default
    private boolean active = true;

    @Column(name = "email_verified", nullable = false)
    @Builder.Default
    private boolean emailVerified = false;

    /** When false, in-app notifications are still recorded but no email is sent. */
    @Column(name = "email_notifications_enabled", nullable = false)
    @ColumnDefault("true")
    @Builder.Default
    private boolean emailNotificationsEnabled = true;

    /** When true, notification emails are batched into one daily digest instead of sent one by one. */
    @Column(name = "email_digest_enabled", nullable = false)
    @ColumnDefault("false")
    @Builder.Default
    private boolean emailDigestEnabled = false;

    /** Tokens issued before this instant are rejected (set on password change/reset to revoke old sessions). */
    @Column(name = "password_changed_at")
    private Instant passwordChangedAt;

    /** null = not set; used to derive alumni status (graduationYear < current year). */
    @Column(name = "graduation_year")
    private Integer graduationYear;

    @Column(name = "created_at", nullable = false, updatable = false)
    @Builder.Default
    private Instant createdAt = Instant.now();
}
