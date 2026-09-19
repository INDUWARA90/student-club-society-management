package com.club.backend.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

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
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

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
@MockitoSettings(strictness = Strictness.LENIENT)
class CertificateServiceTest {

    @Mock
    private CertificateRepository certificateRepository;
    @Mock
    private AttendanceRepository attendanceRepository;
    @Mock
    private EventRepository eventRepository;
    @Mock
    private MembershipRepository membershipRepository;
    @Mock
    private NotificationService notificationService;

    @InjectMocks
    private CertificateService certificateService;

    private User user;
    private Club club;

    @BeforeEach
    void setUp() {
        user = User.builder().id(UUID.randomUUID()).name("Stu").email("stu@example.com").role(Role.STUDENT).build();
        club = Club.builder().id(UUID.randomUUID()).name("Chess Club").build();
    }

    private void asApprovedMember(User who) {
        when(membershipRepository.findByUserIdAndClubId(who.getId(), club.getId()))
                .thenReturn(Optional.of(Membership.builder().user(who).club(club)
                        .position(MembershipPosition.MEMBER).status(MembershipStatus.APPROVED).build()));
    }

    private void attended(User who, long count) {
        when(certificateRepository.findByUserIdAndClubId(who.getId(), club.getId())).thenReturn(Optional.empty());
        when(attendanceRepository.countByUserIdAndEvent_Club_Id(who.getId(), club.getId())).thenReturn(count);
    }

    @Test
    void checkAndIssueCertificate_belowThreshold_doesNotIssue() {
        asApprovedMember(user);
        attended(user, 2);

        assertThat(certificateService.checkAndIssueCertificate(user, club))
                .isEqualTo(CertificateService.IssuanceOutcome.NOT_YET_ELIGIBLE);

        verify(certificateRepository, never()).save(any(Certificate.class));
    }

    @Test
    void checkAndIssueCertificate_atDefaultThreshold_issuesWithVerificationCodeAndNotifies() {
        asApprovedMember(user);
        attended(user, 3);

        assertThat(certificateService.checkAndIssueCertificate(user, club))
                .isEqualTo(CertificateService.IssuanceOutcome.ISSUED);

        ArgumentCaptor<Certificate> saved = ArgumentCaptor.forClass(Certificate.class);
        verify(certificateRepository).save(saved.capture());
        assertThat(saved.getValue().getVerificationCode()).isNotBlank();
        verify(notificationService).notify(user, "You earned a certificate from Chess Club! Download it from your certificates page.");
    }

    @Test
    void checkAndIssueCertificate_usesTheClubsOwnThreshold() {
        club.setCertificateThreshold(5);
        asApprovedMember(user);
        attended(user, 4);
        assertThat(certificateService.checkAndIssueCertificate(user, club))
                .isEqualTo(CertificateService.IssuanceOutcome.NOT_YET_ELIGIBLE);

        attended(user, 5);
        assertThat(certificateService.checkAndIssueCertificate(user, club))
                .isEqualTo(CertificateService.IssuanceOutcome.ISSUED);
    }

    @Test
    void checkAndIssueCertificate_clubWithNoThreshold_fallsBackToDefault() {
        club.setCertificateThreshold(null);
        asApprovedMember(user);
        attended(user, 3);

        assertThat(certificateService.checkAndIssueCertificate(user, club))
                .isEqualTo(CertificateService.IssuanceOutcome.ISSUED);
    }

    @Test
    void checkAndIssueCertificate_nonMember_isNeverIssued() {
        when(membershipRepository.findByUserIdAndClubId(user.getId(), club.getId())).thenReturn(Optional.empty());
        attended(user, 10);

        assertThat(certificateService.checkAndIssueCertificate(user, club))
                .isEqualTo(CertificateService.IssuanceOutcome.NOT_YET_ELIGIBLE);
        verify(certificateRepository, never()).save(any(Certificate.class));
    }

    @Test
    void checkAndIssueCertificate_pendingMember_isNeverIssued() {
        when(membershipRepository.findByUserIdAndClubId(user.getId(), club.getId()))
                .thenReturn(Optional.of(Membership.builder().user(user).club(club).status(MembershipStatus.PENDING).build()));
        attended(user, 10);

        assertThat(certificateService.checkAndIssueCertificate(user, club))
                .isEqualTo(CertificateService.IssuanceOutcome.NOT_YET_ELIGIBLE);
    }

    @Test
    void checkAndIssueCertificate_alreadyIssued_doesNotIssueAgain() {
        when(certificateRepository.findByUserIdAndClubId(user.getId(), club.getId()))
                .thenReturn(Optional.of(Certificate.builder().build()));

        certificateService.checkAndIssueCertificate(user, club);

        verify(attendanceRepository, never()).countByUserIdAndEvent_Club_Id(any(), any());
        verify(certificateRepository, never()).save(any(Certificate.class));
    }

