package com.club.backend.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.times;
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
import com.club.backend.dto.MembershipResponse;
import com.club.backend.entity.Club;
import com.club.backend.entity.JoinPolicy;
import com.club.backend.entity.Membership;
import com.club.backend.entity.MembershipPosition;
import com.club.backend.entity.MembershipStatus;
import com.club.backend.entity.Role;
import com.club.backend.entity.User;
import com.club.backend.repository.ClubRepository;
import com.club.backend.repository.MembershipRepository;
import com.club.backend.repository.UserRepository;
import com.club.backend.security.UserPrincipal;

@ExtendWith(MockitoExtension.class)
class MembershipServiceTest {

    @Mock
    private MembershipRepository membershipRepository;
    @Mock
    private ClubRepository clubRepository;
    @Mock
    private UserRepository userRepository;
    @Mock
    private NotificationService notificationService;

    @InjectMocks
    private MembershipService membershipService;

    private User user;
    private User president;
    private Club club;

    @BeforeEach
    void setUp() {
        user = User.builder().id(UUID.randomUUID()).name("Stu").email("stu@example.com").role(Role.STUDENT).build();
        president = User.builder().id(UUID.randomUUID()).name("Pres").email("pres@example.com").role(Role.STUDENT).build();
        club = Club.builder().id(UUID.randomUUID()).name("Chess Club").createdBy(president).joinPolicy(JoinPolicy.OPEN).build();
    }

    @Test
    void joinClub_alreadyMember_throws() {
        UserPrincipal principal = new UserPrincipal(user);
        when(clubRepository.findById(club.getId())).thenReturn(Optional.of(club));
        when(userRepository.findById(user.getId())).thenReturn(Optional.of(user));
        when(membershipRepository.findByUserIdAndClubId(user.getId(), club.getId()))
                .thenReturn(Optional.of(Membership.builder().build()));

        assertThatThrownBy(() -> membershipService.joinClub(club.getId(), principal))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("already");
    }

    @Test
    void joinClub_openPolicy_isApprovedImmediately() {
        UserPrincipal principal = new UserPrincipal(user);
        when(clubRepository.findById(club.getId())).thenReturn(Optional.of(club));
        when(userRepository.findById(user.getId())).thenReturn(Optional.of(user));
        when(membershipRepository.findByUserIdAndClubId(user.getId(), club.getId())).thenReturn(Optional.empty());
        when(membershipRepository.save(any(Membership.class))).thenAnswer(inv -> inv.getArgument(0));

        MembershipResponse response = membershipService.joinClub(club.getId(), principal);

        assertThat(response.status()).isEqualTo(MembershipStatus.APPROVED);
    }

    @Test
    void joinClub_approvalRequiredPolicy_isPending() {
        club.setJoinPolicy(JoinPolicy.APPROVAL_REQUIRED);
        UserPrincipal principal = new UserPrincipal(user);
        when(clubRepository.findById(club.getId())).thenReturn(Optional.of(club));
        when(userRepository.findById(user.getId())).thenReturn(Optional.of(user));
        when(membershipRepository.findByUserIdAndClubId(user.getId(), club.getId())).thenReturn(Optional.empty());
        when(membershipRepository.save(any(Membership.class))).thenAnswer(inv -> inv.getArgument(0));

        MembershipResponse response = membershipService.joinClub(club.getId(), principal);

        assertThat(response.status()).isEqualTo(MembershipStatus.PENDING);
    }

    @Test
    void reviewJoinRequest_notPending_throws() {
        Membership membership = Membership.builder().id(UUID.randomUUID()).user(user).club(club)
                .status(MembershipStatus.APPROVED).build();
        when(membershipRepository.findById(membership.getId())).thenReturn(Optional.of(membership));

        assertThatThrownBy(() -> membershipService.reviewJoinRequest(membership.getId(), true))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("pending");
    }

    @Test
    void reviewJoinRequest_approves_andNotifiesUser() {
        Membership membership = Membership.builder().id(UUID.randomUUID()).user(user).club(club)
                .status(MembershipStatus.PENDING).build();
        when(membershipRepository.findById(membership.getId())).thenReturn(Optional.of(membership));
        when(membershipRepository.save(any(Membership.class))).thenAnswer(inv -> inv.getArgument(0));

        MembershipResponse response = membershipService.reviewJoinRequest(membership.getId(), true);

        assertThat(response.status()).isEqualTo(MembershipStatus.APPROVED);
        verify(notificationService).notify(any(User.class), any(String.class));
    }

    @Test
    void assignPosition_toPresident_demotesCurrentPresident() {
        Membership currentPresident = Membership.builder().id(UUID.randomUUID()).user(president).club(club)
                .position(MembershipPosition.PRESIDENT).status(MembershipStatus.APPROVED).build();
        Membership target = Membership.builder().id(UUID.randomUUID()).user(user).club(club)
                .position(MembershipPosition.MEMBER).status(MembershipStatus.APPROVED).build();

        when(membershipRepository.findById(target.getId())).thenReturn(Optional.of(target));
        when(membershipRepository.findByClubIdAndPosition(club.getId(), MembershipPosition.PRESIDENT))
                .thenReturn(Optional.of(currentPresident));
        when(membershipRepository.save(any(Membership.class))).thenAnswer(inv -> inv.getArgument(0));

        membershipService.assignPosition(target.getId(), MembershipPosition.PRESIDENT);

        assertThat(currentPresident.getPosition()).isEqualTo(MembershipPosition.MEMBER);
        assertThat(target.getPosition()).isEqualTo(MembershipPosition.PRESIDENT);
        verify(membershipRepository, times(2)).save(any(Membership.class));
    }
}
