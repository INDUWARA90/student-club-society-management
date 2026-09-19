package com.club.backend.service;

import java.util.List;
import java.util.UUID;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;

import com.club.backend.dto.AuditLogResponse;
import com.club.backend.entity.AuditLog;
import com.club.backend.entity.User;
import com.club.backend.repository.AuditLogRepository;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class AuditLogService {

    private final AuditLogRepository auditLogRepository;

    public void log(User actor, String action, String targetType, UUID targetId, String details) {
        AuditLog entry = AuditLog.builder()
                .actor(actor)
                .action(action)
                .targetType(targetType)
                .targetId(targetId)
                .details(details)
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
