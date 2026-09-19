package com.club.backend.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.CommandLineRunner;
import org.springframework.core.annotation.Order;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

import com.club.backend.entity.Role;
import com.club.backend.entity.User;
import com.club.backend.repository.UserRepository;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

/**
 * Creates the first Super Admin from BOOTSTRAP_ADMIN_EMAIL / BOOTSTRAP_ADMIN_PASSWORD when the system has none.
 * This is how a real deployment (which has demo seeding switched off) gets its initial administrator, instead of a
 * well-known demo account. Does nothing once any Super Admin exists.
 */
@Component
@Order(2)
@RequiredArgsConstructor
@Slf4j
public class AdminBootstrapper implements CommandLineRunner {

    private static final int MIN_PASSWORD_LENGTH = 12;

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;

    @Value("${app.bootstrap-admin.email:}")
    private String email;

    @Value("${app.bootstrap-admin.password:}")
    private String password;

    @Override
    public void run(String... args) {
        if (email == null || email.isBlank() || password == null || password.isBlank()) {
            return;
        }
        if (userRepository.countByRole(Role.SUPER_ADMIN) > 0) {
            return;
        }
        if (password.length() < MIN_PASSWORD_LENGTH) {
            log.error("BOOTSTRAP_ADMIN_PASSWORD must be at least {} characters; no admin was created", MIN_PASSWORD_LENGTH);
            return;
        }

        String normalizedEmail = email.trim().toLowerCase();
        if (userRepository.existsByEmail(normalizedEmail)) {
            log.error("Cannot bootstrap admin: {} already exists as a non-admin account", normalizedEmail);
            return;
        }

        userRepository.save(User.builder()
                .name("Super Admin")
                .email(normalizedEmail)
                .passwordHash(passwordEncoder.encode(password))
                .role(Role.SUPER_ADMIN)
                .emailVerified(true)
                .build());
        log.info("Bootstrapped initial Super Admin account {}", normalizedEmail);
    }
}
