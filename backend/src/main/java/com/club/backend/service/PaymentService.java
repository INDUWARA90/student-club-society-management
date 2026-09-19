package com.club.backend.service;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.club.backend.config.ApiException;
import com.club.backend.dto.CreatePaymentRequest;
import com.club.backend.dto.PaymentResponse;
import com.club.backend.entity.Club;
import com.club.backend.entity.ClubStatus;
import com.club.backend.entity.Event;
import com.club.backend.entity.EventApprovalStatus;
import com.club.backend.entity.Payment;
import com.club.backend.entity.PaymentStatus;
import com.club.backend.entity.PaymentType;
import com.club.backend.entity.User;
import com.club.backend.repository.ClubRepository;
import com.club.backend.repository.EventRepository;
import com.club.backend.repository.PaymentRepository;
import com.club.backend.repository.UserRepository;
import com.club.backend.security.UserPrincipal;

import lombok.RequiredArgsConstructor;

/**
 * Simulated payment gateway — no real money integration. Every payment succeeds immediately, but the amount is
 * always derived server-side, payments gate RSVPs/joining, and cancellations refund (a refunded payment is kept for
 * the record but no longer counts as income).
 */
@Service
@RequiredArgsConstructor
@Transactional
public class PaymentService {

    private final PaymentRepository paymentRepository;
    private final EventRepository eventRepository;
    private final ClubRepository clubRepository;
    private final UserRepository userRepository;
    private final NotificationService notificationService;
    private final EmailVerificationPolicy emailVerificationPolicy;

    public PaymentResponse pay(CreatePaymentRequest request, UserPrincipal principal) {
        if (request.type() == null || request.referenceId() == null) {
            throw ApiException.badRequest("Payment type and reference are required");
        }

        User user = userRepository.findById(principal.getId())
                .orElseThrow(() -> ApiException.notFound("User not found"));
        emailVerificationPolicy.requireVerified(user);

        // The amount is never trusted from the client — it's derived from the thing being paid for.
        BigDecimal amount;
        String subject;
        if (request.type() == PaymentType.EVENT) {
            Event event = eventRepository.findById(request.referenceId())
                    .orElseThrow(() -> ApiException.notFound("Event not found"));
            if (event.getApprovalStatus() != EventApprovalStatus.NOT_REQUIRED
                    && event.getApprovalStatus() != EventApprovalStatus.APPROVED) {
                throw ApiException.badRequest("This event is not open for payment yet");
            }
            if (event.isCancelled()) {
                throw ApiException.badRequest("This event has been cancelled");
            }
            if (event.getEventDate() != null && !event.getEventDate().isAfter(Instant.now())) {
                throw ApiException.badRequest("This event has already started");
            }
            if (event.getFee().compareTo(BigDecimal.ZERO) <= 0) {
                throw ApiException.badRequest("This event has no fee to pay");
            }
            if (findLive(user.getId(), PaymentType.EVENT, event.getId()).isPresent()) {
                throw ApiException.conflict("You have already paid for this event");
            }
            amount = event.getFee();
            subject = "\"" + event.getTitle() + "\"";
        } else {
            Club club = clubRepository.findById(request.referenceId())
                    .filter(c -> c.getStatus() == ClubStatus.APPROVED && !c.isArchived())
                    .orElseThrow(() -> ApiException.notFound("Club not found"));
            BigDecimal fee = club.getMembershipFee();
            if (fee == null || fee.compareTo(BigDecimal.ZERO) <= 0) {
                throw ApiException.badRequest("This club has no membership fee to pay");
            }
            if (findLive(user.getId(), PaymentType.MEMBERSHIP, club.getId()).isPresent()) {
                throw ApiException.conflict("You have already paid the membership fee for this club");
            }
            amount = fee;
            subject = "membership of " + club.getName();
        }

        Payment payment = Payment.builder()
                .user(user)
                .type(request.type())
                .referenceId(request.referenceId())
                .amount(amount)
                .status(PaymentStatus.SUCCESS)
                .build();
        payment = paymentRepository.save(payment);

        notificationService.notify(user, "Payment of " + amount + " confirmed for " + subject + ".");

        return PaymentResponse.from(payment);
    }

    public List<PaymentResponse> listMyPayments(UUID userId) {
        return paymentRepository.findByUserId(userId).stream().map(PaymentResponse::from).toList();
    }

    @Transactional(readOnly = true)
    public Page<PaymentResponse> pageMyPayments(UUID userId, Pageable pageable) {
        return paymentRepository.findByUserId(userId, pageable).map(PaymentResponse::from);
    }

    /** True if the user has a live (successful, unrefunded) payment of this kind — used to gate RSVPs and joining. */
    public boolean hasLivePayment(UUID userId, PaymentType type, UUID referenceId) {
        return findLive(userId, type, referenceId).isPresent();
    }

    /** Refunds the user's event payment, if there is one. Returns whether anything was refunded. */
    public boolean refundEventPayment(UUID userId, Event event, String reason) {
        return refund(findLive(userId, PaymentType.EVENT, event.getId()), "\"" + event.getTitle() + "\"", reason);
    }

    public boolean refundMembershipPayment(UUID userId, Club club, String reason) {
        return refund(findLive(userId, PaymentType.MEMBERSHIP, club.getId()), "membership of " + club.getName(), reason);
    }

    /** Refunds everyone who paid for an event (used when the event is cancelled). Returns the number refunded. */
    public int refundAllForEvent(Event event, String reason) {
        List<Payment> live = paymentRepository.findByTypeAndReferenceIdAndStatusAndRefundedAtIsNull(
                PaymentType.EVENT, event.getId(), PaymentStatus.SUCCESS);
        live.forEach(payment -> refund(Optional.of(payment), "\"" + event.getTitle() + "\"", reason));
        return live.size();
    }

    private Optional<Payment> findLive(UUID userId, PaymentType type, UUID referenceId) {
        return paymentRepository.findFirstByUserIdAndTypeAndReferenceIdAndStatusAndRefundedAtIsNull(
                userId, type, referenceId, PaymentStatus.SUCCESS);
    }

    private boolean refund(Optional<Payment> payment, String subject, String reason) {
        if (payment.isEmpty()) {
            return false;
        }
        Payment p = payment.get();
        p.setRefundedAt(Instant.now());
        paymentRepository.save(p);
        notificationService.notify(p.getUser(),
                "Your payment of " + p.getAmount() + " for " + subject + " was refunded" + (reason != null ? " (" + reason + ")" : "") + ".");
        return true;
    }
}
