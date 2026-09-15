package com.club.backend.dto;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

import com.club.backend.entity.Payment;
import com.club.backend.entity.PaymentStatus;
import com.club.backend.entity.PaymentType;

public record PaymentResponse(
        UUID id,
        PaymentType type,
        UUID referenceId,
        BigDecimal amount,
        PaymentStatus status,
        Instant paidAt) {

    public static PaymentResponse from(Payment payment) {
        return new PaymentResponse(
                payment.getId(),
                payment.getType(),
                payment.getReferenceId(),
                payment.getAmount(),
                payment.getStatus(),
                payment.getPaidAt());
    }
}
