package com.club.backend.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.when;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import com.club.backend.config.ApiException;
import com.club.backend.dto.ClubLedgerResponse;
import com.club.backend.dto.ClubStatsResponse;
import com.club.backend.entity.Club;
import com.club.backend.entity.ClubStatus;
import com.club.backend.entity.Event;
import com.club.backend.entity.EventApprovalStatus;
import com.club.backend.entity.Membership;
import com.club.backend.entity.MembershipPosition;
import com.club.backend.entity.MembershipStatus;
import com.club.backend.entity.Role;
import com.club.backend.entity.RsvpStatus;
import com.club.backend.entity.User;
import com.club.backend.repository.AttendanceRepository;
import com.club.backend.repository.ClubRepository;
import com.club.backend.repository.EventFeedbackRepository;
import com.club.backend.repository.EventRepository;
import com.club.backend.repository.MembershipRepository;
import com.club.backend.repository.PaymentRepository;
import com.club.backend.repository.RsvpRepository;
import com.club.backend.repository.UserRepository;
import com.club.backend.security.UserPrincipal;

@ExtendWith(MockitoExtension.class)
class AnalyticsServiceTest {

    @Mock
    private MembershipRepository membershipRepository;
    @Mock
    private EventRepository eventRepository;
    @Mock
    private RsvpRepository rsvpRepository;
    @Mock
    private AttendanceRepository attendanceRepository;
    @Mock
    private ClubRepository clubRepository;
    @Mock
    private UserRepository userRepository;
    @Mock
    private PaymentRepository paymentRepository;
    @Mock
    private ClubExpenseService clubExpenseService;
    @Mock
    private EventFeedbackRepository feedbackRepository;

    @InjectMocks
    private AnalyticsService analyticsService;

    private User member;
    private UUID clubId;

    @BeforeEach
    void setUp() {
        member = User.builder().id(UUID.randomUUID()).name("Mem").email("mem@example.com").role(Role.STUDENT).build();
        clubId = UUID.randomUUID();
    }

    @Test
    void getClubStats_regularMember_financialFieldsZeroed() {
        UserPrincipal principal = new UserPrincipal(member);
        Membership memberMembership = Membership.builder().position(MembershipPosition.MEMBER)
                .status(MembershipStatus.APPROVED).build();
        when(userRepository.findById(member.getId())).thenReturn(Optional.of(member));
        when(membershipRepository.findByUserIdAndClubId(member.getId(), clubId)).thenReturn(Optional.of(memberMembership));
        when(membershipRepository.findByClubIdAndStatus(clubId, MembershipStatus.APPROVED)).thenReturn(List.of());
        when(eventRepository.findByClubId(clubId)).thenReturn(List.of());

        ClubStatsResponse stats = analyticsService.getClubStats(clubId, principal);

        assertThat(stats.totalIncome()).isEqualByComparingTo(BigDecimal.ZERO);
        assertThat(stats.totalExpenses()).isEqualByComparingTo(BigDecimal.ZERO);
        assertThat(stats.balance()).isEqualByComparingTo(BigDecimal.ZERO);
    }

    @Test
    void getClubStats_officer_financialFieldsPopulated() {
        UserPrincipal principal = new UserPrincipal(member);
        Membership presidentMembership = Membership.builder().position(MembershipPosition.PRESIDENT)
                .status(MembershipStatus.APPROVED).build();
        when(userRepository.findById(member.getId())).thenReturn(Optional.of(member));
        when(membershipRepository.findByUserIdAndClubId(member.getId(), clubId)).thenReturn(Optional.of(presidentMembership));
        when(membershipRepository.findByClubIdAndStatus(clubId, MembershipStatus.APPROVED)).thenReturn(List.of());
        when(eventRepository.findByClubId(clubId)).thenReturn(List.of());
        when(clubExpenseService.computeLedger(clubId)).thenReturn(
                new ClubLedgerResponse(new BigDecimal("100"), new BigDecimal("40"), new BigDecimal("60"), List.of()));

        ClubStatsResponse stats = analyticsService.getClubStats(clubId, principal);

        assertThat(stats.totalIncome()).isEqualByComparingTo(new BigDecimal("100"));
        assertThat(stats.totalExpenses()).isEqualByComparingTo(new BigDecimal("40"));
        assertThat(stats.balance()).isEqualByComparingTo(new BigDecimal("60"));
    }

