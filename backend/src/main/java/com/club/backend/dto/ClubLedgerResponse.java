package com.club.backend.dto;

import java.math.BigDecimal;
import java.util.List;

public record ClubLedgerResponse(BigDecimal totalExpenses, BigDecimal balance, List<ClubExpenseResponse> expenses) {
}
