package com.club.backend.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
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
import com.club.backend.dto.ClubResponse;
import com.club.backend.dto.CreateClubRequest;
import com.club.backend.entity.Club;
import com.club.backend.entity.ClubStatus;
import com.club.backend.entity.JoinPolicy;
import com.club.backend.entity.Membership;
import com.club.backend.entity.Role;
import com.club.backend.entity.User;
import com.club.backend.repository.ClubRepository;
import com.club.backend.repository.MembershipRepository;
import com.club.backend.repository.UserRepository;
import com.club.backend.security.UserPrincipal;

@ExtendWith(MockitoExtension.class)
class ClubServiceTest {

    @Mock
    private ClubRepository clubRepository;
    @Mock
    private MembershipRepository membershipRepository;
    @Mock
    private UserRepository userRepository;
    @Mock
    private AuditLogService auditLogService;
    @Mock
    private NotificationService notificationService;
    @Mock
    private com.club.backend.repository.EventRepository eventRepository;
    @Mock
    private EventService eventService;
    @Mock
    private EmailVerificationPolicy emailVerificationPolicy;

    @InjectMocks
    private ClubService clubService;

    private User superAdmin;
    private User student;
    private UserPrincipal studentPrincipal;
    private UserPrincipal superAdminPrincipal;

    @BeforeEach
    void setUp() {
        superAdmin = User.builder().id(UUID.randomUUID()).name("Admin").email("admin@example.com").role(Role.SUPER_ADMIN).build();
        student = User.builder().id(UUID.randomUUID()).name("Stu").email("stu@example.com").role(Role.STUDENT).build();
        studentPrincipal = new UserPrincipal(student);
        superAdminPrincipal = new UserPrincipal(superAdmin);
    }

    @Test
    void createClub_blankName_throws() {
        CreateClubRequest request = new CreateClubRequest("  ", "Tech", null, null, null);

        assertThatThrownBy(() -> clubService.createClub(request, studentPrincipal))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("name");
    }

    @Test
    void createClub_blankCategory_throws() {
        CreateClubRequest request = new CreateClubRequest("Chess Club", "  ", null, null, null);

        assertThatThrownBy(() -> clubService.createClub(request, studentPrincipal))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("category");
    }

    @Test
    void createClub_bySuperAdmin_isApprovedImmediately() {
        CreateClubRequest request = new CreateClubRequest("Chess Club", "Games", "desc", JoinPolicy.OPEN, null);
        UserPrincipal adminPrincipal = new UserPrincipal(superAdmin);
        when(userRepository.findById(superAdmin.getId())).thenReturn(Optional.of(superAdmin));
        when(clubRepository.save(any(Club.class))).thenAnswer(inv -> inv.getArgument(0));

        ClubResponse response = clubService.createClub(request, adminPrincipal);

        assertThat(response.status()).isEqualTo(ClubStatus.APPROVED);
    }

    @Test
    void createClub_byStudent_isPendingAndCreatorBecomesPresident() {
        CreateClubRequest request = new CreateClubRequest("Chess Club", "Games", "desc", null, null);
        when(userRepository.findById(student.getId())).thenReturn(Optional.of(student));
        when(clubRepository.save(any(Club.class))).thenAnswer(inv -> inv.getArgument(0));
        when(membershipRepository.save(any(Membership.class))).thenAnswer(inv -> inv.getArgument(0));

        ClubResponse response = clubService.createClub(request, studentPrincipal);

        assertThat(response.status()).isEqualTo(ClubStatus.PENDING);
    }

    @Test
    void approveClub_alreadyDecided_throws() {
        Club club = Club.builder().id(UUID.randomUUID()).status(ClubStatus.APPROVED).createdBy(student).build();
        when(clubRepository.findById(club.getId())).thenReturn(Optional.of(club));

        assertThatThrownBy(() -> clubService.approveClub(club.getId(), true, superAdminPrincipal))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("pending");
    }

    @Test
    void approveClub_approvesPendingClub() {
        Club club = Club.builder().id(UUID.randomUUID()).status(ClubStatus.PENDING).createdBy(student).build();
        when(clubRepository.findById(club.getId())).thenReturn(Optional.of(club));
        when(clubRepository.save(any(Club.class))).thenAnswer(inv -> inv.getArgument(0));
        when(userRepository.findById(superAdmin.getId())).thenReturn(Optional.of(superAdmin));

        ClubResponse response = clubService.approveClub(club.getId(), true, superAdminPrincipal);

        assertThat(response.status()).isEqualTo(ClubStatus.APPROVED);
    }

