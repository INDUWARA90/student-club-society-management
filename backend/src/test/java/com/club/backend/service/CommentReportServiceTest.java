package com.club.backend.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import com.club.backend.config.ApiException;
import com.club.backend.dto.CommentReportResponse;
import com.club.backend.dto.ReportCommentRequest;
import com.club.backend.dto.ResolveReportRequest;
import com.club.backend.entity.AnnouncementComment;
import com.club.backend.entity.Club;
import com.club.backend.entity.ClubAnnouncement;
import com.club.backend.entity.CommentReport;
import com.club.backend.entity.CommentTargetType;
import com.club.backend.entity.Event;
import com.club.backend.entity.EventComment;
import com.club.backend.entity.Membership;
import com.club.backend.entity.MembershipPosition;
import com.club.backend.entity.MembershipStatus;
import com.club.backend.entity.ReportStatus;
import com.club.backend.entity.Role;
import com.club.backend.entity.User;
import com.club.backend.repository.AnnouncementCommentRepository;
import com.club.backend.repository.CommentReportRepository;
import com.club.backend.repository.EventCommentRepository;
import com.club.backend.repository.MembershipRepository;
import com.club.backend.repository.UserRepository;
import com.club.backend.security.UserPrincipal;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class CommentReportServiceTest {

    @Mock
    private CommentReportRepository reportRepository;
    @Mock
    private AnnouncementCommentRepository announcementCommentRepository;
    @Mock
    private EventCommentRepository eventCommentRepository;
    @Mock
    private MembershipRepository membershipRepository;
    @Mock
    private UserRepository userRepository;
    @Mock
    private NotificationService notificationService;
    @Mock
    private AuditLogService auditLogService;

    @InjectMocks
    private CommentReportService service;

    private User president;
    private User reporter;
    private User author;
    private Club club;
    private ClubAnnouncement announcement;
    private AnnouncementComment comment;

    @BeforeEach
    void setUp() {
        president = user("Pres");
        reporter = user("Reporter");
        author = user("Author");
        club = Club.builder().id(UUID.randomUUID()).name("Chess Club").build();
        announcement = ClubAnnouncement.builder().id(UUID.randomUUID()).club(club).author(president).content("Hello").build();
        comment = AnnouncementComment.builder().id(UUID.randomUUID()).announcement(announcement).author(author)
                .content("You are all idiots").build();

        when(announcementCommentRepository.findById(comment.getId())).thenReturn(Optional.of(comment));
        when(userRepository.findById(reporter.getId())).thenReturn(Optional.of(reporter));
        when(userRepository.findById(president.getId())).thenReturn(Optional.of(president));
        when(reportRepository.save(any(CommentReport.class))).thenAnswer(inv -> inv.getArgument(0));
        when(membershipRepository.findByUserIdAndClubId(reporter.getId(), club.getId()))
                .thenReturn(Optional.of(membership(reporter, MembershipPosition.MEMBER)));
        when(membershipRepository.findByUserIdAndClubId(president.getId(), club.getId()))
                .thenReturn(Optional.of(membership(president, MembershipPosition.PRESIDENT)));
        when(membershipRepository.findByClubIdAndPosition(club.getId(), MembershipPosition.PRESIDENT))
                .thenReturn(Optional.of(membership(president, MembershipPosition.PRESIDENT)));
    }

    private User user(String name) {
        return User.builder().id(UUID.randomUUID()).name(name).email(name.toLowerCase() + "@example.com").role(Role.STUDENT).build();
    }

    private Membership membership(User who, MembershipPosition position) {
        return Membership.builder().id(UUID.randomUUID()).user(who).club(club).position(position)
                .status(MembershipStatus.APPROVED).build();
    }

    private CommentReport openReport() {
        return CommentReport.builder().id(UUID.randomUUID()).club(club).targetType(CommentTargetType.ANNOUNCEMENT_COMMENT)
                .targetId(comment.getId()).parentId(announcement.getId()).reporter(reporter).reason("abusive")
                .contentSnapshot(comment.getContent()).authorName("Author").build();
    }

    private CommentReportResponse report(String reason) {
        return service.reportAnnouncementComment(club.getId(), announcement.getId(), comment.getId(),
                new ReportCommentRequest(reason), new UserPrincipal(reporter));
    }

    // ---- reporting

    @Test
    void report_createsAnOpenReportWithASnapshot_andNotifiesThePresident() {
        CommentReportResponse response = report("  abusive language  ");

        assertThat(response.status()).isEqualTo(ReportStatus.OPEN);
        assertThat(response.reason()).isEqualTo("abusive language");
        assertThat(response.commentContent()).isEqualTo("You are all idiots");
        assertThat(response.commentAuthorName()).isEqualTo("Author");
        verify(notificationService).notify(president, "A comment in Chess Club was reported and needs your review.");
    }

    @Test
    void report_needsAReason() {
        assertThatThrownBy(() -> report("  ")).isInstanceOf(ApiException.class).hasMessageContaining("why");
        assertThatThrownBy(() -> service.reportAnnouncementComment(club.getId(), announcement.getId(), comment.getId(),
                null, new UserPrincipal(reporter))).isInstanceOf(ApiException.class);
        assertThatThrownBy(() -> report("x".repeat(501))).isInstanceOf(ApiException.class).hasMessageContaining("500");
        verify(reportRepository, never()).save(any());
    }

    @Test
    void report_onlyByClubMembers() {
        when(membershipRepository.findByUserIdAndClubId(reporter.getId(), club.getId())).thenReturn(Optional.empty());

        assertThatThrownBy(() -> report("abusive")).isInstanceOf(ApiException.class).hasMessageContaining("Only club members");
    }

    @Test
    void report_pendingMemberCannotReport() {
        Membership pending = membership(reporter, MembershipPosition.MEMBER);
        pending.setStatus(MembershipStatus.PENDING);
        when(membershipRepository.findByUserIdAndClubId(reporter.getId(), club.getId())).thenReturn(Optional.of(pending));

        assertThatThrownBy(() -> report("abusive")).isInstanceOf(ApiException.class).hasMessageContaining("Only club members");
    }

    @Test
    void report_ownCommentIsRefused() {
        comment.setAuthor(reporter);

        assertThatThrownBy(() -> report("abusive")).isInstanceOf(ApiException.class).hasMessageContaining("your own");
    }

    @Test
    void report_twiceIsAConflict() {
        when(reportRepository.findByReporterIdAndTargetTypeAndTargetId(
                reporter.getId(), CommentTargetType.ANNOUNCEMENT_COMMENT, comment.getId()))
                .thenReturn(Optional.of(openReport()));

        assertThatThrownBy(() -> report("abusive")).isInstanceOf(ApiException.class).hasMessageContaining("already reported");
    }

    @Test
    void report_commentFromAnotherClubOrAnnouncement_isNotFound() {
        assertThatThrownBy(() -> service.reportAnnouncementComment(UUID.randomUUID(), announcement.getId(), comment.getId(),
                new ReportCommentRequest("x"), new UserPrincipal(reporter)))
                .isInstanceOf(ApiException.class).hasMessageContaining("not found");
        assertThatThrownBy(() -> service.reportAnnouncementComment(club.getId(), UUID.randomUUID(), comment.getId(),
                new ReportCommentRequest("x"), new UserPrincipal(reporter)))
                .isInstanceOf(ApiException.class).hasMessageContaining("not found");
    }

    @Test
    void report_eventComment_usesTheEventsClub() {
        Event event = Event.builder().id(UUID.randomUUID()).club(club).title("Night").build();
        EventComment eventComment = EventComment.builder().id(UUID.randomUUID()).event(event).author(author).content("spam").build();
        when(eventCommentRepository.findById(eventComment.getId())).thenReturn(Optional.of(eventComment));

        CommentReportResponse response = service.reportEventComment(event.getId(), eventComment.getId(),
                new ReportCommentRequest("spam"), new UserPrincipal(reporter));

        assertThat(response.targetType()).isEqualTo(CommentTargetType.EVENT_COMMENT);
        assertThat(response.parentId()).isEqualTo(event.getId());
    }

    // ---- reviewing

    @Test
    void listOpenReports_presidentOnly() {
        when(reportRepository.findByClubIdAndStatusOrderByCreatedAtAsc(club.getId(), ReportStatus.OPEN))
                .thenReturn(List.of(openReport()));

        assertThat(service.listOpenReports(club.getId(), new UserPrincipal(president))).hasSize(1);
        assertThatThrownBy(() -> service.listOpenReports(club.getId(), new UserPrincipal(reporter)))
                .isInstanceOf(ApiException.class).hasMessageContaining("Club Admin");
    }

    @Test
    void resolve_dismiss_leavesTheCommentAndTellsTheReporter() {
        CommentReport report = openReport();
        when(reportRepository.findById(report.getId())).thenReturn(Optional.of(report));

        CommentReportResponse response = service.resolve(club.getId(), report.getId(),
                new ResolveReportRequest("dismiss"), new UserPrincipal(president));

        assertThat(response.status()).isEqualTo(ReportStatus.DISMISSED);
        assertThat(report.getResolvedBy()).isEqualTo(president);
        verify(announcementCommentRepository, never()).delete(any());
        verify(notificationService).notify(eq(reporter), anyString());
        verify(auditLogService).log(eq(president), eq("DISMISS_COMMENT_REPORT"), anyString(), eq(report.getId()), anyString());
    }

    @Test
    void resolve_deleteComment_removesItAndClosesEveryOpenReportAboutIt() {
        CommentReport report = openReport();
        User otherReporter = user("Other");
        CommentReport sibling = openReport();
        sibling.setReporter(otherReporter);
        when(reportRepository.findById(report.getId())).thenReturn(Optional.of(report));
        when(reportRepository.findByTargetTypeAndTargetIdAndStatus(
                CommentTargetType.ANNOUNCEMENT_COMMENT, comment.getId(), ReportStatus.OPEN))
                .thenReturn(List.of(report, sibling));

        CommentReportResponse response = service.resolve(club.getId(), report.getId(),
                new ResolveReportRequest("DELETE_COMMENT"), new UserPrincipal(president));

        assertThat(response.status()).isEqualTo(ReportStatus.ACTION_TAKEN);
        assertThat(sibling.getStatus()).isEqualTo(ReportStatus.ACTION_TAKEN);
        verify(announcementCommentRepository).delete(comment);
        verify(notificationService).notify(eq(otherReporter), anyString());
        verify(auditLogService).log(eq(president), eq("REMOVE_REPORTED_COMMENT"), anyString(), eq(report.getId()), anyString());
    }

    @Test
    void resolve_rejectsBadActionsAndRepeatsAndOtherClubs() {
        CommentReport report = openReport();
        when(reportRepository.findById(report.getId())).thenReturn(Optional.of(report));
        UserPrincipal admin = new UserPrincipal(president);

        assertThatThrownBy(() -> service.resolve(club.getId(), report.getId(), new ResolveReportRequest("BAN"), admin))
                .isInstanceOf(ApiException.class).hasMessageContaining("DISMISS or DELETE_COMMENT");
        assertThatThrownBy(() -> service.resolve(club.getId(), report.getId(), null, admin))
                .isInstanceOf(ApiException.class);

        report.setStatus(ReportStatus.DISMISSED);
        assertThatThrownBy(() -> service.resolve(club.getId(), report.getId(), new ResolveReportRequest("DISMISS"), admin))
                .isInstanceOf(ApiException.class).hasMessageContaining("already been handled");

        report.setStatus(ReportStatus.OPEN);
        Club other = Club.builder().id(UUID.randomUUID()).name("Other").build();
        report.setClub(other);
        assertThatThrownBy(() -> service.resolve(club.getId(), report.getId(), new ResolveReportRequest("DISMISS"), admin))
                .isInstanceOf(ApiException.class).hasMessageContaining("not found");
    }

    @Test
    void resolve_byNonPresident_isForbidden() {
        CommentReport report = openReport();
        when(reportRepository.findById(report.getId())).thenReturn(Optional.of(report));

        assertThatThrownBy(() -> service.resolve(club.getId(), report.getId(), new ResolveReportRequest("DISMISS"),
                new UserPrincipal(reporter)))
                .isInstanceOf(ApiException.class).hasMessageContaining("Club Admin");
    }
}
