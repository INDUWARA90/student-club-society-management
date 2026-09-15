package com.club.backend.service;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.times;
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

import com.club.backend.config.ApiException;
import com.club.backend.dto.CreateAnnouncementRequest;
import com.club.backend.entity.Club;
import com.club.backend.entity.ClubAnnouncement;
import com.club.backend.entity.Membership;
import com.club.backend.entity.MembershipPosition;
import com.club.backend.entity.MembershipStatus;
import com.club.backend.entity.Role;
import com.club.backend.entity.User;
import com.club.backend.repository.ClubAnnouncementRepository;
import com.club.backend.repository.ClubRepository;
import com.club.backend.repository.MembershipRepository;
import com.club.backend.repository.UserRepository;
import com.club.backend.security.UserPrincipal;

@ExtendWith(MockitoExtension.class)
class ClubAnnouncementServiceTest {

    @Mock
    private ClubAnnouncementRepository announcementRepository;
    @Mock
    private ClubRepository clubRepository;
    @Mock
    private MembershipRepository membershipRepository;
    @Mock
    private UserRepository userRepository;
    @Mock
    private NotificationService notificationService;

    @InjectMocks
    private ClubAnnouncementService announcementService;

    private User officer;
    private Club club;
    private UserPrincipal principal;

    @BeforeEach
    void setUp() {
        officer = User.builder().id(UUID.randomUUID()).name("Officer").email("officer@example.com").role(Role.STUDENT).build();
        club = Club.builder().id(UUID.randomUUID()).name("Chess Club").build();
        principal = new UserPrincipal(officer);
    }

    @Test
    void postAnnouncement_blankContent_throws() {
        assertThatThrownBy(() -> announcementService.postAnnouncement(club.getId(),
                new CreateAnnouncementRequest("  "), principal))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("content");
    }

    @Test
    void postAnnouncement_nonOfficer_throws() {
        when(clubRepository.findById(club.getId())).thenReturn(Optional.of(club));
        when(userRepository.findById(officer.getId())).thenReturn(Optional.of(officer));
        when(membershipRepository.findByUserIdAndClubId(officer.getId(), club.getId())).thenReturn(Optional.empty());

        assertThatThrownBy(() -> announcementService.postAnnouncement(club.getId(),
                new CreateAnnouncementRequest("Hello everyone"), principal))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("officers");
    }

    @Test
    void postAnnouncement_success_notifiesAllApprovedMembers() {
        Membership officerMembership = Membership.builder().position(MembershipPosition.PRESIDENT)
                .status(MembershipStatus.APPROVED).build();
        User member1 = User.builder().id(UUID.randomUUID()).name("M1").email("m1@example.com").role(Role.STUDENT).build();
        User member2 = User.builder().id(UUID.randomUUID()).name("M2").email("m2@example.com").role(Role.STUDENT).build();
        Membership m1 = Membership.builder().user(member1).club(club).status(MembershipStatus.APPROVED).build();
        Membership m2 = Membership.builder().user(member2).club(club).status(MembershipStatus.APPROVED).build();

        when(clubRepository.findById(club.getId())).thenReturn(Optional.of(club));
        when(userRepository.findById(officer.getId())).thenReturn(Optional.of(officer));
        when(membershipRepository.findByUserIdAndClubId(officer.getId(), club.getId()))
                .thenReturn(Optional.of(officerMembership));
        when(announcementRepository.save(any(ClubAnnouncement.class))).thenAnswer(inv -> inv.getArgument(0));
        when(membershipRepository.findByClubIdAndStatus(club.getId(), MembershipStatus.APPROVED))
                .thenReturn(List.of(m1, m2));

        announcementService.postAnnouncement(club.getId(), new CreateAnnouncementRequest("Hello everyone"), principal);

        verify(notificationService, times(2)).notify(any(User.class), any(String.class));
    }
}
