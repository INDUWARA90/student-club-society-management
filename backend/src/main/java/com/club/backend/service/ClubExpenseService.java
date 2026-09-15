package com.club.backend.service;

import java.math.BigDecimal;
import java.util.List;
import java.util.Set;
import java.util.UUID;

import org.springframework.stereotype.Service;

import com.club.backend.config.ApiException;
import com.club.backend.dto.ClubExpenseResponse;
import com.club.backend.dto.ClubLedgerResponse;
import com.club.backend.dto.CreateExpenseRequest;
import com.club.backend.entity.Club;
import com.club.backend.entity.ClubExpense;
import com.club.backend.entity.Membership;
import com.club.backend.entity.MembershipPosition;
import com.club.backend.entity.MembershipStatus;
import com.club.backend.entity.User;
import com.club.backend.repository.ClubExpenseRepository;
import com.club.backend.repository.ClubRepository;
import com.club.backend.repository.MembershipRepository;
import com.club.backend.repository.UserRepository;
import com.club.backend.security.UserPrincipal;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class ClubExpenseService {

    private static final Set<MembershipPosition> EXPENSE_LOGGER_POSITIONS = Set.of(
            MembershipPosition.PRESIDENT, MembershipPosition.TREASURER);

    private final ClubExpenseRepository expenseRepository;
    private final ClubRepository clubRepository;
    private final MembershipRepository membershipRepository;
    private final UserRepository userRepository;

    public ClubExpenseResponse logExpense(UUID clubId, CreateExpenseRequest request, UserPrincipal principal) {
        if (request.description() == null || request.description().trim().isEmpty()) {
            throw ApiException.badRequest("Expense description is required");
        }
        if (request.amount() == null || request.amount().compareTo(BigDecimal.ZERO) <= 0) {
            throw ApiException.badRequest("Expense amount must be greater than zero");
        }

        Club club = clubRepository.findById(clubId)
                .orElseThrow(() -> ApiException.notFound("Club not found"));

        User loggedBy = userRepository.findById(principal.getId())
                .orElseThrow(() -> ApiException.notFound("User not found"));

        Membership membership = membershipRepository.findByUserIdAndClubId(loggedBy.getId(), clubId)
                .orElseThrow(() -> ApiException.forbidden("Only the Treasurer or Club Admin can log expenses"));

        if (membership.getStatus() != MembershipStatus.APPROVED
                || !EXPENSE_LOGGER_POSITIONS.contains(membership.getPosition())) {
            throw ApiException.forbidden("Only the Treasurer or Club Admin can log expenses");
        }

        ClubExpense expense = ClubExpense.builder()
                .club(club)
                .loggedBy(loggedBy)
                .description(request.description().trim())
                .amount(request.amount())
                .build();
        expense = expenseRepository.save(expense);

        return ClubExpenseResponse.from(expense);
    }

    // NOTE: income (membership/event fees) isn't wired in yet — balance is
    // -totalExpenses for now and will factor in Payment totals once that module lands.
    public ClubLedgerResponse getLedger(UUID clubId) {
        List<ClubExpense> expenses = expenseRepository.findByClubIdOrderByExpenseDateDesc(clubId);
        BigDecimal total = expenses.stream().map(ClubExpense::getAmount).reduce(BigDecimal.ZERO, BigDecimal::add);
        List<ClubExpenseResponse> expenseResponses = expenses.stream().map(ClubExpenseResponse::from).toList();
        return new ClubLedgerResponse(total, total.negate(), expenseResponses);
    }
}
