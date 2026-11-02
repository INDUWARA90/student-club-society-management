package com.club.backend.service;

import java.util.List;
import java.util.UUID;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.club.backend.dto.AuditLogResponse;
import com.club.backend.entity.AuditLog;
import com.club.backend.entity.User;
import com.club.backend.repository.AuditLogRepository;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class AuditLogService {

    private static final int MAX_DETAILS_LENGTH = 500;

    private final AuditLogRepository auditLogRepository;

    @Transactional
    public void log(User actor, String action, String targetType, UUID targetId, String details) {
        if (actor == null || action == null || targetType == null || targetId == null) {
            return;
        }

        String safeDetails = details;
        if (safeDetails != null && safeDetails.length() > MAX_DETAILS_LENGTH) {
            safeDetails = safeDetails.substring(0, MAX_DETAILS_LENGTH - 3) + "...";
        }

        AuditLog entry = AuditLog.builder()
                .actor(actor)
                .action(action)
                .targetType(targetType)
                .targetId(targetId)
                .details(safeDetails)
                .build();
        auditLogRepository.save(entry);
    }

    public Page<AuditLogResponse> page(Pageable pageable) {
        return auditLogRepository.findAllByOrderByCreatedAtDesc(pageable).map(AuditLogResponse::from);
    }

    public List<AuditLogResponse> listAll() {
        return auditLogRepository.findAllByOrderByCreatedAtDesc().stream().map(AuditLogResponse::from).toList();
    }
}
