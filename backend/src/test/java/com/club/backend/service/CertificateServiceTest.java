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
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import com.club.backend.config.ApiException;
import com.club.backend.dto.BulkCertificateIssueResponse;
import com.club.backend.dto.CertificateVerificationResponse;
import com.club.backend.entity.Attendance;
import com.club.backend.entity.Certificate;
import com.club.backend.entity.Club;
import com.club.backend.entity.Event;
import com.club.backend.entity.Membership;
import com.club.backend.entity.MembershipPosition;
import com.club.backend.entity.MembershipStatus;
import com.club.backend.entity.Role;
import com.club.backend.entity.User;
import com.club.backend.repository.AttendanceRepository;
import com.club.backend.repository.CertificateRepository;
import com.club.backend.repository.EventRepository;
import com.club.backend.repository.MembershipRepository;
import com.club.backend.security.UserPrincipal;

@ExtendWith(MockitoExtension.class)
class CertificateServiceTest {

    @Mock private CertificateRepository certificateRepository;
    @Mock private AttendanceRepository attendanceRepository;
    @Mock private EventRepository eventRepository;
    @Mock private MembershipRepository membershipRepository;
    @Mock private NotificationService notificationService;
    @InjectMocks private CertificateService certificateService;

    private User attendee;
    private Club club;
    private Event event;

    @BeforeEach
    void setUp() {
        attendee = User.builder().id(UUID.randomUUID()).name("Stu").email("stu@example.com").role(Role.STUDENT).build();
        club = Club.builder().id(UUID.randomUUID()).name("Chess Club").category("Academic").build();
        event = Event.builder().id(UUID.randomUUID()).club(club).title("Interfaculty Chess Tournament")
                .eventDate(Instant.now().minusSeconds(60)).build();
    }

    @Test
    void recordedAttendee_receivesCertificateForThatEvent() {
        when(certificateRepository.findByUserIdAndEventId(attendee.getId(), event.getId())).thenReturn(Optional.empty());

        assertThat(certificateService.checkAndIssueCertificate(attendee, event))
                .isEqualTo(CertificateService.IssuanceOutcome.ISSUED);

        ArgumentCaptor<Certificate> saved = ArgumentCaptor.forClass(Certificate.class);
        verify(certificateRepository).save(saved.capture());
        assertThat(saved.getValue().getEvent()).isSameAs(event);
        assertThat(saved.getValue().getClub()).isSameAs(club);
        assertThat(saved.getValue().getVerificationCode()).isNotBlank();
        verify(notificationService).notify(attendee,
                "You earned a certificate for Interfaculty Chess Tournament! Download it from your certificates page.");
    }

    @Test
    void duplicateAttendanceCertificate_isNotIssuedTwice() {
        when(certificateRepository.findByUserIdAndEventId(attendee.getId(), event.getId()))
                .thenReturn(Optional.of(Certificate.builder().build()));

        assertThat(certificateService.checkAndIssueCertificate(attendee, event))
                .isEqualTo(CertificateService.IssuanceOutcome.ALREADY_ISSUED);
        verify(certificateRepository, never()).save(any());
    }

    @Test
    void bulkIssue_issuesForAllRecordedAttendees() {
        User officer = User.builder().id(UUID.randomUUID()).name("Officer").role(Role.STUDENT).build();
        Membership membership = Membership.builder().position(MembershipPosition.PRESIDENT)
                .status(MembershipStatus.APPROVED).build();
        User anotherAttendee = User.builder().id(UUID.randomUUID()).name("Alex").role(Role.STUDENT).build();
        when(membershipRepository.findByUserIdAndClubId(officer.getId(), club.getId())).thenReturn(Optional.of(membership));
        when(eventRepository.findById(event.getId())).thenReturn(Optional.of(event));
        when(attendanceRepository.findByEventId(event.getId())).thenReturn(List.of(
                Attendance.builder().user(attendee).build(), Attendance.builder().user(anotherAttendee).build()));
        when(certificateRepository.findByUserIdAndEventId(attendee.getId(), event.getId())).thenReturn(Optional.empty());
        when(certificateRepository.findByUserIdAndEventId(anotherAttendee.getId(), event.getId())).thenReturn(Optional.empty());

        BulkCertificateIssueResponse response = certificateService.bulkIssueForEvent(
                club.getId(), event.getId(), new UserPrincipal(officer));

        assertThat(response.consideredCount()).isEqualTo(2);
        assertThat(response.issuedCount()).isEqualTo(2);
        assertThat(response.alreadyIssuedCount()).isZero();
        assertThat(response.notYetEligibleCount()).isZero();
    }

    @Test
    void bulkIssue_requiresAnOfficer() {
        when(membershipRepository.findByUserIdAndClubId(attendee.getId(), club.getId())).thenReturn(Optional.empty());

        assertThatThrownBy(() -> certificateService.bulkIssueForEvent(
                club.getId(), event.getId(), new UserPrincipal(attendee)))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("officers");
    }

    @Test
    void verify_returnsTheCertificateHolderAndClub() {
        Certificate certificate = Certificate.builder().user(attendee).club(club).event(event)
                .verificationCode("event-cert-code").build();
        when(certificateRepository.findByVerificationCode("event-cert-code")).thenReturn(Optional.of(certificate));

        CertificateVerificationResponse result = certificateService.verify(" event-cert-code ");

        assertThat(result.valid()).isTrue();
        assertThat(result.holderName()).isEqualTo("Stu");
        assertThat(result.clubName()).isEqualTo("Chess Club");
    }
}
