package com.club.backend.dto;

import java.math.BigDecimal;
import java.util.UUID;

import com.club.backend.entity.PaymentType;

public record CreatePaymentRequest(PaymentType type, UUID referenceId, BigDecimal amount) {
}
