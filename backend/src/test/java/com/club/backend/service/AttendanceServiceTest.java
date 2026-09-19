package com.club.backend.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

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
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import com.club.backend.config.ApiException;
import com.club.backend.dto.AttendanceResponse;
import com.club.backend.entity.Attendance;
import com.club.backend.entity.AttendanceMethod;
import com.club.backend.entity.Club;
import com.club.backend.entity.ClubStatus;
import com.club.backend.entity.Event;
import com.club.backend.entity.EventApprovalStatus;
import com.club.backend.entity.Membership;
import com.club.backend.entity.MembershipPosition;
import com.club.backend.entity.MembershipStatus;
import com.club.backend.entity.Role;
import com.club.backend.entity.Rsvp;
import com.club.backend.entity.RsvpStatus;
import com.club.backend.entity.User;
import com.club.backend.repository.AttendanceRepository;
import com.club.backend.repository.EventRepository;
import com.club.backend.repository.MembershipRepository;
import com.club.backend.repository.RsvpRepository;
import com.club.backend.repository.UserRepository;
import com.club.backend.security.UserPrincipal;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class AttendanceServiceTest {

    @Mock
    private AttendanceRepository attendanceRepository;
    @Mock
    private EventRepository eventRepository;
    @Mock
    private MembershipRepository membershipRepository;
    @Mock
    private UserRepository userRepository;
    @Mock
    private RsvpRepository rsvpRepository;
    @Mock
    private CertificateService certificateService;
    @Mock
    private CheckInTokenService checkInTokenService;

    @InjectMocks
    private AttendanceService attendanceService;

    private User officer;
    private User target;
    private Club club;
    private Event event;
    private UserPrincipal officerPrincipal;
    private UserPrincipal targetPrincipal;

    @BeforeEach
    void setUp() {
        officer = User.builder().id(UUID.randomUUID()).name("Officer").email("officer@example.com").role(Role.STUDENT).build();
        target = User.builder().id(UUID.randomUUID()).name("Target").email("target@example.com").role(Role.STUDENT).build();
        club = Club.builder().id(UUID.randomUUID()).name("Chess Club").status(ClubStatus.APPROVED).build();
        event = Event.builder().id(UUID.randomUUID()).club(club).title("Tournament")
                .approvalStatus(EventApprovalStatus.NOT_REQUIRED)
                .eventDate(Instant.now().minusSeconds(3600)).build();
        officerPrincipal = new UserPrincipal(officer);
        targetPrincipal = new UserPrincipal(target);

        when(eventRepository.findById(event.getId())).thenReturn(Optional.of(event));
        when(userRepository.findById(officer.getId())).thenReturn(Optional.of(officer));
        when(userRepository.findById(target.getId())).thenReturn(Optional.of(target));
        when(attendanceRepository.findByEventIdAndUserId(event.getId(), target.getId())).thenReturn(Optional.empty());
        when(attendanceRepository.save(any(Attendance.class))).thenAnswer(inv -> inv.getArgument(0));
        when(checkInTokenService.isValid(event.getId(), "good")).thenReturn(true);
    }

    private void asOfficer() {
        when(membershipRepository.findByUserIdAndClubId(officer.getId(), club.getId()))
                .thenReturn(Optional.of(Membership.builder().position(MembershipPosition.PRESIDENT)
                        .status(MembershipStatus.APPROVED).build()));
    }

    // ---- manual marking

    @Test
    void markManual_nonOfficer_throws() {
        when(membershipRepository.findByUserIdAndClubId(officer.getId(), club.getId())).thenReturn(Optional.empty());

        assertThatThrownBy(() -> attendanceService.markManual(event.getId(), target.getId(), officerPrincipal))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("officers");
    }

    @Test
    void markManual_alreadyRecorded_throws() {
        asOfficer();
        when(attendanceRepository.findByEventIdAndUserId(event.getId(), target.getId()))
                .thenReturn(Optional.of(Attendance.builder().build()));

        assertThatThrownBy(() -> attendanceService.markManual(event.getId(), target.getId(), officerPrincipal))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("already");
    }

    @Test
    void markManual_success_triggersCertificateCheck() {
        asOfficer();

        attendanceService.markManual(event.getId(), target.getId(), officerPrincipal);

        verify(certificateService).checkAndIssueCertificate(target, club);
    }

    @Test
    void markManual_cancelledEvent_throws() {
        asOfficer();
        event.setCancelled(true);

        assertThatThrownBy(() -> attendanceService.markManual(event.getId(), target.getId(), officerPrincipal))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("cancelled");
    }

    @Test
    void markManual_beforeEventStarts_throws() {
        asOfficer();
        event.setEventDate(Instant.now().plusSeconds(3600));

        assertThatThrownBy(() -> attendanceService.markManual(event.getId(), target.getId(), officerPrincipal))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("before the event starts");
    }

    // ---- QR check-in

    @Test
    void checkInViaQr_validToken_recordsQrAttendance() {
        AttendanceResponse response = attendanceService.checkInViaQr(event.getId(), "good", targetPrincipal);

        assertThat(response.method()).isEqualTo(AttendanceMethod.QR);
    }

    @Test
    void checkInViaQr_missingOrWrongToken_isRejected() {
        assertThatThrownBy(() -> attendanceService.checkInViaQr(event.getId(), null, targetPrincipal))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("invalid or has expired");
        assertThatThrownBy(() -> attendanceService.checkInViaQr(event.getId(), "guessed", targetPrincipal))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("invalid or has expired");
        verify(attendanceRepository, never()).save(any());
    }

    @Test
    void checkInViaQr_afterEventEnded_isRejected() {
        event.setEndDate(Instant.now().minusSeconds(60));

        assertThatThrownBy(() -> attendanceService.checkInViaQr(event.getId(), "good", targetPrincipal))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("closed");
    }

    @Test
    void checkInViaQr_withoutEndDate_staysOpenForSixHours() {
        event.setEventDate(Instant.now().minusSeconds(7 * 3600));

        assertThatThrownBy(() -> attendanceService.checkInViaQr(event.getId(), "good", targetPrincipal))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("closed");
    }

    @Test
    void checkInViaQr_capacityLimitedEvent_needsConfirmedRsvp() {
        event.setCapacity(30);
        when(rsvpRepository.findByEventIdAndUserId(event.getId(), target.getId())).thenReturn(Optional.empty());

        assertThatThrownBy(() -> attendanceService.checkInViaQr(event.getId(), "good", targetPrincipal))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("RSVP-only");

        // A waitlisted RSVP isn't enough either.
        when(rsvpRepository.findByEventIdAndUserId(event.getId(), target.getId()))
                .thenReturn(Optional.of(Rsvp.builder().status(RsvpStatus.WAITLISTED).build()));
        assertThatThrownBy(() -> attendanceService.checkInViaQr(event.getId(), "good", targetPrincipal))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("RSVP-only");
    }

    @Test
    void checkInViaQr_capacityLimitedEvent_withGoingRsvp_succeeds() {
        event.setCapacity(30);
        when(rsvpRepository.findByEventIdAndUserId(event.getId(), target.getId()))
                .thenReturn(Optional.of(Rsvp.builder().status(RsvpStatus.GOING).build()));

        assertThat(attendanceService.checkInViaQr(event.getId(), "good", targetPrincipal).method())
                .isEqualTo(AttendanceMethod.QR);
    }

    @Test
    void checkInViaQr_openEvent_allowsWalkIns() {
        // No capacity limit and no RSVP: walk-ins are fine.
        assertThat(attendanceService.checkInViaQr(event.getId(), "good", targetPrincipal).method())
                .isEqualTo(AttendanceMethod.QR);
    }

    // ---- who can see the attendance list

    @Test
    void listAttendance_officerSeesEveryone() {
        asOfficer();
        when(attendanceRepository.findByEventId(event.getId())).thenReturn(List.of(
                Attendance.builder().event(event).user(target).method(AttendanceMethod.QR).build(),
                Attendance.builder().event(event).user(officer).method(AttendanceMethod.MANUAL).build()));

        assertThat(attendanceService.listAttendance(event.getId(), officerPrincipal)).hasSize(2);
    }

    @Test
    void listAttendance_studentSeesOnlyTheirOwnCheckIn() {
        when(membershipRepository.findByUserIdAndClubId(target.getId(), club.getId())).thenReturn(Optional.empty());
        when(attendanceRepository.findByEventIdAndUserId(event.getId(), target.getId()))
                .thenReturn(Optional.of(Attendance.builder().event(event).user(target).method(AttendanceMethod.QR).build()));

        List<AttendanceResponse> visible = attendanceService.listAttendance(event.getId(), targetPrincipal);

        assertThat(visible).hasSize(1);
        verify(attendanceRepository, never()).findByEventId(event.getId());
    }

    @Test
    void listAttendance_advisorSeesEveryone() {
        User advisor = User.builder().id(UUID.randomUUID()).name("FA").email("fa@example.com").role(Role.FACULTY_ADVISOR).build();
        when(userRepository.findById(advisor.getId())).thenReturn(Optional.of(advisor));
        when(attendanceRepository.findByEventId(event.getId())).thenReturn(List.of(
                Attendance.builder().event(event).user(target).method(AttendanceMethod.QR).build()));

        assertThat(attendanceService.listAttendance(event.getId(), new UserPrincipal(advisor))).hasSize(1);
    }
}
