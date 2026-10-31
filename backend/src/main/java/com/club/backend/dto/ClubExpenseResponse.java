package com.club.backend.dto;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

import com.club.backend.entity.ClubExpense;
import com.club.backend.entity.ExpenseType;

public record ClubExpenseResponse(
        UUID id,
        UUID clubId,
        UUID loggedBy,
        String loggedByName,
        String description,
        BigDecimal amount,
        LocalDate expenseDate,
        Instant createdAt,
        String category,
        UUID eventId,
        String eventTitle,
        ExpenseType type) {

    public ClubExpenseResponse(UUID id, UUID clubId, UUID loggedBy, String loggedByName, String description,
            BigDecimal amount, LocalDate expenseDate, Instant createdAt, String category, UUID eventId,
            String eventTitle) {
        this(id, clubId, loggedBy, loggedByName, description, amount, expenseDate, createdAt, category, eventId, eventTitle, ExpenseType.EXPENSE);
    }

    public static ClubExpenseResponse from(ClubExpense expense) {
        return new ClubExpenseResponse(
                expense.getId(),
                expense.getClub().getId(),
                expense.getLoggedBy().getId(),
                expense.getLoggedBy().getName(),
                expense.getDescription(),
                expense.getAmount(),
                expense.getExpenseDate(),
                expense.getCreatedAt(),
                expense.getCategory(),
                expense.getEvent() != null ? expense.getEvent().getId() : null,
                expense.getEvent() != null ? expense.getEvent().getTitle() : null,
                expense.getEntryType() != null ? expense.getEntryType() : ExpenseType.EXPENSE);
    }
}
