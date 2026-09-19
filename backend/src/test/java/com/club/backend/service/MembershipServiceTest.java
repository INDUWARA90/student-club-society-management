package com.club.backend.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.math.BigDecimal;
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
import com.club.backend.dto.MembershipResponse;
import com.club.backend.entity.Club;
import com.club.backend.entity.ClubStatus;
import com.club.backend.entity.JoinPolicy;
import com.club.backend.entity.Membership;
import com.club.backend.entity.MembershipPosition;
import com.club.backend.entity.MembershipStatus;
import com.club.backend.entity.PaymentType;
import com.club.backend.entity.Role;
import com.club.backend.entity.User;
import com.club.backend.repository.ClubRepository;
import com.club.backend.repository.MembershipRepository;
import com.club.backend.repository.UserRepository;
import com.club.backend.security.UserPrincipal;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class MembershipServiceTest {

    @Mock
    private MembershipRepository membershipRepository;
    @Mock
    private ClubRepository clubRepository;
    @Mock
    private UserRepository userRepository;
    @Mock
    private NotificationService notificationService;
    @Mock
    private PaymentService paymentService;
    @Mock
    private AuditLogService auditLogService;
    @Mock
    private EmailVerificationPolicy emailVerificationPolicy;

    @InjectMocks
    private MembershipService membershipService;

    private User user;
    private User president;
    private Club club;
    private UserPrincipal presidentPrincipal;

    @BeforeEach
    void setUp() {
        user = User.builder().id(UUID.randomUUID()).name("Stu").email("stu@example.com").role(Role.STUDENT).build();
        president = User.builder().id(UUID.randomUUID()).name("Pres").email("pres@example.com").role(Role.STUDENT).build();
        club = Club.builder().id(UUID.randomUUID()).name("Chess Club").createdBy(president)
                .status(ClubStatus.APPROVED).joinPolicy(JoinPolicy.OPEN).build();
        presidentPrincipal = new UserPrincipal(president);

        when(clubRepository.findById(club.getId())).thenReturn(Optional.of(club));
        when(userRepository.findById(user.getId())).thenReturn(Optional.of(user));
        when(userRepository.findById(president.getId())).thenReturn(Optional.of(president));
        when(membershipRepository.save(any(Membership.class))).thenAnswer(inv -> inv.getArgument(0));
        when(membershipRepository.saveAndFlush(any(Membership.class))).thenAnswer(inv -> inv.getArgument(0));
    }

    private Membership stubPresidentMembership() {
        Membership presidentMembership = Membership.builder().id(UUID.randomUUID()).user(president).club(club)
                .position(MembershipPosition.PRESIDENT).status(MembershipStatus.APPROVED).build();
        when(membershipRepository.findByUserIdAndClubId(president.getId(), club.getId()))
                .thenReturn(Optional.of(presidentMembership));
        when(membershipRepository.findByClubIdAndPosition(club.getId(), MembershipPosition.PRESIDENT))
                .thenReturn(Optional.of(presidentMembership));
        return presidentMembership;
    }

    private Membership memberOf(User who, MembershipPosition position, MembershipStatus status) {
        return Membership.builder().id(UUID.randomUUID()).user(who).club(club).position(position).status(status).build();
    }

    // ---- joining

    @Test
    void joinClub_alreadyMember_throws() {
        when(membershipRepository.findByUserIdAndClubId(user.getId(), club.getId()))
                .thenReturn(Optional.of(memberOf(user, MembershipPosition.MEMBER, MembershipStatus.APPROVED)));

        assertThatThrownBy(() -> membershipService.joinClub(club.getId(), new UserPrincipal(user)))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("already");
    }

    @Test
    void joinClub_pendingRequestExists_throws() {
        when(membershipRepository.findByUserIdAndClubId(user.getId(), club.getId()))
                .thenReturn(Optional.of(memberOf(user, MembershipPosition.MEMBER, MembershipStatus.PENDING)));

        assertThatThrownBy(() -> membershipService.joinClub(club.getId(), new UserPrincipal(user)))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("already");
    }

    @Test
    void joinClub_pendingClub_throws() {
        club.setStatus(ClubStatus.PENDING);

        assertThatThrownBy(() -> membershipService.joinClub(club.getId(), new UserPrincipal(user)))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("not accepting members");
        verify(membershipRepository, never()).save(any());
    }

    @Test
    void joinClub_archivedClub_throws() {
        club.setArchived(true);

        assertThatThrownBy(() -> membershipService.joinClub(club.getId(), new UserPrincipal(user)))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("not accepting members");
    }

    @Test
    void joinClub_openPolicy_isApprovedImmediately() {
        when(membershipRepository.findByUserIdAndClubId(user.getId(), club.getId())).thenReturn(Optional.empty());

        MembershipResponse response = membershipService.joinClub(club.getId(), new UserPrincipal(user));

        assertThat(response.status()).isEqualTo(MembershipStatus.APPROVED);
    }

    @Test
    void joinClub_approvalRequiredPolicy_isPendingAndNotifiesPresident() {
        club.setJoinPolicy(JoinPolicy.APPROVAL_REQUIRED);
        stubPresidentMembership();
        when(membershipRepository.findByUserIdAndClubId(user.getId(), club.getId())).thenReturn(Optional.empty());

        MembershipResponse response = membershipService.joinClub(club.getId(), new UserPrincipal(user));

        assertThat(response.status()).isEqualTo(MembershipStatus.PENDING);
        verify(notificationService).notify(president, "Stu asked to join Chess Club — review the request.");
    }

    @Test
    void joinClub_afterRejection_canReapply() {
        club.setJoinPolicy(JoinPolicy.APPROVAL_REQUIRED);
        stubPresidentMembership();
        Membership rejected = memberOf(user, MembershipPosition.MEMBER, MembershipStatus.REJECTED);
        when(membershipRepository.findByUserIdAndClubId(user.getId(), club.getId())).thenReturn(Optional.of(rejected));

        MembershipResponse response = membershipService.joinClub(club.getId(), new UserPrincipal(user));

        assertThat(response.status()).isEqualTo(MembershipStatus.PENDING);
        assertThat(rejected.getStatus()).isEqualTo(MembershipStatus.PENDING);
    }

    @Test
    void joinClub_withFeeUnpaid_throws() {
        club.setMembershipFee(new BigDecimal("100"));
        when(membershipRepository.findByUserIdAndClubId(user.getId(), club.getId())).thenReturn(Optional.empty());
        when(paymentService.hasLivePayment(user.getId(), PaymentType.MEMBERSHIP, club.getId())).thenReturn(false);

        assertThatThrownBy(() -> membershipService.joinClub(club.getId(), new UserPrincipal(user)))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("membership fee");
        verify(membershipRepository, never()).save(any());
    }

    @Test
    void joinClub_withFeePaid_succeeds() {
        club.setMembershipFee(new BigDecimal("100"));
        when(membershipRepository.findByUserIdAndClubId(user.getId(), club.getId())).thenReturn(Optional.empty());
        when(paymentService.hasLivePayment(user.getId(), PaymentType.MEMBERSHIP, club.getId())).thenReturn(true);

        assertThat(membershipService.joinClub(club.getId(), new UserPrincipal(user)).status())
                .isEqualTo(MembershipStatus.APPROVED);
    }

    // ---- reviewing requests

    @Test
    void reviewJoinRequest_notPending_throws() {
        Membership membership = memberOf(user, MembershipPosition.MEMBER, MembershipStatus.APPROVED);
        when(membershipRepository.findById(membership.getId())).thenReturn(Optional.of(membership));
        stubPresidentMembership();

        assertThatThrownBy(() -> membershipService.reviewJoinRequest(membership.getId(), true, presidentPrincipal))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("pending");
    }

    @Test
    void reviewJoinRequest_nonPresident_throwsForbidden() {
        Membership membership = memberOf(user, MembershipPosition.MEMBER, MembershipStatus.PENDING);
        when(membershipRepository.findById(membership.getId())).thenReturn(Optional.of(membership));
        when(membershipRepository.findByUserIdAndClubId(user.getId(), club.getId())).thenReturn(Optional.empty());

        assertThatThrownBy(() -> membershipService.reviewJoinRequest(membership.getId(), true, new UserPrincipal(user)))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("Club Admin");
    }

    @Test
    void reviewJoinRequest_approves_andNotifiesUser() {
        Membership membership = memberOf(user, MembershipPosition.MEMBER, MembershipStatus.PENDING);
        when(membershipRepository.findById(membership.getId())).thenReturn(Optional.of(membership));
        stubPresidentMembership();

        MembershipResponse response = membershipService.reviewJoinRequest(membership.getId(), true, presidentPrincipal);

        assertThat(response.status()).isEqualTo(MembershipStatus.APPROVED);
        verify(notificationService).notify(any(User.class), anyString());
        verify(paymentService, never()).refundMembershipPayment(any(), any(), any());
    }

    @Test
    void reviewJoinRequest_rejects_refundsTheFee() {
        Membership membership = memberOf(user, MembershipPosition.MEMBER, MembershipStatus.PENDING);
        when(membershipRepository.findById(membership.getId())).thenReturn(Optional.of(membership));
        stubPresidentMembership();

        MembershipResponse response = membershipService.reviewJoinRequest(membership.getId(), false, presidentPrincipal);

        assertThat(response.status()).isEqualTo(MembershipStatus.REJECTED);
        verify(paymentService).refundMembershipPayment(user.getId(), club, "join request rejected");
    }

    // ---- leaving / removing

    @Test
    void leaveClub_president_mustHandOffFirst() {
        Membership presidentMembership = stubPresidentMembership();

        assertThatThrownBy(() -> membershipService.leaveClub(club.getId(), presidentPrincipal))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("Transfer the President");
        verify(membershipRepository, never()).delete(presidentMembership);
    }

    @Test
    void leaveClub_withdrawingPendingRequest_refundsFee() {
        Membership pending = memberOf(user, MembershipPosition.MEMBER, MembershipStatus.PENDING);
        when(membershipRepository.findByUserIdAndClubId(user.getId(), club.getId())).thenReturn(Optional.of(pending));

        membershipService.leaveClub(club.getId(), new UserPrincipal(user));

        verify(paymentService).refundMembershipPayment(user.getId(), club, "join request withdrawn");
        verify(membershipRepository).delete(pending);
    }

    @Test
    void removeMember_president_cannotBeRemoved() {
        Membership presidentMembership = stubPresidentMembership();
        when(membershipRepository.findById(presidentMembership.getId())).thenReturn(Optional.of(presidentMembership));

        assertThatThrownBy(() -> membershipService.removeMember(presidentMembership.getId(), presidentPrincipal))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("can't be removed");
        verify(membershipRepository, never()).delete(any(Membership.class));
    }

    @Test
    void removeMember_byPresident_deletesNotifiesAndAudits() {
        stubPresidentMembership();
        Membership target = memberOf(user, MembershipPosition.MEMBER, MembershipStatus.APPROVED);
        when(membershipRepository.findById(target.getId())).thenReturn(Optional.of(target));

        membershipService.removeMember(target.getId(), presidentPrincipal);

        verify(membershipRepository).delete(target);
        verify(notificationService).notify(user, "You have been removed from Chess Club.");
        verify(auditLogService).log(any(User.class), org.mockito.ArgumentMatchers.eq("REMOVE_MEMBER"),
                anyString(), any(UUID.class), anyString());
    }

    @Test
    void removeMember_byNonPresident_throwsForbidden() {
        Membership target = memberOf(user, MembershipPosition.MEMBER, MembershipStatus.APPROVED);
        when(membershipRepository.findById(target.getId())).thenReturn(Optional.of(target));
        when(membershipRepository.findByUserIdAndClubId(user.getId(), club.getId()))
                .thenReturn(Optional.of(memberOf(user, MembershipPosition.MEMBER, MembershipStatus.APPROVED)));

        assertThatThrownBy(() -> membershipService.removeMember(target.getId(), new UserPrincipal(user)))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("Club Admin");
    }

    // ---- positions

    @Test
    void assignPosition_toPresident_demotesCurrentPresident() {
        Membership currentPresident = stubPresidentMembership();
        Membership target = memberOf(user, MembershipPosition.MEMBER, MembershipStatus.APPROVED);
        when(membershipRepository.findById(target.getId())).thenReturn(Optional.of(target));

        membershipService.assignPosition(target.getId(), MembershipPosition.PRESIDENT, presidentPrincipal);

        assertThat(currentPresident.getPosition()).isEqualTo(MembershipPosition.MEMBER);
        assertThat(target.getPosition()).isEqualTo(MembershipPosition.PRESIDENT);
        // The demotion is flushed first so the one-President-per-club constraint is never violated.
        verify(membershipRepository).saveAndFlush(currentPresident);
        verify(notificationService).notify(president, "You are no longer President of Chess Club.");
        verify(notificationService).notify(user, "Your position in Chess Club is now PRESIDENT.");
    }

    @Test
    void assignPosition_presidentDemotingThemselves_isRejected() {
        Membership currentPresident = stubPresidentMembership();
        when(membershipRepository.findById(currentPresident.getId())).thenReturn(Optional.of(currentPresident));

        assertThatThrownBy(() -> membershipService.assignPosition(
                currentPresident.getId(), MembershipPosition.MEMBER, presidentPrincipal))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("step down");
        assertThat(currentPresident.getPosition()).isEqualTo(MembershipPosition.PRESIDENT);
    }

    @Test
    void assignPosition_toPendingMember_isRejected() {
        stubPresidentMembership();
        Membership pending = memberOf(user, MembershipPosition.MEMBER, MembershipStatus.PENDING);
        when(membershipRepository.findById(pending.getId())).thenReturn(Optional.of(pending));

        assertThatThrownBy(() -> membershipService.assignPosition(
                pending.getId(), MembershipPosition.TREASURER, presidentPrincipal))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("approved members");
    }

    @Test
    void assignPosition_nonPresident_throwsForbidden() {
        Membership target = memberOf(user, MembershipPosition.MEMBER, MembershipStatus.APPROVED);
        when(membershipRepository.findById(target.getId())).thenReturn(Optional.of(target));
        when(membershipRepository.findByUserIdAndClubId(user.getId(), club.getId())).thenReturn(Optional.empty());

        assertThatThrownBy(() -> membershipService.assignPosition(target.getId(), MembershipPosition.TREASURER,
                new UserPrincipal(user)))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("Club Admin");
    }

    // ---- roster tools

    @Test
    void importMembers_secretary_allowed() {
        Membership secretaryMembership = memberOf(user, MembershipPosition.SECRETARY, MembershipStatus.APPROVED);
        when(membershipRepository.findByUserIdAndClubId(user.getId(), club.getId()))
                .thenReturn(Optional.of(secretaryMembership));

        var response = membershipService.importMembers(club.getId(),
                new com.club.backend.dto.ImportMembersRequest(java.util.List.of()), new UserPrincipal(user));

        assertThat(response.imported()).isZero();
    }

    @Test
    void importMembers_regularMember_throwsForbidden() {
        when(membershipRepository.findByUserIdAndClubId(user.getId(), club.getId())).thenReturn(Optional.empty());

        assertThatThrownBy(() -> membershipService.importMembers(club.getId(),
                new com.club.backend.dto.ImportMembersRequest(java.util.List.of()), new UserPrincipal(user)))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("Club Admin or Secretary");
    }

    @Test
    void listMembersCsv_vp_throwsForbidden() {
        Membership vpMembership = memberOf(user, MembershipPosition.VP, MembershipStatus.APPROVED);
        when(membershipRepository.findByUserIdAndClubId(user.getId(), club.getId())).thenReturn(Optional.of(vpMembership));

        assertThatThrownBy(() -> membershipService.listMembersCsv(club.getId(), new UserPrincipal(user)))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("Club Admin or Secretary");
    }

    @Test
    void listMembersCsv_neutralisesSpreadsheetFormulas() {
        Membership secretary = memberOf(president, MembershipPosition.SECRETARY, MembershipStatus.APPROVED);
        when(membershipRepository.findByUserIdAndClubId(president.getId(), club.getId())).thenReturn(Optional.of(secretary));
        User sneaky = User.builder().id(UUID.randomUUID()).name("=HYPERLINK(\"http://evil\")").email("x@example.com")
                .role(Role.STUDENT).build();
        when(membershipRepository.findByClubIdAndStatus(club.getId(), MembershipStatus.APPROVED))
                .thenReturn(java.util.List.of(memberOf(sneaky, MembershipPosition.MEMBER, MembershipStatus.APPROVED)));

        String csv = membershipService.listMembersCsv(club.getId(), presidentPrincipal);

        // The name starts with a quote-prefixed apostrophe so Excel/Sheets treat it as text, not a formula.
        assertThat(csv).contains("\"'=HYPERLINK(\"\"http://evil\"\")\"");
    }


    // ---- succession (claim presidency)

    private void presidentHasGraduated() {
        president.setGraduationYear(java.time.Year.now().getValue() - 1);
    }

    @Test
    void claimPresidency_vpTakesOverAGraduatedPresident() {
        presidentHasGraduated();
        Membership currentPresident = stubPresidentMembership();
        Membership vp = memberOf(user, MembershipPosition.VP, MembershipStatus.APPROVED);
        when(membershipRepository.findByUserIdAndClubId(user.getId(), club.getId())).thenReturn(Optional.of(vp));

        MembershipResponse response = membershipService.claimPresidency(club.getId(), new UserPrincipal(user));

        assertThat(response.position()).isEqualTo(MembershipPosition.PRESIDENT);
        assertThat(currentPresident.getPosition()).isEqualTo(MembershipPosition.MEMBER);
        verify(membershipRepository).saveAndFlush(currentPresident);
        verify(notificationService).notify(user, "You are now President of Chess Club.");
        verify(notificationService).notify(president, "The presidency of Chess Club passed to Stu.");
        verify(auditLogService).log(any(User.class), org.mockito.ArgumentMatchers.eq("CLAIM_PRESIDENCY"), anyString(),
                any(UUID.class), anyString());
    }

    @Test
    void claimPresidency_isRefusedWhileThePresidentIsStillAStudent() {
        stubPresidentMembership();
        Membership vp = memberOf(user, MembershipPosition.VP, MembershipStatus.APPROVED);
        when(membershipRepository.findByUserIdAndClubId(user.getId(), club.getId())).thenReturn(Optional.of(vp));

        assertThatThrownBy(() -> membershipService.claimPresidency(club.getId(), new UserPrincipal(user)))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("hasn't graduated");
        assertThat(vp.getPosition()).isEqualTo(MembershipPosition.VP);
    }

    @Test
    void claimPresidency_futureGraduationYearDoesNotCount() {
        president.setGraduationYear(java.time.Year.now().getValue() + 1);
        stubPresidentMembership();
        when(membershipRepository.findByUserIdAndClubId(user.getId(), club.getId()))
                .thenReturn(Optional.of(memberOf(user, MembershipPosition.VP, MembershipStatus.APPROVED)));

        assertThatThrownBy(() -> membershipService.claimPresidency(club.getId(), new UserPrincipal(user)))
                .isInstanceOf(ApiException.class).hasMessageContaining("hasn't graduated");
    }

    @Test
    void claimPresidency_ordinaryMembersAndOutsidersCannot() {
        presidentHasGraduated();
        stubPresidentMembership();
        when(membershipRepository.findByUserIdAndClubId(user.getId(), club.getId()))
                .thenReturn(Optional.of(memberOf(user, MembershipPosition.MEMBER, MembershipStatus.APPROVED)));
        assertThatThrownBy(() -> membershipService.claimPresidency(club.getId(), new UserPrincipal(user)))
                .isInstanceOf(ApiException.class).hasMessageContaining("Only an officer");

        when(membershipRepository.findByUserIdAndClubId(user.getId(), club.getId())).thenReturn(Optional.empty());
        assertThatThrownBy(() -> membershipService.claimPresidency(club.getId(), new UserPrincipal(user)))
                .isInstanceOf(ApiException.class).hasMessageContaining("Only club officers");
    }

    @Test
    void claimPresidency_secretaryMayOnlyClaimWhenThereIsNoVp() {
        presidentHasGraduated();
        stubPresidentMembership();
        Membership secretary = memberOf(user, MembershipPosition.SECRETARY, MembershipStatus.APPROVED);
        when(membershipRepository.findByUserIdAndClubId(user.getId(), club.getId())).thenReturn(Optional.of(secretary));

        // A VP exists: the secretary has to wait for them.
        User vpUser = User.builder().id(UUID.randomUUID()).name("Vee").email("v@example.com").role(Role.STUDENT).build();
        when(membershipRepository.findByClubIdAndStatus(club.getId(), MembershipStatus.APPROVED))
                .thenReturn(java.util.List.of(memberOf(vpUser, MembershipPosition.VP, MembershipStatus.APPROVED), secretary));
        assertThatThrownBy(() -> membershipService.claimPresidency(club.getId(), new UserPrincipal(user)))
                .isInstanceOf(ApiException.class).hasMessageContaining("Vice President");

        // No VP: the secretary may take over.
        when(membershipRepository.findByClubIdAndStatus(club.getId(), MembershipStatus.APPROVED))
                .thenReturn(java.util.List.of(secretary));
        assertThat(membershipService.claimPresidency(club.getId(), new UserPrincipal(user)).position())
                .isEqualTo(MembershipPosition.PRESIDENT);
    }

    @Test
    void claimPresidency_thePresidentCannotClaimTheirOwnRole() {
        Membership currentPresident = stubPresidentMembership();
        when(membershipRepository.findByUserIdAndClubId(president.getId(), club.getId()))
                .thenReturn(Optional.of(currentPresident));

        assertThatThrownBy(() -> membershipService.claimPresidency(club.getId(), presidentPrincipal))
                .isInstanceOf(ApiException.class).hasMessageContaining("already the President");
    }

    @Test
    void pageMembers_asksTheDatabaseForOnePage() {
        var pageable = org.springframework.data.domain.PageRequest.of(1, 2);
        when(membershipRepository.findByClubIdAndStatus(club.getId(), MembershipStatus.APPROVED, pageable))
                .thenReturn(new org.springframework.data.domain.PageImpl<>(
                        java.util.List.of(memberOf(user, MembershipPosition.MEMBER, MembershipStatus.APPROVED)), pageable, 5));

        var page = membershipService.pageMembers(club.getId(), pageable);

        assertThat(page.getTotalElements()).isEqualTo(5);
        assertThat(page.getContent()).hasSize(1);
    }
}