    @Test
    void getClubStats_superAdmin_financialFieldsPopulatedWithoutMembership() {
        User superAdmin = User.builder().id(UUID.randomUUID()).name("Admin").email("admin@example.com").role(Role.SUPER_ADMIN).build();
        UserPrincipal principal = new UserPrincipal(superAdmin);
        when(userRepository.findById(superAdmin.getId())).thenReturn(Optional.of(superAdmin));
        when(membershipRepository.findByClubIdAndStatus(clubId, MembershipStatus.APPROVED)).thenReturn(List.of());
        when(eventRepository.findByClubId(clubId)).thenReturn(List.of());
        when(clubExpenseService.computeLedger(clubId)).thenReturn(
                new ClubLedgerResponse(new BigDecimal("50"), BigDecimal.ZERO, new BigDecimal("50"), List.of()));

        ClubStatsResponse stats = analyticsService.getClubStats(clubId, principal);

        assertThat(stats.totalIncome()).isEqualByComparingTo(new BigDecimal("50"));
    }

    private Club stubClubWithOneHeldAndOneUpcomingEvent(User viewer, MembershipPosition viewerPosition) {
        Club club = Club.builder().id(clubId).name("Chess, Club").category("Games").status(ClubStatus.APPROVED).build();
        Event held = Event.builder().id(UUID.randomUUID()).club(club).title("Opening Night")
                .eventDate(Instant.now().minusSeconds(86400)).approvalStatus(EventApprovalStatus.NOT_REQUIRED).build();
        Event upcoming = Event.builder().id(UUID.randomUUID()).club(club).title("Blitz Cup")
                .eventDate(Instant.now().plusSeconds(86400)).approvalStatus(EventApprovalStatus.NOT_REQUIRED).build();
        Membership viewerMembership = Membership.builder().user(viewer).club(club).position(viewerPosition)
                .status(MembershipStatus.APPROVED).joinedAt(Instant.parse("2026-01-01T00:00:00Z")).build();

        when(clubRepository.findById(clubId)).thenReturn(Optional.of(club));
        when(userRepository.findById(viewer.getId())).thenReturn(Optional.of(viewer));
        when(membershipRepository.findByUserIdAndClubId(viewer.getId(), clubId)).thenReturn(Optional.of(viewerMembership));
        when(membershipRepository.findByClubIdAndStatus(clubId, MembershipStatus.APPROVED)).thenReturn(List.of(viewerMembership));
        when(eventRepository.findByClubId(clubId)).thenReturn(List.of(upcoming, held));
        when(rsvpRepository.countByEventIdAndStatus(held.getId(), RsvpStatus.GOING)).thenReturn(10L);
        when(rsvpRepository.countByEventIdAndStatus(upcoming.getId(), RsvpStatus.GOING)).thenReturn(4L);
        when(attendanceRepository.countByEventId(held.getId())).thenReturn(7L);
        when(feedbackRepository.findByEventId(held.getId())).thenReturn(List.of());
        return club;
    }

    @Test
    void clubCsv_hasSummaryClubInfoActivitiesAndMembersForOfficers() {
        Club club = stubClubWithOneHeldAndOneUpcomingEvent(member, MembershipPosition.PRESIDENT);
        when(clubExpenseService.computeLedger(clubId)).thenReturn(
                new ClubLedgerResponse(BigDecimal.TEN, BigDecimal.ONE, new BigDecimal("9"), List.of()));

        String csv = analyticsService.getClubStatsCsv(clubId, new UserPrincipal(member));

        assertThat(csv).startsWith("Metric,Value\nMembers,1\nEvents,2\n");
        assertThat(csv).contains("\nClub information\nField,Value\n");
        assertThat(csv).contains("Name,\"Chess, Club\"\n");
        assertThat(csv).contains("\nActivities and participation\nEvent,Date,Status,Going,Attended,No-shows,Avg rating\n");
        assertThat(csv).contains("Opening Night,").contains(",Held,10,7,3,\n");
        assertThat(csv).contains("Blitz Cup,").contains(",Upcoming,4,,,\n");
        assertThat(csv).contains("\nMembers\nName,Position,Joined\nMem,PRESIDENT,2026-01-01T00:00:00Z\n");
        assertThat(club.getName()).isEqualTo("Chess, Club");
    }

