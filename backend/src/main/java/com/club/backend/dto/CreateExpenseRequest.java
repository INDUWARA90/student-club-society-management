package com.club.backend.dto;

import java.math.BigDecimal;

public record CreateExpenseRequest(String description, BigDecimal amount) {
}
