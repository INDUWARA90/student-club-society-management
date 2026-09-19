package com.club.backend.service;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.club.backend.config.ApiException;
import com.club.backend.dto.ClubExpenseResponse;
import com.club.backend.dto.ClubLedgerResponse;
import com.club.backend.dto.CreateExpenseRequest;
import com.club.backend.entity.Club;
import com.club.backend.entity.ClubExpense;
import com.club.backend.entity.Event;
import com.club.backend.entity.Membership;
import com.club.backend.entity.MembershipPosition;
import com.club.backend.entity.MembershipStatus;
import com.club.backend.entity.Payment;
import com.club.backend.entity.PaymentStatus;
import com.club.backend.entity.PaymentType;
import com.club.backend.entity.Role;
import com.club.backend.entity.User;
import com.club.backend.repository.ClubExpenseRepository;
import com.club.backend.repository.ClubRepository;
import com.club.backend.repository.EventRepository;
import com.club.backend.repository.MembershipRepository;
import com.club.backend.repository.PaymentRepository;
import com.club.backend.repository.UserRepository;
import com.club.backend.security.UserPrincipal;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
@Transactional
public class ClubExpenseService {

    private static final BigDecimal MAX_EXPENSE = new BigDecimal("10000000");

    private static final Set<MembershipPosition> EXPENSE_LOGGER_POSITIONS = Set.of(
            MembershipPosition.PRESIDENT, MembershipPosition.TREASURER);

    private static final Set<MembershipPosition> LEDGER_VIEWER_POSITIONS = Set.of(
            MembershipPosition.PRESIDENT, MembershipPosition.VP,
            MembershipPosition.SECRETARY, MembershipPosition.TREASURER);

    private final ClubExpenseRepository expenseRepository;
    private final ClubRepository clubRepository;
    private final MembershipRepository membershipRepository;
    private final UserRepository userRepository;
    private final EventRepository eventRepository;
    private final PaymentRepository paymentRepository;
    private final AuditLogService auditLogService;

    public ClubExpenseResponse logExpense(UUID clubId, CreateExpenseRequest request, UserPrincipal principal) {
        validate(request);

        Club club = clubRepository.findById(clubId)
                .orElseThrow(() -> ApiException.notFound("Club not found"));

        User loggedBy = userRepository.findById(principal.getId())
                .orElseThrow(() -> ApiException.notFound("User not found"));

        requireExpenseManager(loggedBy.getId(), clubId, "Only the Treasurer or Club Admin can log expenses");

        ClubExpense expense = ClubExpense.builder()
                .club(club)
                .loggedBy(loggedBy)
                .description(request.description().trim())
                .amount(request.amount())
                .category(cleanCategory(request.category()))
                .event(resolveEvent(request.eventId(), clubId))
                .expenseDate(request.expenseDate() != null ? request.expenseDate() : LocalDate.now())
                .build();
        expense = expenseRepository.save(expense);

        auditLogService.log(loggedBy, "LOG_EXPENSE", "EXPENSE", expense.getId(), describe(expense));

        return ClubExpenseResponse.from(expense);
    }

    public ClubExpenseResponse updateExpense(UUID clubId, UUID expenseId, CreateExpenseRequest request,
            UserPrincipal principal) {
        validate(request);

        ClubExpense expense = findExpenseInClub(clubId, expenseId);
        User actor = userRepository.findById(principal.getId())
                .orElseThrow(() -> ApiException.notFound("User not found"));
        requireExpenseManager(actor.getId(), clubId, "Only the Treasurer or Club Admin can edit expenses");

        String before = describe(expense);
        expense.setDescription(request.description().trim());
        expense.setAmount(request.amount());
        expense.setCategory(cleanCategory(request.category()));
        expense.setEvent(resolveEvent(request.eventId(), clubId));
        if (request.expenseDate() != null) {
            expense.setExpenseDate(request.expenseDate());
        }
        expense = expenseRepository.save(expense);

        auditLogService.log(actor, "UPDATE_EXPENSE", "EXPENSE", expense.getId(), truncate(before + " → " + describe(expense)));

        return ClubExpenseResponse.from(expense);
    }

