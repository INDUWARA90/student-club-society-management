package com.club.backend.dto;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;

import com.club.backend.entity.ExpenseType;

public record CreateExpenseRequest(
        String description,
        BigDecimal amount,
        String category,
        LocalDate expenseDate,
        UUID eventId,
        ExpenseType type) {

    public CreateExpenseRequest(String description, BigDecimal amount, String category, LocalDate expenseDate, UUID eventId) {
        this(description, amount, category, expenseDate, eventId, ExpenseType.EXPENSE);
    }

    public CreateExpenseRequest(String description, BigDecimal amount) {
        this(description, amount, null, null, null, ExpenseType.EXPENSE);
    }
}