    @Test
    void updateClub_renameApprovedClub_revertsToPendingAndNotifies() {
        Club club = Club.builder().id(UUID.randomUUID()).name("Old Name").category("Tech")
                .status(ClubStatus.APPROVED).createdBy(student).build();
        Membership presidentMembership = Membership.builder().user(student).club(club)
                .position(com.club.backend.entity.MembershipPosition.PRESIDENT)
                .status(com.club.backend.entity.MembershipStatus.APPROVED).build();
        CreateClubRequest request = new CreateClubRequest("New Name", "desc", "Tech", JoinPolicy.OPEN, null);

        when(clubRepository.findById(club.getId())).thenReturn(Optional.of(club));
        when(membershipRepository.findByUserIdAndClubId(student.getId(), club.getId()))
                .thenReturn(Optional.of(presidentMembership));
        when(clubRepository.save(any(Club.class))).thenAnswer(inv -> inv.getArgument(0));

        ClubResponse response = clubService.updateClub(club.getId(), request, studentPrincipal);

        assertThat(response.status()).isEqualTo(ClubStatus.PENDING);
        org.mockito.Mockito.verify(notificationService).notify(any(User.class), any(String.class));
    }

    @Test
    void updateClub_descriptionOnlyChange_staysApproved() {
        Club club = Club.builder().id(UUID.randomUUID()).name("Chess Club").category("Games")
                .status(ClubStatus.APPROVED).createdBy(student).build();
        Membership presidentMembership = Membership.builder().user(student).club(club)
                .position(com.club.backend.entity.MembershipPosition.PRESIDENT)
                .status(com.club.backend.entity.MembershipStatus.APPROVED).build();
        CreateClubRequest request = new CreateClubRequest("Chess Club", "new description", "Games", JoinPolicy.OPEN, null);

        when(clubRepository.findById(club.getId())).thenReturn(Optional.of(club));
        when(membershipRepository.findByUserIdAndClubId(student.getId(), club.getId()))
                .thenReturn(Optional.of(presidentMembership));
        when(clubRepository.save(any(Club.class))).thenAnswer(inv -> inv.getArgument(0));

        ClubResponse response = clubService.updateClub(club.getId(), request, studentPrincipal);

        assertThat(response.status()).isEqualTo(ClubStatus.APPROVED);
    }

    @Test
    void listApprovedClubs_delegatesFilteringToTheDatabase_sortedByName() {
        Club chess = Club.builder().id(UUID.randomUUID()).name("Chess Club").status(ClubStatus.APPROVED).createdBy(student).build();
        when(clubRepository.findAll(any(org.springframework.data.jpa.domain.Specification.class), any(org.springframework.data.domain.Sort.class)))
                .thenReturn(List.of(chess));

        assertThat(clubService.listApprovedClubs(null)).extracting(ClubResponse::id).containsExactly(chess.getId());
        assertThat(clubService.listApprovedClubs("Games", "chess")).hasSize(1);

        org.mockito.Mockito.verify(clubRepository, org.mockito.Mockito.times(2)).findAll(
                any(org.springframework.data.jpa.domain.Specification.class),
                org.mockito.ArgumentMatchers.eq(org.springframework.data.domain.Sort.by("name")));
    }

    @Test
    void pageApprovedClubs_returnsOnePageAndTheTotalCount() {
        Club chess = Club.builder().id(UUID.randomUUID()).name("Chess Club").status(ClubStatus.APPROVED).createdBy(student).build();
        var pageable = org.springframework.data.domain.PageRequest.of(0, 1);
        when(clubRepository.findAll(any(org.springframework.data.jpa.domain.Specification.class), any(org.springframework.data.domain.Pageable.class)))
                .thenReturn(new org.springframework.data.domain.PageImpl<>(List.of(chess), pageable, 7));

        var page = clubService.pageApprovedClubs(null, null, pageable);

        assertThat(page.getTotalElements()).isEqualTo(7);
        assertThat(page.getContent()).hasSize(1);
    }

    @Test
    void createClub_oversizedLogo_isRejected() {
        String huge = "A".repeat(InputLimits.MAX_IMAGE_CHARS + 1);

        assertThatThrownBy(() -> clubService.createClub(
                new CreateClubRequest("Chess Club", "Games", "desc", null, huge), studentPrincipal))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("too large");
    }

    @Test
    void createClub_duplicateName_conflicts() {
        when(userRepository.findById(student.getId())).thenReturn(Optional.of(student));
        when(clubRepository.existsByNameIgnoreCase("Chess Club")).thenReturn(true);

        assertThatThrownBy(() -> clubService.createClub(
                new CreateClubRequest("Chess Club", "Games", "desc", null, null), studentPrincipal))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("already exists");
    }

    @Test
    void createClub_invalidFeeOrThreshold_throws() {
        assertThatThrownBy(() -> clubService.createClub(new CreateClubRequest(
                "Chess Club", "desc", "Games", null, null, new java.math.BigDecimal("-5"), null), studentPrincipal))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("Membership fee");
        assertThatThrownBy(() -> clubService.createClub(new CreateClubRequest(
                "Chess Club", "desc", "Games", null, null, null, 0), studentPrincipal))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("Certificate threshold");
    }

