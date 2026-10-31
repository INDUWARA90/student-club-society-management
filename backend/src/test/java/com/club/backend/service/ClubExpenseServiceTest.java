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
import com.club.backend.entity.PaymentStatus;
import com.club.backend.entity.PaymentType;
import com.club.backend.repository.ClubExpenseRepository;
import com.club.backend.repository.ClubRepository;
import com.club.backend.repository.EventRepository;
import com.club.backend.repository.MembershipRepository;
import com.club.backend.repository.PaymentRepository;
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
    @Mock
    private EventRepository eventRepository;
    @Mock
    private PaymentRepository paymentRepository;
    @Mock
    private AuditLogService auditLogService;

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
                .hasMessageContaining("Club President");
    }

    @Test
    void logExpense_treasurer_throws() {
        Membership treasurerMembership = Membership.builder().position(MembershipPosition.TREASURER)
                .status(MembershipStatus.APPROVED).build();
        when(clubRepository.findById(club.getId())).thenReturn(Optional.of(club));
        when(userRepository.findById(treasurer.getId())).thenReturn(Optional.of(treasurer));
        when(membershipRepository.findByUserIdAndClubId(treasurer.getId(), club.getId()))
                .thenReturn(Optional.of(treasurerMembership));

        assertThatThrownBy(() -> expenseService.logExpense(club.getId(),
                new CreateExpenseRequest("Snacks", BigDecimal.TEN), principal))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("Club President");
    }

    @Test
    void logExpense_superAdmin_throws() {
        User superAdmin = User.builder().id(UUID.randomUUID()).name("Admin").email("admin@example.com").role(Role.SUPER_ADMIN).build();
        UserPrincipal adminPrincipal = new UserPrincipal(superAdmin);
        when(clubRepository.findById(club.getId())).thenReturn(Optional.of(club));
        when(userRepository.findById(superAdmin.getId())).thenReturn(Optional.of(superAdmin));

        assertThatThrownBy(() -> expenseService.logExpense(club.getId(),
                new CreateExpenseRequest("Snacks", BigDecimal.TEN), adminPrincipal))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("Super Admins cannot record club expenses");
    }

    @Test
    void logExpense_president_succeeds() {
        Membership presidentMembership = Membership.builder().position(MembershipPosition.PRESIDENT)
                .status(MembershipStatus.APPROVED).build();
        when(clubRepository.findById(club.getId())).thenReturn(Optional.of(club));
        when(userRepository.findById(treasurer.getId())).thenReturn(Optional.of(treasurer));
        when(membershipRepository.findByUserIdAndClubId(treasurer.getId(), club.getId()))
                .thenReturn(Optional.of(presidentMembership));
        when(expenseRepository.save(any(ClubExpense.class))).thenAnswer(inv -> inv.getArgument(0));

        ClubExpenseResponse response = expenseService.logExpense(club.getId(),
                new CreateExpenseRequest("Snacks", BigDecimal.TEN), principal);

        assertThat(response.amount()).isEqualByComparingTo(BigDecimal.TEN);
    }

    @Test
    void computeLedger_noIncome_sumsExpensesAndNegatesBalance() {
        ClubExpense e1 = ClubExpense.builder().club(club).loggedBy(treasurer).description("A")
                .amount(new BigDecimal("30")).build();
        ClubExpense e2 = ClubExpense.builder().club(club).loggedBy(treasurer).description("B")
                .amount(new BigDecimal("20")).build();
        when(expenseRepository.findByClubIdOrderByExpenseDateDesc(club.getId())).thenReturn(List.of(e1, e2));
        when(eventRepository.findByClubId(club.getId())).thenReturn(List.of());
        when(paymentRepository.findByTypeAndReferenceIdAndStatusAndRefundedAtIsNull(PaymentType.MEMBERSHIP, club.getId(), PaymentStatus.SUCCESS))
                .thenReturn(List.of());

        ClubLedgerResponse ledger = expenseService.computeLedger(club.getId());

        assertThat(ledger.totalIncome()).isEqualByComparingTo(BigDecimal.ZERO);
        assertThat(ledger.totalExpenses()).isEqualByComparingTo(new BigDecimal("50"));
        assertThat(ledger.balance()).isEqualByComparingTo(new BigDecimal("-50"));
    }

    @Test
    void computeLedger_withEventAndMembershipIncome_computesBalance() {
        ClubExpense e1 = ClubExpense.builder().club(club).loggedBy(treasurer).description("A")
                .amount(new BigDecimal("30")).build();
        when(expenseRepository.findByClubIdOrderByExpenseDateDesc(club.getId())).thenReturn(List.of(e1));

        com.club.backend.entity.Event event = com.club.backend.entity.Event.builder().id(UUID.randomUUID()).club(club).build();
        when(eventRepository.findByClubId(club.getId())).thenReturn(List.of(event));
        when(paymentRepository.findByTypeAndReferenceIdInAndStatusAndRefundedAtIsNull(PaymentType.EVENT, List.of(event.getId()), PaymentStatus.SUCCESS))
                .thenReturn(List.of(com.club.backend.entity.Payment.builder().amount(new BigDecimal("75")).build()));
        when(paymentRepository.findByTypeAndReferenceIdAndStatusAndRefundedAtIsNull(PaymentType.MEMBERSHIP, club.getId(), PaymentStatus.SUCCESS))
                .thenReturn(List.of(com.club.backend.entity.Payment.builder().amount(new BigDecimal("25")).build()));

        ClubLedgerResponse ledger = expenseService.computeLedger(club.getId());

        assertThat(ledger.totalIncome()).isEqualByComparingTo(new BigDecimal("100"));
        assertThat(ledger.totalExpenses()).isEqualByComparingTo(new BigDecimal("30"));
        assertThat(ledger.balance()).isEqualByComparingTo(new BigDecimal("70"));
    }

    @Test
    void getLedger_regularMember_throws() {
        when(userRepository.findById(treasurer.getId())).thenReturn(Optional.of(treasurer));
        when(clubRepository.findById(club.getId())).thenReturn(Optional.of(club));
        when(membershipRepository.findByUserIdAndClubId(treasurer.getId(), club.getId()))
                .thenReturn(Optional.of(Membership.builder().position(MembershipPosition.MEMBER)
                        .status(MembershipStatus.APPROVED).build()));

        assertThatThrownBy(() -> expenseService.getLedger(club.getId(), principal))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("Only club position members can view the club budget and ledger");
    }

    @Test
    void getLedger_regularMember_withShowBudgetToMembersEnabled_allowed() {
        when(userRepository.findById(treasurer.getId())).thenReturn(Optional.of(treasurer));
        club.setShowBudgetToMembers(true);
        when(clubRepository.findById(club.getId())).thenReturn(Optional.of(club));
        when(membershipRepository.findByUserIdAndClubId(treasurer.getId(), club.getId()))
                .thenReturn(Optional.of(Membership.builder().position(MembershipPosition.MEMBER)
                        .status(MembershipStatus.APPROVED).build()));
        when(expenseRepository.findByClubIdOrderByExpenseDateDesc(club.getId())).thenReturn(List.of());
        when(eventRepository.findByClubId(club.getId())).thenReturn(List.of());
        when(paymentRepository.findByTypeAndReferenceIdAndStatusAndRefundedAtIsNull(PaymentType.MEMBERSHIP, club.getId(), PaymentStatus.SUCCESS))
                .thenReturn(List.of());

        ClubLedgerResponse ledger = expenseService.getLedger(club.getId(), principal);
        assertThat(ledger.balance()).isEqualByComparingTo(BigDecimal.ZERO);
    }

    @Test
    void getLedger_outsider_throws() {
        when(userRepository.findById(treasurer.getId())).thenReturn(Optional.of(treasurer));
        when(clubRepository.findById(club.getId())).thenReturn(Optional.of(club));
        when(membershipRepository.findByUserIdAndClubId(treasurer.getId(), club.getId()))
                .thenReturn(Optional.empty());

        assertThatThrownBy(() -> expenseService.getLedger(club.getId(), principal))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("Only club position members can view the club budget and ledger");
    }

    @Test
    void getLedger_vpOfficer_allowed() {
        when(userRepository.findById(treasurer.getId())).thenReturn(Optional.of(treasurer));
        when(clubRepository.findById(club.getId())).thenReturn(Optional.of(club));
        when(membershipRepository.findByUserIdAndClubId(treasurer.getId(), club.getId()))
                .thenReturn(Optional.of(Membership.builder().position(MembershipPosition.VP)
                        .status(MembershipStatus.APPROVED).build()));
        when(expenseRepository.findByClubIdOrderByExpenseDateDesc(club.getId())).thenReturn(List.of());
        when(eventRepository.findByClubId(club.getId())).thenReturn(List.of());
        when(paymentRepository.findByTypeAndReferenceIdAndStatusAndRefundedAtIsNull(PaymentType.MEMBERSHIP, club.getId(), PaymentStatus.SUCCESS))
                .thenReturn(List.of());

        ClubLedgerResponse ledger = expenseService.getLedger(club.getId(), principal);

        assertThat(ledger.balance()).isEqualByComparingTo(BigDecimal.ZERO);
    }

    @Test
    void getLedger_facultyAdvisor_allowedWithoutMembership() {
        User advisor = User.builder().id(UUID.randomUUID()).name("Advisor").email("advisor@example.com").role(Role.FACULTY_ADVISOR).build();
        UserPrincipal advisorPrincipal = new UserPrincipal(advisor);
        when(userRepository.findById(advisor.getId())).thenReturn(Optional.of(advisor));
        when(expenseRepository.findByClubIdOrderByExpenseDateDesc(club.getId())).thenReturn(List.of());
        when(eventRepository.findByClubId(club.getId())).thenReturn(List.of());
        when(paymentRepository.findByTypeAndReferenceIdAndStatusAndRefundedAtIsNull(PaymentType.MEMBERSHIP, club.getId(), PaymentStatus.SUCCESS))
                .thenReturn(List.of());

        ClubLedgerResponse ledger = expenseService.getLedger(club.getId(), advisorPrincipal);

        assertThat(ledger.balance()).isEqualByComparingTo(BigDecimal.ZERO);
    }

    @Test
    void getLedger_superAdmin_allowedWithoutMembership() {
        User superAdmin = User.builder().id(UUID.randomUUID()).name("Admin").email("admin@example.com").role(Role.SUPER_ADMIN).build();
        UserPrincipal adminPrincipal = new UserPrincipal(superAdmin);
        when(userRepository.findById(superAdmin.getId())).thenReturn(Optional.of(superAdmin));
        when(expenseRepository.findByClubIdOrderByExpenseDateDesc(club.getId())).thenReturn(List.of());
        when(eventRepository.findByClubId(club.getId())).thenReturn(List.of());
        when(paymentRepository.findByTypeAndReferenceIdAndStatusAndRefundedAtIsNull(PaymentType.MEMBERSHIP, club.getId(), PaymentStatus.SUCCESS))
                .thenReturn(List.of());

        ClubLedgerResponse ledger = expenseService.getLedger(club.getId(), adminPrincipal);

        assertThat(ledger.balance()).isEqualByComparingTo(BigDecimal.ZERO);
    }


    private void asTreasurer() {
        when(userRepository.findById(treasurer.getId())).thenReturn(Optional.of(treasurer));
        when(membershipRepository.findByUserIdAndClubId(treasurer.getId(), club.getId()))
                .thenReturn(Optional.of(Membership.builder().position(MembershipPosition.PRESIDENT)
                        .status(MembershipStatus.APPROVED).build()));
    }

    @Test
    void logExpense_futureDate_throws() {
        assertThatThrownBy(() -> expenseService.logExpense(club.getId(), new CreateExpenseRequest(
                "Snacks", BigDecimal.TEN, null, java.time.LocalDate.now().plusDays(30), null), principal))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("future");
    }

    @Test
    void logExpense_eventFromAnotherClub_throws() {
        asTreasurer();
        when(clubRepository.findById(club.getId())).thenReturn(Optional.of(club));
        Club other = Club.builder().id(UUID.randomUUID()).name("Other").build();
        com.club.backend.entity.Event foreign = com.club.backend.entity.Event.builder().id(UUID.randomUUID()).club(other).build();
        when(eventRepository.findById(foreign.getId())).thenReturn(Optional.of(foreign));

        assertThatThrownBy(() -> expenseService.logExpense(club.getId(), new CreateExpenseRequest(
                "Pizza", BigDecimal.TEN, "Food", null, foreign.getId()), principal))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("doesn't belong");
    }

    @Test
    void logExpense_storesCategoryDateAndEventLink_andAudits() {
        asTreasurer();
        when(clubRepository.findById(club.getId())).thenReturn(Optional.of(club));
        com.club.backend.entity.Event event = com.club.backend.entity.Event.builder().id(UUID.randomUUID())
                .club(club).title("Hack Night").build();
        when(eventRepository.findById(event.getId())).thenReturn(Optional.of(event));
        when(expenseRepository.save(any(ClubExpense.class))).thenAnswer(inv -> inv.getArgument(0));
        java.time.LocalDate day = java.time.LocalDate.now().minusDays(3);

        ClubExpenseResponse response = expenseService.logExpense(club.getId(),
                new CreateExpenseRequest("Pizza", BigDecimal.TEN, " Food ", day, event.getId()), principal);

        assertThat(response.category()).isEqualTo("Food");
        assertThat(response.expenseDate()).isEqualTo(day);
        assertThat(response.eventTitle()).isEqualTo("Hack Night");
        org.mockito.Mockito.verify(auditLogService).log(org.mockito.ArgumentMatchers.eq(treasurer),
                org.mockito.ArgumentMatchers.eq("LOG_EXPENSE"), org.mockito.ArgumentMatchers.eq("EXPENSE"),
                any(), any(String.class));
    }

    @Test
    void updateExpense_changesFieldsAndAudits() {
        asTreasurer();
        ClubExpense expense = ClubExpense.builder().id(UUID.randomUUID()).club(club).loggedBy(treasurer)
                .description("Old").amount(new BigDecimal("5")).build();
        when(expenseRepository.findById(expense.getId())).thenReturn(Optional.of(expense));
        when(expenseRepository.save(any(ClubExpense.class))).thenAnswer(inv -> inv.getArgument(0));

        ClubExpenseResponse response = expenseService.updateExpense(club.getId(), expense.getId(),
                new CreateExpenseRequest("New", new BigDecimal("8")), principal);

        assertThat(response.description()).isEqualTo("New");
        assertThat(response.amount()).isEqualByComparingTo("8");
        org.mockito.Mockito.verify(auditLogService).log(org.mockito.ArgumentMatchers.eq(treasurer),
                org.mockito.ArgumentMatchers.eq("UPDATE_EXPENSE"), any(String.class), any(), any(String.class));
    }

    @Test
    void updateExpense_byRegularMember_forbidden() {
        ClubExpense expense = ClubExpense.builder().id(UUID.randomUUID()).club(club).loggedBy(treasurer)
                .description("Old").amount(BigDecimal.TEN).build();
        when(expenseRepository.findById(expense.getId())).thenReturn(Optional.of(expense));
        when(userRepository.findById(treasurer.getId())).thenReturn(Optional.of(treasurer));
        when(membershipRepository.findByUserIdAndClubId(treasurer.getId(), club.getId()))
                .thenReturn(Optional.of(Membership.builder().position(MembershipPosition.MEMBER)
                        .status(MembershipStatus.APPROVED).build()));

        assertThatThrownBy(() -> expenseService.updateExpense(club.getId(), expense.getId(),
                new CreateExpenseRequest("New", BigDecimal.ONE), principal))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("Club President");
    }

    @Test
    void deleteExpense_isAuditedBeforeItDisappears() {
        asTreasurer();
        ClubExpense expense = ClubExpense.builder().id(UUID.randomUUID()).club(club).loggedBy(treasurer)
                .description("Snacks").amount(new BigDecimal("12")).build();
        when(expenseRepository.findById(expense.getId())).thenReturn(Optional.of(expense));

        expenseService.deleteExpense(club.getId(), expense.getId(), principal);

        org.mockito.InOrder order = org.mockito.Mockito.inOrder(auditLogService, expenseRepository);
        order.verify(auditLogService).log(org.mockito.ArgumentMatchers.eq(treasurer),
                org.mockito.ArgumentMatchers.eq("DELETE_EXPENSE"), any(String.class), any(), any(String.class));
        order.verify(expenseRepository).delete(expense);
    }

    @Test
    void deleteExpense_fromAnotherClub_notFound() {
        Club other = Club.builder().id(UUID.randomUUID()).name("Other").build();
        ClubExpense expense = ClubExpense.builder().id(UUID.randomUUID()).club(other).loggedBy(treasurer)
                .description("Snacks").amount(BigDecimal.TEN).build();
        when(expenseRepository.findById(expense.getId())).thenReturn(Optional.of(expense));

        assertThatThrownBy(() -> expenseService.deleteExpense(club.getId(), expense.getId(), principal))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("not found");
    }

    @Test
    void computeLedger_dateRange_limitsBothExpensesAndIncome() {
        java.time.LocalDate today = java.time.LocalDate.now();
        ClubExpense inRange = ClubExpense.builder().club(club).loggedBy(treasurer).description("In")
                .amount(new BigDecimal("10")).expenseDate(today.minusDays(2)).build();
        ClubExpense outOfRange = ClubExpense.builder().club(club).loggedBy(treasurer).description("Out")
                .amount(new BigDecimal("99")).expenseDate(today.minusDays(60)).build();
        when(expenseRepository.findByClubIdOrderByExpenseDateDesc(club.getId())).thenReturn(List.of(inRange, outOfRange));
        when(eventRepository.findByClubId(club.getId())).thenReturn(List.of());
        com.club.backend.entity.Payment recent = com.club.backend.entity.Payment.builder().amount(new BigDecimal("40"))
                .paidAt(java.time.Instant.now().minusSeconds(86_400)).build();
        com.club.backend.entity.Payment old = com.club.backend.entity.Payment.builder().amount(new BigDecimal("500"))
                .paidAt(java.time.Instant.now().minusSeconds(90L * 86_400)).build();
        when(paymentRepository.findByTypeAndReferenceIdAndStatusAndRefundedAtIsNull(
                PaymentType.MEMBERSHIP, club.getId(), PaymentStatus.SUCCESS)).thenReturn(List.of(recent, old));

        ClubLedgerResponse ledger = expenseService.computeLedger(club.getId(), today.minusDays(30), today);

        assertThat(ledger.totalExpenses()).isEqualByComparingTo("10");
        assertThat(ledger.totalIncome()).isEqualByComparingTo("40");
        assertThat(ledger.balance()).isEqualByComparingTo("30");
    }


    @Test
    void computeLedger_showsBudgetSpendAndIncomePerEvent() {
        com.club.backend.entity.Event gala = com.club.backend.entity.Event.builder().id(UUID.randomUUID()).club(club)
                .title("Gala").budget(new BigDecimal("1000")).build();
        com.club.backend.entity.Event quiet = com.club.backend.entity.Event.builder().id(UUID.randomUUID()).club(club)
                .title("Quiet meetup").build();
        com.club.backend.entity.Event unbudgeted = com.club.backend.entity.Event.builder().id(UUID.randomUUID()).club(club)
                .title("Unbudgeted").build();
        ClubExpense food = ClubExpense.builder().club(club).loggedBy(treasurer).description("Food")
                .amount(new BigDecimal("300")).event(gala).build();
        ClubExpense venue = ClubExpense.builder().club(club).loggedBy(treasurer).description("Venue")
                .amount(new BigDecimal("450")).event(gala).build();
        ClubExpense unplanned = ClubExpense.builder().club(club).loggedBy(treasurer).description("Posters")
                .amount(new BigDecimal("60")).event(unbudgeted).build();
        when(expenseRepository.findByClubIdOrderByExpenseDateDesc(club.getId())).thenReturn(List.of(food, venue, unplanned));
        when(eventRepository.findByClubId(club.getId())).thenReturn(List.of(gala, quiet, unbudgeted));
        when(paymentRepository.findByTypeAndReferenceIdInAndStatusAndRefundedAtIsNull(
                org.mockito.ArgumentMatchers.eq(PaymentType.EVENT), any(), org.mockito.ArgumentMatchers.eq(PaymentStatus.SUCCESS)))
                .thenReturn(List.of(
                        com.club.backend.entity.Payment.builder().referenceId(gala.getId()).amount(new BigDecimal("200")).build(),
                        com.club.backend.entity.Payment.builder().referenceId(gala.getId()).amount(new BigDecimal("200")).build()));

        ClubLedgerResponse ledger = expenseService.computeLedger(club.getId());

        assertThat(ledger.eventBudgets()).extracting(ClubLedgerResponse.EventBudgetLine::title)
                .containsExactly("Gala", "Unbudgeted");   // events with no budget and no money are left out
        ClubLedgerResponse.EventBudgetLine galaLine = ledger.eventBudgets().get(0);
        assertThat(galaLine.budget()).isEqualByComparingTo("1000");
        assertThat(galaLine.spent()).isEqualByComparingTo("750");
        assertThat(galaLine.income()).isEqualByComparingTo("400");
        assertThat(galaLine.remaining()).isEqualByComparingTo("250");
        ClubLedgerResponse.EventBudgetLine other = ledger.eventBudgets().get(1);
        assertThat(other.budget()).isNull();
        assertThat(other.remaining()).isNull();
        assertThat(other.spent()).isEqualByComparingTo("60");
    }

    @Test
    void logIncome_president_succeeds() {
        asTreasurer();
        when(clubRepository.findById(club.getId())).thenReturn(Optional.of(club));
        when(expenseRepository.save(any(ClubExpense.class))).thenAnswer(inv -> inv.getArgument(0));

        ClubExpenseResponse response = expenseService.logExpense(club.getId(),
                new CreateExpenseRequest("Sponsorship Grant", new BigDecimal("500"), "Sponsorship", null, null,
                        com.club.backend.entity.ExpenseType.INCOME), principal);

        assertThat(response.amount()).isEqualByComparingTo("500");
        assertThat(response.type()).isEqualTo(com.club.backend.entity.ExpenseType.INCOME);
        org.mockito.Mockito.verify(auditLogService).log(org.mockito.ArgumentMatchers.eq(treasurer),
                org.mockito.ArgumentMatchers.eq("LOG_INCOME"), org.mockito.ArgumentMatchers.eq("EXPENSE"),
                any(), any(String.class));
    }

    @Test
    void computeLedger_withManualIncomeAndEventIncome_computesBalance() {
        ClubExpense expense = ClubExpense.builder().club(club).loggedBy(treasurer).description("Food")
                .amount(new BigDecimal("150")).entryType(com.club.backend.entity.ExpenseType.EXPENSE).build();
        ClubExpense income = ClubExpense.builder().club(club).loggedBy(treasurer).description("Sponsor")
                .amount(new BigDecimal("400")).entryType(com.club.backend.entity.ExpenseType.INCOME).build();
        when(expenseRepository.findByClubIdOrderByExpenseDateDesc(club.getId())).thenReturn(List.of(expense, income));
        when(eventRepository.findByClubId(club.getId())).thenReturn(List.of());
        when(paymentRepository.findByTypeAndReferenceIdAndStatusAndRefundedAtIsNull(PaymentType.MEMBERSHIP, club.getId(), PaymentStatus.SUCCESS))
                .thenReturn(List.of(com.club.backend.entity.Payment.builder().amount(new BigDecimal("50")).build()));

        ClubLedgerResponse ledger = expenseService.computeLedger(club.getId());

        // Total income = 50 (membership) + 400 (manual income) = 450
        // Total expenses = 150
        // Balance = 450 - 150 = 300
        assertThat(ledger.totalIncome()).isEqualByComparingTo(new BigDecimal("450"));
        assertThat(ledger.totalExpenses()).isEqualByComparingTo(new BigDecimal("150"));
        assertThat(ledger.balance()).isEqualByComparingTo(new BigDecimal("300"));
    }

    @Test
    void computeLedger_withCompletedEvent_tracksRemainingBudgetAndNet() {
        java.time.Instant pastDate = java.time.Instant.now().minusSeconds(86400 * 5);
        com.club.backend.entity.Event hackathon = com.club.backend.entity.Event.builder()
                .id(UUID.randomUUID()).club(club).title("Hackathon 2026")
                .eventDate(pastDate).budget(new BigDecimal("1000")).build();

        ClubExpense food = ClubExpense.builder().club(club).loggedBy(treasurer).description("Dinner")
                .amount(new BigDecimal("600")).entryType(com.club.backend.entity.ExpenseType.EXPENSE)
                .event(hackathon).build();
        ClubExpense prizeDonation = ClubExpense.builder().club(club).loggedBy(treasurer).description("Prize Grant")
                .amount(new BigDecimal("250")).entryType(com.club.backend.entity.ExpenseType.INCOME)
                .event(hackathon).build();

        when(expenseRepository.findByClubIdOrderByExpenseDateDesc(club.getId())).thenReturn(List.of(food, prizeDonation));
        when(eventRepository.findByClubId(club.getId())).thenReturn(List.of(hackathon));
        when(paymentRepository.findByTypeAndReferenceIdInAndStatusAndRefundedAtIsNull(
                org.mockito.ArgumentMatchers.eq(PaymentType.EVENT), any(), org.mockito.ArgumentMatchers.eq(PaymentStatus.SUCCESS)))
                .thenReturn(List.of(com.club.backend.entity.Payment.builder().referenceId(hackathon.getId()).amount(new BigDecimal("100")).build()));
        when(paymentRepository.findByTypeAndReferenceIdAndStatusAndRefundedAtIsNull(PaymentType.MEMBERSHIP, club.getId(), PaymentStatus.SUCCESS))
                .thenReturn(List.of());

        ClubLedgerResponse ledger = expenseService.computeLedger(club.getId());

        assertThat(ledger.eventBudgets()).hasSize(1);
        ClubLedgerResponse.EventBudgetLine line = ledger.eventBudgets().get(0);
        assertThat(line.title()).isEqualTo("Hackathon 2026");
        assertThat(line.budget()).isEqualByComparingTo("1000");
        assertThat(line.spent()).isEqualByComparingTo("600");
        // income = 100 (tickets) + 250 (prize donation) = 350
        assertThat(line.income()).isEqualByComparingTo("350");
        // remaining unspent budget = 1000 - 600 = 400
        assertThat(line.remaining()).isEqualByComparingTo("400");
        // net = 350 - 600 = -250
        assertThat(line.net()).isEqualByComparingTo("-250");
        // event date was 5 days ago, so it is completed
        assertThat(line.completed()).isTrue();
    }

    @Test
    void exportLedgerCsv_returnsFormattedCsv() {
        when(userRepository.findById(treasurer.getId())).thenReturn(Optional.of(treasurer));
        Membership presidentMembership = Membership.builder().position(MembershipPosition.PRESIDENT)
                .status(MembershipStatus.APPROVED).build();
        when(membershipRepository.findByUserIdAndClubId(treasurer.getId(), club.getId()))
                .thenReturn(Optional.of(presidentMembership));

        com.club.backend.entity.Event hackathon = com.club.backend.entity.Event.builder()
                .id(UUID.randomUUID()).club(club).title("Hackathon").build();

        ClubExpense income = ClubExpense.builder().id(UUID.randomUUID()).club(club).loggedBy(treasurer)
                .description("Sponsorship").amount(new BigDecimal("500.00")).category("Sponsorship")
                .event(hackathon).expenseDate(java.time.LocalDate.of(2026, 10, 15))
                .entryType(com.club.backend.entity.ExpenseType.INCOME).build();

        ClubExpense expense = ClubExpense.builder().id(UUID.randomUUID()).club(club).loggedBy(treasurer)
                .description("Catering").amount(new BigDecimal("150.00")).category("Food")
                .event(hackathon).expenseDate(java.time.LocalDate.of(2026, 10, 16))
                .entryType(com.club.backend.entity.ExpenseType.EXPENSE).build();

        when(expenseRepository.findByClubIdOrderByExpenseDateDesc(club.getId())).thenReturn(List.of(expense, income));

        String csv = expenseService.exportLedgerCsv(club.getId(), null, null, principal);

        assertThat(csv).contains("Transaction ID,Type,Date,Description,Category,Event,Amount,Logged By");
        assertThat(csv).contains("\"INCOME\",\"2026-10-15\",\"Sponsorship\",\"Sponsorship\",\"Hackathon\",500.00,\"Treasurer\"");
        assertThat(csv).contains("\"EXPENSE\",\"2026-10-16\",\"Catering\",\"Food\",\"Hackathon\",150.00,\"Treasurer\"");
    }

    @Test
    void exportLedgerCsv_regularMember_throws() {
        when(userRepository.findById(treasurer.getId())).thenReturn(Optional.of(treasurer));
        Membership memberMembership = Membership.builder().position(MembershipPosition.MEMBER)
                .status(MembershipStatus.APPROVED).build();
        when(membershipRepository.findByUserIdAndClubId(treasurer.getId(), club.getId()))
                .thenReturn(Optional.of(memberMembership));

        assertThatThrownBy(() -> expenseService.exportLedgerCsv(club.getId(), null, null, principal))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("Only the Club President can export the ledger CSV");
    }
}
