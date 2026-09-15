package com.club.backend.repository;

import java.util.List;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;

import com.club.backend.entity.ClubAnnouncement;

public interface ClubAnnouncementRepository extends JpaRepository<ClubAnnouncement, UUID> {

    List<ClubAnnouncement> findByClubIdOrderByCreatedAtDesc(UUID clubId);
}
