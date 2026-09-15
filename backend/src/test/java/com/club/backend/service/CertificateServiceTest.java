package com.club.backend.service;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
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

import com.club.backend.entity.Certificate;
import com.club.backend.entity.Club;
import com.club.backend.entity.Role;
import com.club.backend.entity.User;
import com.club.backend.repository.AttendanceRepository;
import com.club.backend.repository.CertificateRepository;

@ExtendWith(MockitoExtension.class)
class CertificateServiceTest {

    @Mock
    private CertificateRepository certificateRepository;
    @Mock
    private AttendanceRepository attendanceRepository;

    @InjectMocks
    private CertificateService certificateService;

    private User user;
    private Club club;

    @BeforeEach
    void setUp() {
        user = User.builder().id(UUID.randomUUID()).name("Stu").email("stu@example.com").role(Role.STUDENT).build();
        club = Club.builder().id(UUID.randomUUID()).name("Chess Club").build();
    }

    @Test
    void checkAndIssueCertificate_belowThreshold_doesNotIssue() {
        when(certificateRepository.findByUserIdAndClubId(user.getId(), club.getId())).thenReturn(Optional.empty());
        when(attendanceRepository.countByUserIdAndEvent_Club_Id(user.getId(), club.getId())).thenReturn(2L);

        certificateService.checkAndIssueCertificate(user, club);

        verify(certificateRepository, never()).save(any(Certificate.class));
    }

    @Test
    void checkAndIssueCertificate_atThreshold_issuesCertificate() {
        when(certificateRepository.findByUserIdAndClubId(user.getId(), club.getId())).thenReturn(Optional.empty());
        when(attendanceRepository.countByUserIdAndEvent_Club_Id(user.getId(), club.getId())).thenReturn(3L);

        certificateService.checkAndIssueCertificate(user, club);

        verify(certificateRepository).save(any(Certificate.class));
    }

    @Test
    void checkAndIssueCertificate_alreadyIssued_doesNotIssueAgain() {
        when(certificateRepository.findByUserIdAndClubId(user.getId(), club.getId()))
                .thenReturn(Optional.of(Certificate.builder().build()));

        certificateService.checkAndIssueCertificate(user, club);

        verify(attendanceRepository, never()).countByUserIdAndEvent_Club_Id(any(), any());
        verify(certificateRepository, never()).save(any(Certificate.class));
    }
}
