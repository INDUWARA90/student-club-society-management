package com.club.backend.service;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.club.backend.config.ApiException;
import com.club.backend.dto.CommentReportResponse;
import com.club.backend.dto.ReportCommentRequest;
import com.club.backend.dto.ResolveReportRequest;
import com.club.backend.entity.AnnouncementComment;
import com.club.backend.entity.Club;
import com.club.backend.entity.CommentReport;
import com.club.backend.entity.CommentTargetType;
import com.club.backend.entity.EventComment;
import com.club.backend.entity.MembershipPosition;
import com.club.backend.entity.MembershipStatus;
import com.club.backend.entity.ReportStatus;
import com.club.backend.entity.User;
import com.club.backend.repository.AnnouncementCommentRepository;
import com.club.backend.repository.CommentReportRepository;
import com.club.backend.repository.EventCommentRepository;
import com.club.backend.repository.MembershipRepository;
import com.club.backend.repository.UserRepository;
import com.club.backend.security.UserPrincipal;

import lombok.RequiredArgsConstructor;

/**
 * Member-driven moderation: any club member can report a comment, and the Club Admin (President) either dismisses the
 * report or removes the comment. Removing a comment also closes every other open report about it.
 */
@Service
@RequiredArgsConstructor
@Transactional
public class CommentReportService {

    private static final int MAX_REASON = 500;
    private static final int MAX_SNAPSHOT = 1000;

    private final CommentReportRepository reportRepository;
    private final AnnouncementCommentRepository announcementCommentRepository;
    private final EventCommentRepository eventCommentRepository;
    private final MembershipRepository membershipRepository;
    private final UserRepository userRepository;
    private final NotificationService notificationService;
    private final AuditLogService auditLogService;

    public CommentReportResponse reportAnnouncementComment(UUID clubId, UUID announcementId, UUID commentId,
            ReportCommentRequest request, UserPrincipal principal) {
        AnnouncementComment comment = announcementCommentRepository.findById(commentId)
                .orElseThrow(() -> ApiException.notFound("Comment not found"));
        Club club = comment.getAnnouncement().getClub();
        if (!comment.getAnnouncement().getId().equals(announcementId) || !club.getId().equals(clubId)) {
            throw ApiException.notFound("Comment not found");
        }
        return createReport(club, CommentTargetType.ANNOUNCEMENT_COMMENT, comment.getId(), announcementId,
                comment.getAuthor(), comment.getContent(), request, principal);
    }

    public CommentReportResponse reportEventComment(UUID eventId, UUID commentId, ReportCommentRequest request,
            UserPrincipal principal) {
        EventComment comment = eventCommentRepository.findById(commentId)
                .orElseThrow(() -> ApiException.notFound("Comment not found"));
        if (!comment.getEvent().getId().equals(eventId)) {
            throw ApiException.notFound("Comment not found");
        }
        return createReport(comment.getEvent().getClub(), CommentTargetType.EVENT_COMMENT, comment.getId(), eventId,
                comment.getAuthor(), comment.getContent(), request, principal);
    }

    private CommentReportResponse createReport(Club club, CommentTargetType type, UUID commentId, UUID parentId,
            User author, String content, ReportCommentRequest request, UserPrincipal principal) {
        String reason = request == null || request.reason() == null ? "" : request.reason().trim();
        if (reason.isEmpty()) {
            throw ApiException.badRequest("Please say why you're reporting this comment");
        }
        if (reason.length() > MAX_REASON) {
            throw ApiException.badRequest("The reason must be " + MAX_REASON + " characters or fewer");
        }

        User reporter = userRepository.findById(principal.getId())
                .orElseThrow(() -> ApiException.notFound("User not found"));

        membershipRepository.findByUserIdAndClubId(reporter.getId(), club.getId())
                .filter(m -> m.getStatus() == MembershipStatus.APPROVED)
                .orElseThrow(() -> ApiException.forbidden("Only club members can report comments"));

        if (author.getId().equals(reporter.getId())) {
            throw ApiException.badRequest("You can't report your own comment");
        }
        if (reportRepository.findByReporterIdAndTargetTypeAndTargetId(reporter.getId(), type, commentId).isPresent()) {
            throw ApiException.conflict("You have already reported this comment");
        }

        CommentReport report = CommentReport.builder()
                .club(club)
                .targetType(type)
                .targetId(commentId)
                .parentId(parentId)
                .reporter(reporter)
                .reason(reason)
                .contentSnapshot(content.length() > MAX_SNAPSHOT ? content.substring(0, MAX_SNAPSHOT) : content)
                .authorName(author.getName())
                .build();
        report = reportRepository.save(report);

        membershipRepository.findByClubIdAndPosition(club.getId(), MembershipPosition.PRESIDENT)
                .ifPresent(president -> notificationService.notify(president.getUser(),
                        "A comment in " + club.getName() + " was reported and needs your review."));

        return CommentReportResponse.from(report);
    }

