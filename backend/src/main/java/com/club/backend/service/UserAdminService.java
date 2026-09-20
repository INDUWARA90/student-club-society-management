package com.club.backend.service;

import java.util.UUID;
import java.util.regex.Pattern;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.club.backend.config.ApiException;
import com.club.backend.dto.CreateUserRequest;
import com.club.backend.dto.UpdateUserRequest;
import com.club.backend.dto.UserAdminResponse;
import com.club.backend.entity.Role;
import com.club.backend.entity.User;
import com.club.backend.repository.UserRepository;
import com.club.backend.security.UserPrincipal;

import lombok.RequiredArgsConstructor;

/** Super Admin user management: list, create, edit, change role, deactivate/reactivate accounts. */
@Service
@RequiredArgsConstructor
@Transactional
public class UserAdminService {

    private static final Pattern EMAIL_PATTERN = Pattern.compile("^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$");
    private static final int MIN_PASSWORD_LENGTH = 8;

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final AuditLogService auditLogService;

    @Transactional(readOnly = true)
    public Page<UserAdminResponse> search(String q, Role role, Pageable pageable) {
        String pattern = isBlank(q) ? null : "%" + q.trim().toLowerCase() + "%";
        return userRepository.search(role, pattern, pageable).map(UserAdminResponse::from);
    }

    public UserAdminResponse create(UserPrincipal principal, CreateUserRequest request) {
        if (isBlank(request.name())) {
            throw ApiException.badRequest("Name is required");
        }
        String email = normalizeEmail(request.email());
        if (isBlank(request.password()) || request.password().length() < MIN_PASSWORD_LENGTH) {
            throw ApiException.badRequest("Password must be at least " + MIN_PASSWORD_LENGTH + " characters");
        }
        if (userRepository.existsByEmail(email)) {
            throw ApiException.conflict("An account with this email already exists");
        }

        User user = userRepository.save(User.builder()
                .name(request.name().trim())
                .email(email)
                .passwordHash(passwordEncoder.encode(request.password()))
                .role(request.role() == null ? Role.STUDENT : request.role())
                // The admin vouches for the address, so the new user doesn't have to verify it before signing in.
                .emailVerified(true)
                .build());
        auditLogService.log(actor(principal), "CREATE_USER", "USER", user.getId(), user.getEmail() + " as " + user.getRole());
        return UserAdminResponse.from(user);
    }

    public UserAdminResponse update(UserPrincipal principal, UUID userId, UpdateUserRequest request) {
        User user = find(userId);
        StringBuilder changes = new StringBuilder();

        if (request.name() != null) {
            if (isBlank(request.name())) {
                throw ApiException.badRequest("Name cannot be empty");
            }
            user.setName(request.name().trim());
        }
        if (request.email() != null) {
            String email = normalizeEmail(request.email());
            if (!email.equals(user.getEmail())) {
                if (userRepository.existsByEmail(email)) {
                    throw ApiException.conflict("An account with this email already exists");
                }
                changes.append("email ").append(user.getEmail()).append(" -> ").append(email).append("; ");
                user.setEmail(email);
            }
        }
        if (request.role() != null && request.role() != user.getRole()) {
            if (user.getId().equals(principal.getId())) {
                throw ApiException.badRequest("You cannot change your own role");
            }
            if (user.getRole() == Role.SUPER_ADMIN) {
                requireAnotherActiveSuperAdmin(user, "demote");
            }
            changes.append("role ").append(user.getRole()).append(" -> ").append(request.role()).append("; ");
            user.setRole(request.role());
        }

        user = userRepository.save(user);
        auditLogService.log(actor(principal), "UPDATE_USER", "USER", user.getId(),
                user.getEmail() + (changes.length() > 0 ? " (" + changes.toString().trim() + ")" : ""));
        return UserAdminResponse.from(user);
    }

    public UserAdminResponse setActive(UserPrincipal principal, UUID userId, boolean active) {
        User user = find(userId);
        if (user.isActive() == active) {
            return UserAdminResponse.from(user);
        }
        if (!active) {
            if (user.getId().equals(principal.getId())) {
                throw ApiException.badRequest("You cannot deactivate your own account");
            }
            if (user.getRole() == Role.SUPER_ADMIN) {
                requireAnotherActiveSuperAdmin(user, "deactivate");
            }
        }
        user.setActive(active);
        user = userRepository.save(user);
        auditLogService.log(actor(principal), active ? "ACTIVATE_USER" : "DEACTIVATE_USER", "USER", user.getId(), user.getEmail());
        return UserAdminResponse.from(user);
    }

    private void requireAnotherActiveSuperAdmin(User target, String verb) {
        if (target.isActive() && userRepository.countByRoleAndActiveTrue(Role.SUPER_ADMIN) <= 1) {
            throw ApiException.badRequest("Cannot " + verb + " the last active Super Admin");
        }
    }

    private User find(UUID userId) {
        return userRepository.findById(userId).orElseThrow(() -> ApiException.notFound("User not found"));
    }

    private User actor(UserPrincipal principal) {
        return userRepository.findById(principal.getId()).orElseThrow(() -> ApiException.notFound("User not found"));
    }

    private String normalizeEmail(String email) {
        if (isBlank(email) || !EMAIL_PATTERN.matcher(email.trim()).matches()) {
            throw ApiException.badRequest("A valid email is required");
        }
        return email.trim().toLowerCase();
    }

    private boolean isBlank(String value) {
        return value == null || value.trim().isEmpty();
    }
}
