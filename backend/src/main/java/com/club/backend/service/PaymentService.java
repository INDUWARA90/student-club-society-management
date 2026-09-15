package com.club.backend.service;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

import org.springframework.stereotype.Service;

import com.club.backend.config.ApiException;
import com.club.backend.dto.CreatePaymentRequest;
import com.club.backend.dto.PaymentResponse;
import com.club.backend.entity.Payment;
import com.club.backend.entity.PaymentStatus;
import com.club.backend.entity.User;
import com.club.backend.repository.PaymentRepository;
import com.club.backend.repository.UserRepository;
import com.club.backend.security.UserPrincipal;

import lombok.RequiredArgsConstructor;

/** Simulated payment gateway — no real money integration. Every payment succeeds immediately. */
@Service
@RequiredArgsConstructor
public class PaymentService {

    private final PaymentRepository paymentRepository;
    private final UserRepository userRepository;
    private final NotificationService notificationService;

    public PaymentResponse pay(CreatePaymentRequest request, UserPrincipal principal) {
        if (request.type() == null || request.referenceId() == null) {
            throw ApiException.badRequest("Payment type and reference are required");
        }
        if (request.amount() == null || request.amount().compareTo(BigDecimal.ZERO) < 0) {
            throw ApiException.badRequest("Payment amount must be zero or greater");
        }

        User user = userRepository.findById(principal.getId())
                .orElseThrow(() -> ApiException.notFound("User not found"));

        Payment payment = Payment.builder()
                .user(user)
                .type(request.type())
                .referenceId(request.referenceId())
                .amount(request.amount())
                .status(PaymentStatus.SUCCESS)
                .build();
        payment = paymentRepository.save(payment);

        notificationService.notify(user, "Payment of " + request.amount() + " confirmed for your "
                + request.type().name().toLowerCase() + ".");

        return PaymentResponse.from(payment);
    }

    public List<PaymentResponse> listMyPayments(UUID userId) {
        return paymentRepository.findByUserId(userId).stream().map(PaymentResponse::from).toList();
    }
}
