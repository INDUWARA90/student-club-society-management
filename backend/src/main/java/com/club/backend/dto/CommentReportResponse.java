package com.club.backend.dto;

import java.time.Instant;
import java.util.UUID;

import com.club.backend.entity.CommentReport;
import com.club.backend.entity.CommentTargetType;
import com.club.backend.entity.ReportStatus;

public record CommentReportResponse(
        UUID id,
        UUID clubId,
        CommentTargetType targetType,
        UUID targetId,
        UUID parentId,
        String reporterName,
        String reason,
        String commentContent,
        String commentAuthorName,
        ReportStatus status,
        Instant createdAt) {

    public static CommentReportResponse from(CommentReport report) {
        return new CommentReportResponse(
                report.getId(),
                report.getClub().getId(),
                report.getTargetType(),
                report.getTargetId(),
                report.getParentId(),
                report.getReporter().getName(),
                report.getReason(),
                report.getContentSnapshot(),
                report.getAuthorName(),
                report.getStatus(),
                report.getCreatedAt());
    }
}
