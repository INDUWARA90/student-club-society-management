package com.club.backend.dto;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

import com.club.backend.entity.ClubExpense;

public record ClubExpenseResponse(
        UUID id,
        UUID clubId,
        UUID loggedBy,
        String loggedByName,
        String description,
        BigDecimal amount,
        LocalDate expenseDate,
        Instant createdAt) {

    public static ClubExpenseResponse from(ClubExpense expense) {
        return new ClubExpenseResponse(
                expense.getId(),
                expense.getClub().getId(),
                expense.getLoggedBy().getId(),
                expense.getLoggedBy().getName(),
                expense.getDescription(),
                expense.getAmount(),
                expense.getExpenseDate(),
                expense.getCreatedAt());
    }
}