    @Test
    void bulkIssueForEvent_nonOfficer_throws() {
        Event event = Event.builder().id(UUID.randomUUID()).club(club).build();
        UserPrincipal principal = new UserPrincipal(user);
        when(membershipRepository.findByUserIdAndClubId(user.getId(), club.getId())).thenReturn(Optional.empty());

        assertThatThrownBy(() -> certificateService.bulkIssueForEvent(club.getId(), event.getId(), principal))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("officers");
    }

    @Test
    void bulkIssueForEvent_eventFromDifferentClub_notFound() {
        Club otherClub = Club.builder().id(UUID.randomUUID()).name("Other").build();
        Event event = Event.builder().id(UUID.randomUUID()).club(otherClub).build();
        UserPrincipal principal = new UserPrincipal(user);
        Membership officer = Membership.builder().position(MembershipPosition.PRESIDENT)
                .status(MembershipStatus.APPROVED).build();
        when(membershipRepository.findByUserIdAndClubId(user.getId(), club.getId())).thenReturn(Optional.of(officer));
        when(eventRepository.findById(event.getId())).thenReturn(Optional.of(event));

        assertThatThrownBy(() -> certificateService.bulkIssueForEvent(club.getId(), event.getId(), principal))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("not found");
    }

    @Test
    void bulkIssueForEvent_mixedOutcomes_tallyIsCorrect() {
        Event event = Event.builder().id(UUID.randomUUID()).club(club).build();
        UserPrincipal principal = new UserPrincipal(user);
        Membership officer = Membership.builder().position(MembershipPosition.PRESIDENT)
                .status(MembershipStatus.APPROVED).build();

        User newlyEligible = User.builder().id(UUID.randomUUID()).name("A").role(Role.STUDENT).build();
        User alreadyHasCert = User.builder().id(UUID.randomUUID()).name("B").role(Role.STUDENT).build();
        User notYetEligible = User.builder().id(UUID.randomUUID()).name("C").role(Role.STUDENT).build();

        when(membershipRepository.findByUserIdAndClubId(user.getId(), club.getId())).thenReturn(Optional.of(officer));
        when(eventRepository.findById(event.getId())).thenReturn(Optional.of(event));
        when(attendanceRepository.findByEventId(event.getId())).thenReturn(List.of(
                Attendance.builder().user(newlyEligible).build(),
                Attendance.builder().user(alreadyHasCert).build(),
                Attendance.builder().user(notYetEligible).build()));

        asApprovedMember(newlyEligible);
        attended(newlyEligible, 3);

        when(certificateRepository.findByUserIdAndClubId(alreadyHasCert.getId(), club.getId()))
                .thenReturn(Optional.of(Certificate.builder().build()));

        asApprovedMember(notYetEligible);
        attended(notYetEligible, 1);

        BulkCertificateIssueResponse response = certificateService.bulkIssueForEvent(club.getId(), event.getId(), principal);

        assertThat(response.consideredCount()).isEqualTo(3);
        assertThat(response.issuedCount()).isEqualTo(1);
        assertThat(response.alreadyIssuedCount()).isEqualTo(1);
        assertThat(response.notYetEligibleCount()).isEqualTo(1);
    }

    @Test
    void verify_knownCode_revealsOnlyNameClubAndDate() {
        Certificate certificate = Certificate.builder().user(user).club(club).verificationCode("abc-123").build();
        when(certificateRepository.findByVerificationCode("abc-123")).thenReturn(Optional.of(certificate));

        CertificateVerificationResponse response = certificateService.verify(" abc-123 ");

        assertThat(response.valid()).isTrue();
        assertThat(response.holderName()).isEqualTo("Stu");
        assertThat(response.clubName()).isEqualTo("Chess Club");
    }

    @Test
    void verify_unknownCode_isInvalid() {
        when(certificateRepository.findByVerificationCode("nope")).thenReturn(Optional.empty());

        CertificateVerificationResponse response = certificateService.verify("nope");

        assertThat(response.valid()).isFalse();
        assertThat(response.holderName()).isNull();
    }

    @Test
    void generatePdf_onlyForTheOwner() {
        Certificate certificate = Certificate.builder().id(UUID.randomUUID()).user(user).club(club).build();
        when(certificateRepository.findById(certificate.getId())).thenReturn(Optional.of(certificate));

        assertThatThrownBy(() -> certificateService.generateCertificatePdf(certificate.getId(), UUID.randomUUID()))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("your own");
    }

    @Test
    void generatePdf_legacyCertificateGetsACode_andNonLatinNamesDoNotBreakRendering() {
        User unicode = User.builder().id(UUID.randomUUID()).name("Ｓｔｕ 学生").email("u@example.com").role(Role.STUDENT).build();
        Certificate certificate = Certificate.builder().id(UUID.randomUUID()).user(unicode).club(club).build();
        when(certificateRepository.findById(certificate.getId())).thenReturn(Optional.of(certificate));

        byte[] pdf = certificateService.generateCertificatePdf(certificate.getId(), unicode.getId());

        assertThat(pdf).isNotEmpty();
        assertThat(certificate.getVerificationCode()).isNotBlank();
        verify(certificateRepository).save(certificate);
    }
}
