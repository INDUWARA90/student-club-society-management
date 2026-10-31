package com.club.backend.repository;

import java.util.List;
import java.util.UUID;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

import com.club.backend.entity.AuditLog;

public interface AuditLogRepository extends JpaRepository<AuditLog, UUID> {

    @EntityGraph(attributePaths = {"actor"})
    List<AuditLog> findAllByOrderByCreatedAtDesc();

    @EntityGraph(attributePaths = {"actor"})
    Page<AuditLog> findAllByOrderByCreatedAtDesc(Pageable pageable);
}
