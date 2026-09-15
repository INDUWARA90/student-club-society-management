package com.club.backend.service;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.Optional;
import java.util.UUID;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import com.club.backend.config.ApiException;
import com.club.backend.entity.Attendance;
import com.club.backend.entity.AttendanceMethod;
import com.club.backend.entity.Club;
import com.club.backend.entity.Event;
import com.club.backend.entity.Membership;
import com.club.backend.entity.MembershipPosition;
import com.club.backend.entity.MembershipStatus;
import com.club.backend.entity.Role;
import com.club.backend.entity.User;
import com.club.backend.repository.AttendanceRepository;
import com.club.backend.repository.EventRepository;
import com.club.backend.repository.MembershipRepository;
import com.club.backend.repository.UserRepository;
import com.club.backend.security.UserPrincipal;

@ExtendWith(MockitoExtension.class)
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
    private CertificateService certificateService;

    @InjectMocks
    private AttendanceService attendanceService;

    private User officer;
    private User target;
    private Club club;
    private Event event;
    private UserPrincipal officerPrincipal;

    @BeforeEach
    void setUp() {
        officer = User.builder().id(UUID.randomUUID()).name("Officer").email("officer@example.com").role(Role.STUDENT).build();
        target = User.builder().id(UUID.randomUUID()).name("Target").email("target@example.com").role(Role.STUDENT).build();
        club = Club.builder().id(UUID.randomUUID()).name("Chess Club").build();
        event = Event.builder().id(UUID.randomUUID()).club(club).title("Tournament").build();
        officerPrincipal = new UserPrincipal(officer);
    }

    @Test
    void markManual_nonOfficer_throws() {
        when(eventRepository.findById(event.getId())).thenReturn(Optional.of(event));
        when(membershipRepository.findByUserIdAndClubId(officer.getId(), club.getId())).thenReturn(Optional.empty());

        assertThatThrownBy(() -> attendanceService.markManual(event.getId(), target.getId(), officerPrincipal))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("officers");
    }

    @Test
    void markManual_alreadyRecorded_throws() {
        Membership officerMembership = Membership.builder().position(MembershipPosition.PRESIDENT)
                .status(MembershipStatus.APPROVED).build();
        when(eventRepository.findById(event.getId())).thenReturn(Optional.of(event));
        when(membershipRepository.findByUserIdAndClubId(officer.getId(), club.getId()))
                .thenReturn(Optional.of(officerMembership));
        when(attendanceRepository.findByEventIdAndUserId(event.getId(), target.getId()))
                .thenReturn(Optional.of(Attendance.builder().build()));

        assertThatThrownBy(() -> attendanceService.markManual(event.getId(), target.getId(), officerPrincipal))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("already");
    }

    @Test
    void markManual_success_triggersCertificateCheck() {
        Membership officerMembership = Membership.builder().position(MembershipPosition.PRESIDENT)
                .status(MembershipStatus.APPROVED).build();
        when(eventRepository.findById(event.getId())).thenReturn(Optional.of(event));
        when(membershipRepository.findByUserIdAndClubId(officer.getId(), club.getId()))
                .thenReturn(Optional.of(officerMembership));
        when(attendanceRepository.findByEventIdAndUserId(event.getId(), target.getId())).thenReturn(Optional.empty());
        when(userRepository.findById(target.getId())).thenReturn(Optional.of(target));
        when(attendanceRepository.save(any(Attendance.class))).thenAnswer(inv -> inv.getArgument(0));

        attendanceService.markManual(event.getId(), target.getId(), officerPrincipal);

        verify(certificateService).checkAndIssueCertificate(target, club);
    }

    @Test
    void checkInViaQr_recordsQrAttendance() {
        UserPrincipal targetPrincipal = new UserPrincipal(target);
        when(eventRepository.findById(event.getId())).thenReturn(Optional.of(event));
        when(attendanceRepository.findByEventIdAndUserId(event.getId(), target.getId())).thenReturn(Optional.empty());
        when(userRepository.findById(target.getId())).thenReturn(Optional.of(target));
        when(attendanceRepository.save(any(Attendance.class))).thenAnswer(inv -> {
            Attendance a = inv.getArgument(0);
            return a;
        });

        var response = attendanceService.checkInViaQr(event.getId(), targetPrincipal);

        org.assertj.core.api.Assertions.assertThat(response.method()).isEqualTo(AttendanceMethod.QR);
    }
}