    /** Deleting is allowed but never silent: the removed entry is written to the audit log first. */
    public void deleteExpense(UUID clubId, UUID expenseId, UserPrincipal principal) {
        ClubExpense expense = findExpenseInClub(clubId, expenseId);
        User actor = userRepository.findById(principal.getId())
                .orElseThrow(() -> ApiException.notFound("User not found"));

        requireExpenseManager(actor.getId(), clubId, "Only the Treasurer or Club Admin can delete expenses");

        auditLogService.log(actor, "DELETE_EXPENSE", "EXPENSE", expense.getId(), describe(expense));
        expenseRepository.delete(expense);
    }

    /** Officers of the club (any position) and Super Admin / Faculty Advisor may view finances; nobody else. */
    public ClubLedgerResponse getLedger(UUID clubId, UserPrincipal principal) {
        return getLedger(clubId, null, null, principal);
    }

    /** As above, optionally restricted to a date range (inclusive) — e.g. one semester. */
    public ClubLedgerResponse getLedger(UUID clubId, LocalDate from, LocalDate to, UserPrincipal principal) {
        User viewer = userRepository.findById(principal.getId())
                .orElseThrow(() -> ApiException.notFound("User not found"));

        boolean isUniversityStaff = viewer.getRole() == Role.SUPER_ADMIN || viewer.getRole() == Role.FACULTY_ADVISOR;
        boolean isClubOfficer = membershipRepository.findByUserIdAndClubId(viewer.getId(), clubId)
                .filter(m -> m.getStatus() == MembershipStatus.APPROVED)
                .map(m -> LEDGER_VIEWER_POSITIONS.contains(m.getPosition()))
                .orElse(false);

        if (!isUniversityStaff && !isClubOfficer) {
            throw ApiException.forbidden("Only club officers can view club finances");
        }

        return computeLedger(clubId, from, to);
    }

    ClubLedgerResponse computeLedger(UUID clubId) {
        return computeLedger(clubId, null, null);
    }

    /**
     * Income = live (successful, not refunded) event-fee payments for this club's events + live membership payments
     * for this club. Refunded payments are excluded, so cancelling an event or RSVP takes its income back out.
     */
    ClubLedgerResponse computeLedger(UUID clubId, LocalDate from, LocalDate to) {
        List<ClubExpense> expenses = expenseRepository.findByClubIdOrderByExpenseDateDesc(clubId).stream()
                .filter(e -> from == null || !e.getExpenseDate().isBefore(from))
                .filter(e -> to == null || !e.getExpenseDate().isAfter(to))
                .toList();
        BigDecimal totalExpenses = expenses.stream().map(ClubExpense::getAmount).reduce(BigDecimal.ZERO, BigDecimal::add);
        List<ClubExpenseResponse> expenseResponses = expenses.stream().map(ClubExpenseResponse::from).toList();

        List<Event> events = eventRepository.findByClubId(clubId);
        List<UUID> eventIds = events.stream().map(Event::getId).toList();
        List<Payment> eventPayments = eventIds.isEmpty() ? List.of()
                : paymentRepository.findByTypeAndReferenceIdInAndStatusAndRefundedAtIsNull(
                        PaymentType.EVENT, eventIds, PaymentStatus.SUCCESS);
        BigDecimal eventIncome = sum(eventPayments, from, to);
        BigDecimal membershipIncome = sum(paymentRepository.findByTypeAndReferenceIdAndStatusAndRefundedAtIsNull(
                PaymentType.MEMBERSHIP, clubId, PaymentStatus.SUCCESS), from, to);
        BigDecimal totalIncome = eventIncome.add(membershipIncome);

        return new ClubLedgerResponse(totalIncome, totalExpenses, totalIncome.subtract(totalExpenses), expenseResponses,
                budgetLines(events, expenses, eventPayments, from, to));
    }

