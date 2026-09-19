package com.club.backend.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import com.club.backend.dto.ClubLedgerResponse;
import com.club.backend.dto.ClubStatsResponse;
import com.club.backend.entity.Membership;
import com.club.backend.entity.MembershipPosition;
import com.club.backend.entity.MembershipStatus;
import com.club.backend.entity.Role;
import com.club.backend.entity.User;
import com.club.backend.repository.AttendanceRepository;
import com.club.backend.repository.ClubRepository;
import com.club.backend.repository.EventRepository;
import com.club.backend.repository.MembershipRepository;
import com.club.backend.repository.PaymentRepository;
import com.club.backend.repository.RsvpRepository;
import com.club.backend.repository.UserRepository;
import com.club.backend.security.UserPrincipal;

@ExtendWith(MockitoExtension.class)
class AnalyticsServiceTest {

    @Mock
    private MembershipRepository membershipRepository;
    @Mock
    private EventRepository eventRepository;
    @Mock
    private RsvpRepository rsvpRepository;
    @Mock
    private AttendanceRepository attendanceRepository;
    @Mock
    private ClubRepository clubRepository;
    @Mock
    private UserRepository userRepository;
    @Mock
    private PaymentRepository paymentRepository;
    @Mock
    private ClubExpenseService clubExpenseService;

    @InjectMocks
    private AnalyticsService analyticsService;

    private User member;
    private UUID clubId;

    @BeforeEach
    void setUp() {
        member = User.builder().id(UUID.randomUUID()).name("Mem").email("mem@example.com").role(Role.STUDENT).build();
        clubId = UUID.randomUUID();
    }

    @Test
    void getClubStats_regularMember_financialFieldsZeroed() {
        UserPrincipal principal = new UserPrincipal(member);
        Membership memberMembership = Membership.builder().position(MembershipPosition.MEMBER)
                .status(MembershipStatus.APPROVED).build();
        when(userRepository.findById(member.getId())).thenReturn(Optional.of(member));
        when(membershipRepository.findByUserIdAndClubId(member.getId(), clubId)).thenReturn(Optional.of(memberMembership));
        when(membershipRepository.findByClubIdAndStatus(clubId, MembershipStatus.APPROVED)).thenReturn(List.of());
        when(eventRepository.findByClubId(clubId)).thenReturn(List.of());

        ClubStatsResponse stats = analyticsService.getClubStats(clubId, principal);

        assertThat(stats.totalIncome()).isEqualByComparingTo(BigDecimal.ZERO);
        assertThat(stats.totalExpenses()).isEqualByComparingTo(BigDecimal.ZERO);
        assertThat(stats.balance()).isEqualByComparingTo(BigDecimal.ZERO);
    }

    @Test
    void getClubStats_officer_financialFieldsPopulated() {
        UserPrincipal principal = new UserPrincipal(member);
        Membership presidentMembership = Membership.builder().position(MembershipPosition.PRESIDENT)
                .status(MembershipStatus.APPROVED).build();
        when(userRepository.findById(member.getId())).thenReturn(Optional.of(member));
        when(membershipRepository.findByUserIdAndClubId(member.getId(), clubId)).thenReturn(Optional.of(presidentMembership));
        when(membershipRepository.findByClubIdAndStatus(clubId, MembershipStatus.APPROVED)).thenReturn(List.of());
        when(eventRepository.findByClubId(clubId)).thenReturn(List.of());
        when(clubExpenseService.computeLedger(clubId)).thenReturn(
                new ClubLedgerResponse(new BigDecimal("100"), new BigDecimal("40"), new BigDecimal("60"), List.of()));

        ClubStatsResponse stats = analyticsService.getClubStats(clubId, principal);

        assertThat(stats.totalIncome()).isEqualByComparingTo(new BigDecimal("100"));
        assertThat(stats.totalExpenses()).isEqualByComparingTo(new BigDecimal("40"));
        assertThat(stats.balance()).isEqualByComparingTo(new BigDecimal("60"));
    }

    @Test
    void getClubStats_superAdmin_financialFieldsPopulatedWithoutMembership() {
        User superAdmin = User.builder().id(UUID.randomUUID()).name("Admin").email("admin@example.com").role(Role.SUPER_ADMIN).build();
        UserPrincipal principal = new UserPrincipal(superAdmin);
        when(userRepository.findById(superAdmin.getId())).thenReturn(Optional.of(superAdmin));
        when(membershipRepository.findByClubIdAndStatus(clubId, MembershipStatus.APPROVED)).thenReturn(List.of());
        when(eventRepository.findByClubId(clubId)).thenReturn(List.of());
        when(clubExpenseService.computeLedger(clubId)).thenReturn(
                new ClubLedgerResponse(new BigDecimal("50"), BigDecimal.ZERO, new BigDecimal("50"), List.of()));

        ClubStatsResponse stats = analyticsService.getClubStats(clubId, principal);

        assertThat(stats.totalIncome()).isEqualByComparingTo(new BigDecimal("50"));
    }
}