    @Test
    void createClub_storesFeeAndThreshold_andNotifiesSuperAdmins() {
        when(userRepository.findById(student.getId())).thenReturn(Optional.of(student));
        when(userRepository.findByRole(Role.SUPER_ADMIN)).thenReturn(List.of(superAdmin));
        when(clubRepository.save(any(Club.class))).thenAnswer(inv -> inv.getArgument(0));
        when(membershipRepository.save(any(Membership.class))).thenAnswer(inv -> inv.getArgument(0));

        ClubResponse response = clubService.createClub(new CreateClubRequest(
                "Chess Club", "desc", "Games", null, null, new java.math.BigDecimal("150"), 5), studentPrincipal);

        assertThat(response.membershipFee()).isEqualByComparingTo("150");
        assertThat(response.certificateThreshold()).isEqualTo(5);
        org.mockito.Mockito.verify(notificationService).notifyUsers(
                org.mockito.ArgumentMatchers.eq(List.of(superAdmin.getId())), any(String.class));
    }

    @Test
    void createClub_unverifiedEmail_isBlocked() {
        when(userRepository.findById(student.getId())).thenReturn(Optional.of(student));
        org.mockito.Mockito.doThrow(ApiException.forbidden("Please verify your email address first"))
                .when(emailVerificationPolicy).requireVerified(student);

        assertThatThrownBy(() -> clubService.createClub(
                new CreateClubRequest("Chess Club", "Games", "desc", null, null), studentPrincipal))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("verify your email");
    }

    @Test
    void approveClub_rejectionReasonReachesTheCreator() {
        Club club = Club.builder().id(UUID.randomUUID()).name("Chess Club").status(ClubStatus.PENDING).createdBy(student).build();
        when(clubRepository.findById(club.getId())).thenReturn(Optional.of(club));
        when(clubRepository.save(any(Club.class))).thenAnswer(inv -> inv.getArgument(0));
        when(userRepository.findById(superAdmin.getId())).thenReturn(Optional.of(superAdmin));

        clubService.approveClub(club.getId(), false, "Overlaps with the Games society", superAdminPrincipal);

        org.mockito.Mockito.verify(notificationService).notify(student,
                "Your club \"Chess Club\" request was rejected. Reason: Overlaps with the Games society");
    }

    @Test
    void updateClub_renameToExistingName_conflicts() {
        Club club = Club.builder().id(UUID.randomUUID()).name("Old Name").category("Tech")
                .status(ClubStatus.APPROVED).createdBy(student).build();
        Membership presidentMembership = Membership.builder().user(student).club(club)
                .position(com.club.backend.entity.MembershipPosition.PRESIDENT)
                .status(com.club.backend.entity.MembershipStatus.APPROVED).build();
        when(clubRepository.findById(club.getId())).thenReturn(Optional.of(club));
        when(membershipRepository.findByUserIdAndClubId(student.getId(), club.getId()))
                .thenReturn(Optional.of(presidentMembership));
        when(clubRepository.existsByNameIgnoreCase("Taken")).thenReturn(true);

        assertThatThrownBy(() -> clubService.updateClub(club.getId(),
                new CreateClubRequest("Taken", "d", "Tech", JoinPolicy.OPEN, null), studentPrincipal))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("already exists");
    }

    @Test
    void updateClub_keepsExistingFeeWhenNoneSent_andCanChangeIt() {
        Club club = Club.builder().id(UUID.randomUUID()).name("Chess Club").category("Games")
                .status(ClubStatus.APPROVED).createdBy(student).membershipFee(new java.math.BigDecimal("100")).build();
        Membership presidentMembership = Membership.builder().user(student).club(club)
                .position(com.club.backend.entity.MembershipPosition.PRESIDENT)
                .status(com.club.backend.entity.MembershipStatus.APPROVED).build();
        when(clubRepository.findById(club.getId())).thenReturn(Optional.of(club));
        when(membershipRepository.findByUserIdAndClubId(student.getId(), club.getId()))
                .thenReturn(Optional.of(presidentMembership));
        when(clubRepository.save(any(Club.class))).thenAnswer(inv -> inv.getArgument(0));

        ClubResponse unchanged = clubService.updateClub(club.getId(),
                new CreateClubRequest("Chess Club", "d", "Games", JoinPolicy.OPEN, null), studentPrincipal);
        assertThat(unchanged.membershipFee()).isEqualByComparingTo("100");

        ClubResponse changed = clubService.updateClub(club.getId(), new CreateClubRequest(
                "Chess Club", "d", "Games", JoinPolicy.OPEN, null, new java.math.BigDecimal("250"), 4), studentPrincipal);
        assertThat(changed.membershipFee()).isEqualByComparingTo("250");
        assertThat(changed.certificateThreshold()).isEqualTo(4);
    }

