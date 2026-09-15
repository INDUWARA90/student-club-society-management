package com.club.backend.controller;

import java.util.List;

import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.club.backend.dto.CreatePaymentRequest;
import com.club.backend.dto.PaymentResponse;
import com.club.backend.security.UserPrincipal;
import com.club.backend.service.PaymentService;

import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/api/payments")
@RequiredArgsConstructor
public class PaymentController {

    private final PaymentService paymentService;

    @PostMapping
    public ResponseEntity<PaymentResponse> pay(@RequestBody CreatePaymentRequest request,
            @AuthenticationPrincipal UserPrincipal principal) {
        return ResponseEntity.ok(paymentService.pay(request, principal));
    }

    @GetMapping("/me")
    public ResponseEntity<List<PaymentResponse>> myPayments(@AuthenticationPrincipal UserPrincipal principal) {
        return ResponseEntity.ok(paymentService.listMyPayments(principal.getId()));
    }
}
