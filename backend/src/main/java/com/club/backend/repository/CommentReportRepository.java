package com.club.backend.repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;

import com.club.backend.entity.CommentReport;
import com.club.backend.entity.CommentTargetType;
import com.club.backend.entity.ReportStatus;

public interface CommentReportRepository extends JpaRepository<CommentReport, UUID> {

    List<CommentReport> findByClubIdAndStatusOrderByCreatedAtAsc(UUID clubId, ReportStatus status);

    Optional<CommentReport> findByReporterIdAndTargetTypeAndTargetId(UUID reporterId, CommentTargetType type, UUID targetId);

    List<CommentReport> findByTargetTypeAndTargetIdAndStatus(CommentTargetType type, UUID targetId, ReportStatus status);
}
