package com.club.backend.dto;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;

public record CreateExpenseRequest(
        String description,
        BigDecimal amount,
        String category,
        LocalDate expenseDate,
        UUID eventId) {

    public CreateExpenseRequest(String description, BigDecimal amount) {
        this(description, amount, null, null, null);
    }
}
