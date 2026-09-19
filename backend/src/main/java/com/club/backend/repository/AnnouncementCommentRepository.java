package com.club.backend.repository;

import java.util.List;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;

import com.club.backend.entity.AnnouncementComment;

public interface AnnouncementCommentRepository extends JpaRepository<AnnouncementComment, UUID> {

    List<AnnouncementComment> findByAnnouncementIdOrderByCreatedAtAsc(UUID announcementId);
}
