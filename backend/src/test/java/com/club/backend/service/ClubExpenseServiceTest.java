package com.club.backend.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
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

import com.club.backend.config.ApiException;
import com.club.backend.dto.ClubExpenseResponse;
import com.club.backend.dto.ClubLedgerResponse;
import com.club.backend.dto.CreateExpenseRequest;
import com.club.backend.entity.Club;
import com.club.backend.entity.ClubExpense;
import com.club.backend.entity.Membership;
import com.club.backend.entity.MembershipPosition;
import com.club.backend.entity.MembershipStatus;
import com.club.backend.entity.Role;
import com.club.backend.entity.User;
import com.club.backend.repository.ClubExpenseRepository;
import com.club.backend.repository.ClubRepository;
import com.club.backend.repository.MembershipRepository;
import com.club.backend.repository.UserRepository;
import com.club.backend.security.UserPrincipal;

@ExtendWith(MockitoExtension.class)
class ClubExpenseServiceTest {

    @Mock
    private ClubExpenseRepository expenseRepository;
    @Mock
    private ClubRepository clubRepository;
    @Mock
    private MembershipRepository membershipRepository;
    @Mock
    private UserRepository userRepository;

    @InjectMocks
    private ClubExpenseService expenseService;

    private User treasurer;
    private Club club;
    private UserPrincipal principal;

    @BeforeEach
    void setUp() {
        treasurer = User.builder().id(UUID.randomUUID()).name("Treasurer").email("treasurer@example.com").role(Role.STUDENT).build();
        club = Club.builder().id(UUID.randomUUID()).name("Chess Club").build();
        principal = new UserPrincipal(treasurer);
    }

    @Test
    void logExpense_zeroAmount_throws() {
        assertThatThrownBy(() -> expenseService.logExpense(club.getId(),
                new CreateExpenseRequest("Snacks", BigDecimal.ZERO), principal))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("greater than zero");
    }

    @Test
    void logExpense_regularMember_throws() {
        Membership memberMembership = Membership.builder().position(MembershipPosition.MEMBER)
                .status(MembershipStatus.APPROVED).build();
        when(clubRepository.findById(club.getId())).thenReturn(Optional.of(club));
        when(userRepository.findById(treasurer.getId())).thenReturn(Optional.of(treasurer));
        when(membershipRepository.findByUserIdAndClubId(treasurer.getId(), club.getId()))
                .thenReturn(Optional.of(memberMembership));

        assertThatThrownBy(() -> expenseService.logExpense(club.getId(),
                new CreateExpenseRequest("Snacks", BigDecimal.TEN), principal))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("Treasurer or Club Admin");
    }

    @Test
    void logExpense_treasurer_succeeds() {
        Membership treasurerMembership = Membership.builder().position(MembershipPosition.TREASURER)
                .status(MembershipStatus.APPROVED).build();
        when(clubRepository.findById(club.getId())).thenReturn(Optional.of(club));
        when(userRepository.findById(treasurer.getId())).thenReturn(Optional.of(treasurer));
        when(membershipRepository.findByUserIdAndClubId(treasurer.getId(), club.getId()))
                .thenReturn(Optional.of(treasurerMembership));
        when(expenseRepository.save(any(ClubExpense.class))).thenAnswer(inv -> inv.getArgument(0));

        ClubExpenseResponse response = expenseService.logExpense(club.getId(),
                new CreateExpenseRequest("Snacks", BigDecimal.TEN), principal);

        assertThat(response.amount()).isEqualByComparingTo(BigDecimal.TEN);
    }

    @Test
    void getLedger_sumsExpensesAndNegatesBalance() {
        ClubExpense e1 = ClubExpense.builder().club(club).loggedBy(treasurer).description("A")
                .amount(new BigDecimal("30")).build();
        ClubExpense e2 = ClubExpense.builder().club(club).loggedBy(treasurer).description("B")
                .amount(new BigDecimal("20")).build();
        when(expenseRepository.findByClubIdOrderByExpenseDateDesc(club.getId())).thenReturn(List.of(e1, e2));

        ClubLedgerResponse ledger = expenseService.getLedger(club.getId());

        assertThat(ledger.totalExpenses()).isEqualByComparingTo(new BigDecimal("50"));
        assertThat(ledger.balance()).isEqualByComparingTo(new BigDecimal("-50"));
    }
}
