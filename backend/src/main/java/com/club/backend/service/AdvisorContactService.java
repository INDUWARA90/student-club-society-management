package com.club.backend.service;

import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import com.club.backend.dto.AdvisorContactResponse;
import com.club.backend.dto.AdvisorSummaryResponse;
import com.club.backend.dto.ContactAdvisorRequest;
import com.club.backend.entity.Club;
import com.club.backend.entity.Role;
import com.club.backend.entity.User;
import com.club.backend.repository.ClubRepository;
import com.club.backend.repository.UserRepository;
import com.club.backend.security.UserPrincipal;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

@Service
@RequiredArgsConstructor
@Slf4j
public class AdvisorContactService {

    private final UserRepository userRepository;
    private final ClubRepository clubRepository;
    private final NotificationService notificationService;
    private final MailService mailService;
    private final AuditLogService auditLogService;

    @Transactional(readOnly = true)
    public List<AdvisorSummaryResponse> getActiveAdvisors() {
        return userRepository.findByRoleAndActiveTrue(Role.FACULTY_ADVISOR)
                .stream()
                .map(AdvisorSummaryResponse::from)
                .toList();
    }

    @Transactional
    public AdvisorContactResponse contactAdvisor(UserPrincipal principal, ContactAdvisorRequest request) {
        if (principal == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "User must be authenticated");
        }

        User student = userRepository.findById(principal.getId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User account not found"));

        if (!student.isActive()) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "User account is deactivated");
        }

        String clubName = null;
        if (request.clubId() != null) {
            Club club = clubRepository.findById(request.clubId())
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Referenced club not found"));
            clubName = club.getName();
        }

        List<User> targetAdvisors;
        if (request.advisorId() != null) {
            User advisor = userRepository.findById(request.advisorId())
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Faculty advisor not found"));
            if (advisor.getRole() != Role.FACULTY_ADVISOR || !advisor.isActive()) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Selected user is not an active faculty advisor");
            }
            targetAdvisors = List.of(advisor);
        } else {
            targetAdvisors = userRepository.findByRoleAndActiveTrue(Role.FACULTY_ADVISOR);
            if (targetAdvisors.isEmpty()) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "No active faculty advisors currently available");
            }
        }

        for (User advisor : targetAdvisors) {
            // Send in-app notification
            notificationService.notifyUsers(
                    List.of(advisor.getId()),
                    "Student inquiry from " + student.getName() + " (" + student.getEmail() + "): " + request.subject()
            );

            // Send attractive HTML email
            mailService.sendAdvisorContactEmail(
                    advisor.getEmail(),
                    advisor.getName(),
                    student.getName(),
                    student.getEmail(),
                    request.subject(),
                    request.message(),
                    clubName
            );
        }

        String advisorNames = targetAdvisors.stream().map(User::getName).collect(Collectors.joining(", "));

        // Send confirmation in-app notification to the student
        notificationService.notifyUsers(
                List.of(student.getId()),
                "Your inquiry regarding '" + request.subject() + "' has been successfully sent to Faculty Advisor " + advisorNames + "."
        );

        // Audit log
        UUID targetId = targetAdvisors.get(0).getId();
        auditLogService.log(
                student,
                "CONTACT_ADVISOR",
                "USER",
                targetId,
                "Student contacted advisor (" + advisorNames + "): " + request.subject()
        );

        log.info("Student {} ({}) sent advisory message to {} advisors regarding '{}'",
                student.getName(), student.getEmail(), targetAdvisors.size(), request.subject());

        return new AdvisorContactResponse(
                true,
                "Your message has been successfully sent to Faculty Advisor " + advisorNames + ".",
                targetAdvisors.stream().map(User::getName).toList()
        );
    }
}
