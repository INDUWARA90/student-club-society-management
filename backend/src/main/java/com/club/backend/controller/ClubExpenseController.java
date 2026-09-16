package com.club.backend.controller;

import java.util.UUID;

import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.club.backend.dto.ClubExpenseResponse;
import com.club.backend.dto.ClubLedgerResponse;
import com.club.backend.dto.CreateExpenseRequest;
import com.club.backend.security.UserPrincipal;
import com.club.backend.service.ClubExpenseService;

import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/api/clubs/{clubId}/expenses")
@RequiredArgsConstructor
public class ClubExpenseController {

    private final ClubExpenseService expenseService;

    @PostMapping
    public ResponseEntity<ClubExpenseResponse> logExpense(@PathVariable UUID clubId,
            @RequestBody CreateExpenseRequest request, @AuthenticationPrincipal UserPrincipal principal) {
        return ResponseEntity.ok(expenseService.logExpense(clubId, request, principal));
    }

    @GetMapping("/ledger")
    public ResponseEntity<ClubLedgerResponse> getLedger(@PathVariable UUID clubId) {
        return ResponseEntity.ok(expenseService.getLedger(clubId));
    }

    @DeleteMapping("/{expenseId}")
    public ResponseEntity<Void> deleteExpense(@PathVariable UUID clubId, @PathVariable UUID expenseId,
            @AuthenticationPrincipal UserPrincipal principal) {
        expenseService.deleteExpense(clubId, expenseId, principal);
        return ResponseEntity.ok().build();
    }
}
