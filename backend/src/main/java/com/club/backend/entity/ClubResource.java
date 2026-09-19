package com.club.backend.entity;

import java.time.Instant;
import java.util.UUID;

import org.hibernate.Length;
import org.hibernate.annotations.UuidGenerator;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
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

/** A shared document (constitution, meeting minutes, etc.) uploaded by a club officer. Officer-only upload,
 *  enforced in the service layer, same as {@link ClubAnnouncement}. Stored as base64, same convention as
 *  {@code Club.logoB64}/{@code Event.bannerB64} — no separate file-storage mechanism in this app. */
@Entity
@Table(name = "club_resources")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ClubResource {

    @Id
    @UuidGenerator
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "club_id", nullable = false)
    private Club club;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "uploaded_by", nullable = false)
    private User uploadedBy;

    @Column(nullable = false, length = 150)
    private String title;

    @Column(name = "file_name", nullable = false, length = 255)
    private String fileName;

    @Column(name = "content_type", nullable = false, length = 100)
    private String contentType;

    @Lob
    @Column(name = "file_b64", nullable = false, length = Length.LONG32)
    private String fileB64;

    @Column(name = "created_at", nullable = false, updatable = false)
    @Builder.Default
    private Instant createdAt = Instant.now();
}
