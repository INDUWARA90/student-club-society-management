package com.club.backend.repository;

import java.util.List;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.club.backend.entity.ClubAnnouncement;

public interface ClubAnnouncementRepository extends JpaRepository<ClubAnnouncement, UUID> {

    List<ClubAnnouncement> findByClubIdOrderByCreatedAtDesc(UUID clubId);

    @Query(value = "SELECT * FROM club_announcements WHERE content LIKE CONCAT('%', :content, '%')", nativeQuery = true)
    List<ClubAnnouncement> findByContentContainingIgnoreCase(@Param("content") String content);
}
