package com.club.backend.repository;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import com.club.backend.entity.Payment;
import com.club.backend.entity.PaymentStatus;
import com.club.backend.entity.PaymentType;

public interface PaymentRepository extends JpaRepository<Payment, UUID> {

    List<Payment> findByUserId(UUID userId);

    Page<Payment> findByUserId(UUID userId, Pageable pageable);

    /** The user's live (successful, not refunded) payment for this event/club, if any. */
    Optional<Payment> findFirstByUserIdAndTypeAndReferenceIdAndStatusAndRefundedAtIsNull(
            UUID userId, PaymentType type, UUID referenceId, PaymentStatus status);

    /** Live (successful, not refunded) payments for one event/club — the ones that count as income. */
    List<Payment> findByTypeAndReferenceIdAndStatusAndRefundedAtIsNull(
            PaymentType type, UUID referenceId, PaymentStatus status);

    List<Payment> findByTypeAndReferenceIdInAndStatusAndRefundedAtIsNull(
            PaymentType type, List<UUID> referenceIds, PaymentStatus status);

    @Query("SELECT COALESCE(SUM(p.amount), 0) FROM Payment p "
            + "WHERE p.status = com.club.backend.entity.PaymentStatus.SUCCESS AND p.refundedAt IS NULL")
    BigDecimal sumLiveAmount();
}
