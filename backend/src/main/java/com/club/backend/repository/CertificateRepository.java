package com.club.backend.repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;

import com.club.backend.entity.Certificate;

public interface CertificateRepository extends JpaRepository<Certificate, UUID> {

    Optional<Certificate> findByUserIdAndClubId(UUID userId, UUID clubId);

    List<Certificate> findByUserId(UUID userId);
}
