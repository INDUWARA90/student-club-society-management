package com.club.backend.dto;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

public record ClubLedgerResponse(
        BigDecimal totalIncome, BigDecimal totalExpenses, BigDecimal balance, List<ClubExpenseResponse> expenses,
        List<EventBudgetLine> eventBudgets) {

    /**
     * One event's money picture: its budget (if set), what the club has spent on it (expenses linked to the event),
     * what it brought in (live fees + logged event income), what is left of the budget (if completed, remaining unspent balance),
     * and net surplus / deficit.
     */
    public record EventBudgetLine(
            UUID eventId, String title, BigDecimal budget, BigDecimal spent, BigDecimal income, BigDecimal remaining,
            BigDecimal net, boolean completed) {

        public EventBudgetLine(UUID eventId, String title, BigDecimal budget, BigDecimal spent, BigDecimal income, BigDecimal remaining) {
            this(eventId, title, budget, spent, income, remaining,
                    (income != null ? income : BigDecimal.ZERO).subtract(spent != null ? spent : BigDecimal.ZERO),
                    false);
        }
    }

    public ClubLedgerResponse(BigDecimal totalIncome, BigDecimal totalExpenses, BigDecimal balance,
            List<ClubExpenseResponse> expenses) {
        this(totalIncome, totalExpenses, balance, expenses, List.of());
    }
}
