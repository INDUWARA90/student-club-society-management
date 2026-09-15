package com.club.backend.repository;

import java.util.List;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;

import com.club.backend.entity.Payment;

public interface PaymentRepository extends JpaRepository<Payment, UUID> {

    List<Payment> findByUserId(UUID userId);
}