    @Test
    void clubCsv_regularMemberDoesNotGetTheMemberList() {
        stubClubWithOneHeldAndOneUpcomingEvent(member, MembershipPosition.MEMBER);

        String csv = analyticsService.getClubStatsCsv(clubId, new UserPrincipal(member));

        assertThat(csv).contains("Activities and participation");
        assertThat(csv).doesNotContain("Name,Position,Joined");
    }

    @Test
    void clubCsv_unknownClub_isNotFound() {
        when(clubRepository.findById(clubId)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> analyticsService.getClubStatsCsv(clubId, new UserPrincipal(member)))
                .isInstanceOf(ApiException.class).hasMessageContaining("Club not found");
    }

    @Test
    void clubPdf_isAValidPdfEvenWithNonLatinNamesAndManyRows() {
        Club club = stubClubWithOneHeldAndOneUpcomingEvent(member, MembershipPosition.PRESIDENT);
        club.setName("ක්‍රීඩා සංගමය – Chess");
        when(clubExpenseService.computeLedger(clubId)).thenReturn(
                new ClubLedgerResponse(BigDecimal.TEN, BigDecimal.ONE, new BigDecimal("9"), List.of()));
        // 80 more members forces the report onto a second page
        List<Membership> many = new java.util.ArrayList<>();
        for (int i = 0; i < 80; i++) {
            User u = User.builder().id(UUID.randomUUID()).name("Member " + i + " ශිෂ්‍ය").email("m" + i + "@example.com").build();
            many.add(Membership.builder().user(u).club(club).position(MembershipPosition.MEMBER)
                    .status(MembershipStatus.APPROVED).joinedAt(Instant.now()).build());
        }
        when(membershipRepository.findByClubIdAndStatus(clubId, MembershipStatus.APPROVED)).thenReturn(many);

        byte[] pdf = analyticsService.getClubStatsPdf(clubId, new UserPrincipal(member));

        assertThat(new String(pdf, 0, 5, java.nio.charset.StandardCharsets.ISO_8859_1)).isEqualTo("%PDF-");
        try (var doc = org.apache.pdfbox.Loader.loadPDF(pdf)) {
            assertThat(doc.getNumberOfPages()).isGreaterThan(1);
        } catch (java.io.IOException e) {
            throw new AssertionError(e);
        }
    }

    @Test
    void universityCsv_listsEachApprovedClubWithItsCounts() {
        Club chess = Club.builder().id(clubId).name("Chess").category("Games").status(ClubStatus.APPROVED).build();
        Club archived = Club.builder().id(UUID.randomUUID()).name("Old").status(ClubStatus.APPROVED).archived(true).build();
        when(clubRepository.countByStatusAndArchivedFalse(ClubStatus.APPROVED)).thenReturn(1L);
        when(userRepository.countByRole(Role.STUDENT)).thenReturn(5L);
        when(paymentRepository.sumLiveAmount()).thenReturn(BigDecimal.ZERO);
        when(clubRepository.findByStatus(ClubStatus.APPROVED)).thenReturn(List.of(chess, archived));
        when(clubRepository.findByStatus(ClubStatus.PENDING)).thenReturn(List.of());
        when(membershipRepository.findByClubIdAndStatus(clubId, MembershipStatus.APPROVED))
                .thenReturn(List.of(Membership.builder().build(), Membership.builder().build()));
        when(eventRepository.findByClubId(clubId)).thenReturn(List.of(Event.builder().build()));

        String csv = analyticsService.getUniversityStatsCsv();

        assertThat(csv).startsWith("Metric,Value\nApproved Clubs,1\nStudents,5\n");
        assertThat(csv).contains("\nClubs\nClub,Category,Members,Events\nChess,Games,2,1\n");
        assertThat(csv).doesNotContain("Old");
    }

    @Test
    void universityPdf_isAValidPdf() {
        when(clubRepository.findByStatus(ClubStatus.APPROVED)).thenReturn(List.of());
        when(clubRepository.findByStatus(ClubStatus.PENDING)).thenReturn(List.of());
        when(paymentRepository.sumLiveAmount()).thenReturn(BigDecimal.ZERO);

        byte[] pdf = analyticsService.getUniversityStatsPdf();

        assertThat(new String(pdf, 0, 5, java.nio.charset.StandardCharsets.ISO_8859_1)).isEqualTo("%PDF-");
    }
}