    /** Per-event budget vs spend vs income, for events that have a budget or any linked money movement. */
    private List<ClubLedgerResponse.EventBudgetLine> budgetLines(List<Event> events, List<ClubExpense> expenses,
            List<Payment> eventPayments, LocalDate from, LocalDate to) {
        Map<UUID, BigDecimal> spentByEvent = new HashMap<>();
        for (ClubExpense expense : expenses) {
            if (expense.getEvent() != null) {
                spentByEvent.merge(expense.getEvent().getId(), expense.getAmount(), BigDecimal::add);
            }
        }
        Map<UUID, BigDecimal> incomeByEvent = new HashMap<>();
        for (Payment payment : eventPayments) {
            if (inRange(payment, from, to)) {
                incomeByEvent.merge(payment.getReferenceId(), payment.getAmount(), BigDecimal::add);
            }
        }

        List<ClubLedgerResponse.EventBudgetLine> lines = new ArrayList<>();
        for (Event event : events) {
            BigDecimal spent = spentByEvent.getOrDefault(event.getId(), BigDecimal.ZERO);
            BigDecimal income = incomeByEvent.getOrDefault(event.getId(), BigDecimal.ZERO);
            if (event.getBudget() == null && spent.signum() == 0 && income.signum() == 0) {
                continue;
            }
            BigDecimal remaining = event.getBudget() == null ? null : event.getBudget().subtract(spent);
            lines.add(new ClubLedgerResponse.EventBudgetLine(
                    event.getId(), event.getTitle(), event.getBudget(), spent, income, remaining));
        }
        lines.sort(Comparator.comparing(ClubLedgerResponse.EventBudgetLine::title));
        return lines;
    }

    private boolean inRange(Payment payment, LocalDate from, LocalDate to) {
        LocalDate day = payment.getPaidAt().atZone(ZoneOffset.UTC).toLocalDate();
        return (from == null || !day.isBefore(from)) && (to == null || !day.isAfter(to));
    }

    private BigDecimal sum(List<Payment> payments, LocalDate from, LocalDate to) {
        return payments.stream()
                .filter(p -> from == null || !p.getPaidAt().atZone(ZoneOffset.UTC).toLocalDate().isBefore(from))
                .filter(p -> to == null || !p.getPaidAt().atZone(ZoneOffset.UTC).toLocalDate().isAfter(to))
                .map(Payment::getAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
    }

    private void validate(CreateExpenseRequest request) {
        if (request.description() == null || request.description().trim().isEmpty()) {
            throw ApiException.badRequest("Expense description is required");
        }
        if (request.description().trim().length() > 255) {
            throw ApiException.badRequest("Expense description must be 255 characters or fewer");
        }
        if (request.amount() == null || request.amount().compareTo(BigDecimal.ZERO) <= 0) {
            throw ApiException.badRequest("Expense amount must be greater than zero");
        }
        if (request.amount().compareTo(MAX_EXPENSE) > 0) {
            throw ApiException.badRequest("Expense amount is too large");
        }
        if (request.expenseDate() != null && request.expenseDate().isAfter(LocalDate.now().plusDays(1))) {
            throw ApiException.badRequest("Expense date can't be in the future");
        }
    }

    private String cleanCategory(String category) {
        if (category == null || category.isBlank()) {
            return null;
        }
        String trimmed = category.trim();
        if (trimmed.length() > 50) {
            throw ApiException.badRequest("Category must be 50 characters or fewer");
        }
        return trimmed;
    }

    /** An expense may be tied to one of the club's own events (for per-event cost reporting). */
    private Event resolveEvent(UUID eventId, UUID clubId) {
        if (eventId == null) {
            return null;
        }
        return eventRepository.findById(eventId)
                .filter(e -> e.getClub().getId().equals(clubId))
                .orElseThrow(() -> ApiException.badRequest("That event doesn't belong to this club"));
    }

    private ClubExpense findExpenseInClub(UUID clubId, UUID expenseId) {
        ClubExpense expense = expenseRepository.findById(expenseId)
                .orElseThrow(() -> ApiException.notFound("Expense not found"));
        if (!expense.getClub().getId().equals(clubId)) {
            throw ApiException.notFound("Expense not found");
        }
        return expense;
    }

    private void requireExpenseManager(UUID userId, UUID clubId, String message) {
        Membership membership = membershipRepository.findByUserIdAndClubId(userId, clubId)
                .orElseThrow(() -> ApiException.forbidden(message));

        if (membership.getStatus() != MembershipStatus.APPROVED
                || !EXPENSE_LOGGER_POSITIONS.contains(membership.getPosition())) {
            throw ApiException.forbidden(message);
        }
    }

    private String describe(ClubExpense expense) {
        return truncate("\"" + expense.getDescription() + "\" " + expense.getAmount() + " on " + expense.getExpenseDate()
                + (expense.getCategory() != null ? " [" + expense.getCategory() + "]" : ""));
    }

    private String truncate(String text) {
        return text.length() > 500 ? text.substring(0, 500) : text;
    }
}
