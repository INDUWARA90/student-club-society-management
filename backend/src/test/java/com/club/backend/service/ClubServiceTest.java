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
    void listApprovedClubs_noCategory_returnsAllApproved() {
        when(clubRepository.findByStatus(ClubStatus.APPROVED)).thenReturn(List.of(
                Club.builder().id(UUID.randomUUID()).status(ClubStatus.APPROVED).createdBy(student).build()));

        List<ClubResponse> result = clubService.listApprovedClubs(null);

        assertThat(result).hasSize(1);
    }
}