    public List<CommentReportResponse> listOpenReports(UUID clubId, UserPrincipal principal) {
        requirePresident(clubId, principal);
        return reportRepository.findByClubIdAndStatusOrderByCreatedAtAsc(clubId, ReportStatus.OPEN)
                .stream().map(CommentReportResponse::from).toList();
    }

    public CommentReportResponse resolve(UUID clubId, UUID reportId, ResolveReportRequest request, UserPrincipal principal) {
        requirePresident(clubId, principal);

        String action = request == null || request.action() == null ? "" : request.action().trim().toUpperCase();
        if (!action.equals("DISMISS") && !action.equals("DELETE_COMMENT")) {
            throw ApiException.badRequest("Action must be DISMISS or DELETE_COMMENT");
        }

        CommentReport report = reportRepository.findById(reportId)
                .orElseThrow(() -> ApiException.notFound("Report not found"));
        if (!report.getClub().getId().equals(clubId)) {
            throw ApiException.notFound("Report not found");
        }
        if (report.getStatus() != ReportStatus.OPEN) {
            throw ApiException.badRequest("This report has already been handled");
        }

        User actor = userRepository.findById(principal.getId())
                .orElseThrow(() -> ApiException.notFound("User not found"));
        Instant now = Instant.now();

        if (action.equals("DISMISS")) {
            finish(report, ReportStatus.DISMISSED, actor, now);
            notificationService.notify(report.getReporter(),
                    "Your report in " + report.getClub().getName() + " was reviewed; the comment was left in place.");
            auditLogService.log(actor, "DISMISS_COMMENT_REPORT", "COMMENT_REPORT", report.getId(), clip(report.getContentSnapshot()));
            return CommentReportResponse.from(report);
        }

        // Removing the comment settles every open report about it, not just this one.
        deleteComment(report);
        for (CommentReport sibling : reportRepository.findByTargetTypeAndTargetIdAndStatus(
                report.getTargetType(), report.getTargetId(), ReportStatus.OPEN)) {
            finish(sibling, ReportStatus.ACTION_TAKEN, actor, now);
            notificationService.notify(sibling.getReporter(),
                    "Thanks — the comment you reported in " + report.getClub().getName() + " was removed.");
        }
        finish(report, ReportStatus.ACTION_TAKEN, actor, now);
        auditLogService.log(actor, "REMOVE_REPORTED_COMMENT", "COMMENT_REPORT", report.getId(),
                clip("By " + report.getAuthorName() + ": " + report.getContentSnapshot()));
        return CommentReportResponse.from(report);
    }

    private void deleteComment(CommentReport report) {
        if (report.getTargetType() == CommentTargetType.ANNOUNCEMENT_COMMENT) {
            announcementCommentRepository.findById(report.getTargetId()).ifPresent(announcementCommentRepository::delete);
        } else {
            eventCommentRepository.findById(report.getTargetId()).ifPresent(eventCommentRepository::delete);
        }
    }

    private void finish(CommentReport report, ReportStatus status, User actor, Instant when) {
        report.setStatus(status);
        report.setResolvedBy(actor);
        report.setResolvedAt(when);
        reportRepository.save(report);
    }

    private void requirePresident(UUID clubId, UserPrincipal principal) {
        boolean president = membershipRepository.findByUserIdAndClubId(principal.getId(), clubId)
                .filter(m -> m.getStatus() == MembershipStatus.APPROVED)
                .map(m -> m.getPosition() == MembershipPosition.PRESIDENT)
                .orElse(false);
        if (!president) {
            throw ApiException.forbidden("Only the Club Admin can review reported comments");
        }
    }

    private static String clip(String text) {
        return text.length() > 480 ? text.substring(0, 480) : text;
    }
}