    @Test
    void archiveClub_byPresident_cancelsUpcomingEventsAndNotifiesMembers() {
        Club club = Club.builder().id(UUID.randomUUID()).name("Chess Club").status(ClubStatus.APPROVED).createdBy(student).build();
        Membership presidentMembership = Membership.builder().user(student).club(club)
                .position(com.club.backend.entity.MembershipPosition.PRESIDENT)
                .status(com.club.backend.entity.MembershipStatus.APPROVED).build();
        com.club.backend.entity.Event upcoming = com.club.backend.entity.Event.builder().id(UUID.randomUUID()).club(club)
                .title("Simul").build();
        when(clubRepository.findById(club.getId())).thenReturn(Optional.of(club));
        when(userRepository.findById(student.getId())).thenReturn(Optional.of(student));
        when(membershipRepository.findByUserIdAndClubId(student.getId(), club.getId()))
                .thenReturn(Optional.of(presidentMembership));
        when(membershipRepository.findByClubIdAndStatus(club.getId(), com.club.backend.entity.MembershipStatus.APPROVED))
                .thenReturn(List.of(presidentMembership));
        when(eventRepository.findByClubIdAndCancelledFalseAndEventDateAfter(
                org.mockito.ArgumentMatchers.eq(club.getId()), any(java.time.Instant.class))).thenReturn(List.of(upcoming));
        when(clubRepository.save(any(Club.class))).thenAnswer(inv -> inv.getArgument(0));

        ClubResponse response = clubService.archiveClub(club.getId(), studentPrincipal);

        assertThat(response.archived()).isTrue();
        org.mockito.Mockito.verify(eventService).cancelInternal(upcoming, "the club was closed");
        org.mockito.Mockito.verify(notificationService).notifyUsers(
                org.mockito.ArgumentMatchers.eq(List.of(student.getId())), any(String.class));
        org.mockito.Mockito.verify(auditLogService).log(
                org.mockito.ArgumentMatchers.eq(student), org.mockito.ArgumentMatchers.eq("ARCHIVE_CLUB"),
                any(String.class), any(UUID.class), any(String.class));
    }

    @Test
    void archiveClub_byOrdinaryMember_forbidden() {
        Club club = Club.builder().id(UUID.randomUUID()).name("Chess Club").status(ClubStatus.APPROVED).createdBy(student).build();
        when(clubRepository.findById(club.getId())).thenReturn(Optional.of(club));
        when(userRepository.findById(student.getId())).thenReturn(Optional.of(student));
        when(membershipRepository.findByUserIdAndClubId(student.getId(), club.getId())).thenReturn(Optional.empty());

        assertThatThrownBy(() -> clubService.archiveClub(club.getId(), studentPrincipal))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("Only the Club Admin or a Super Admin");
    }

    @Test
    void archiveClub_bySuperAdmin_allowedEvenWithoutMembership() {
        Club club = Club.builder().id(UUID.randomUUID()).name("Chess Club").status(ClubStatus.APPROVED).createdBy(student).build();
        when(clubRepository.findById(club.getId())).thenReturn(Optional.of(club));
        when(userRepository.findById(superAdmin.getId())).thenReturn(Optional.of(superAdmin));
        when(membershipRepository.findByUserIdAndClubId(superAdmin.getId(), club.getId())).thenReturn(Optional.empty());
        when(clubRepository.save(any(Club.class))).thenAnswer(inv -> inv.getArgument(0));

        assertThat(clubService.archiveClub(club.getId(), superAdminPrincipal).archived()).isTrue();
    }

    @Test
    void archiveClub_alreadyArchived_throws() {
        Club club = Club.builder().id(UUID.randomUUID()).name("Chess Club").status(ClubStatus.APPROVED)
                .archived(true).createdBy(student).build();
        when(clubRepository.findById(club.getId())).thenReturn(Optional.of(club));
        when(userRepository.findById(superAdmin.getId())).thenReturn(Optional.of(superAdmin));

        assertThatThrownBy(() -> clubService.archiveClub(club.getId(), superAdminPrincipal))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("already archived");
    }

    @Test
    void unarchiveClub_restoresTheClub() {
        Club club = Club.builder().id(UUID.randomUUID()).name("Chess Club").status(ClubStatus.APPROVED)
                .archived(true).createdBy(student).build();
        when(clubRepository.findById(club.getId())).thenReturn(Optional.of(club));
        when(userRepository.findById(superAdmin.getId())).thenReturn(Optional.of(superAdmin));
        when(clubRepository.save(any(Club.class))).thenAnswer(inv -> inv.getArgument(0));

        assertThat(clubService.unarchiveClub(club.getId(), superAdminPrincipal).archived()).isFalse();
    }


}
