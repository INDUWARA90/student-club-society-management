package com.club.backend.service;

import java.time.Instant;
import java.util.UUID;
import java.util.regex.Pattern;

import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import com.club.backend.config.ApiException;
import com.club.backend.dto.AuthResponse;
import com.club.backend.dto.ForgotPasswordRequest;
import com.club.backend.dto.LoginRequest;
import com.club.backend.dto.RegisterRequest;
import com.club.backend.dto.ResetPasswordRequest;
import com.club.backend.dto.UserResponse;
import com.club.backend.entity.PasswordResetToken;
import com.club.backend.entity.Role;
import com.club.backend.entity.User;
import com.club.backend.repository.PasswordResetTokenRepository;
import com.club.backend.repository.UserRepository;
import com.club.backend.security.JwtService;
import com.club.backend.security.UserPrincipal;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class AuthService {

    private static final Pattern EMAIL_PATTERN = Pattern.compile("^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$");
    private static final long RESET_TOKEN_TTL_MINUTES = 30;

    private final UserRepository userRepository;
    private final PasswordResetTokenRepository passwordResetTokenRepository;
    private final PasswordEncoder passwordEncoder;
    private final AuthenticationManager authenticationManager;
    private final JwtService jwtService;
    private final MailService mailService;

    public AuthResponse register(RegisterRequest request) {
        validateRegister(request);

        User user = User.builder()
                .name(request.name().trim())
                .email(request.email().trim().toLowerCase())
                .passwordHash(passwordEncoder.encode(request.password()))
                .role(Role.STUDENT)
                .build();
        user = userRepository.save(user);

        String token = jwtService.generateToken(user.getId(), user.getEmail(), user.getRole().name());
        return new AuthResponse(token, UserResponse.from(user));
    }

    public AuthResponse login(LoginRequest request) {
        if (isBlank(request.email()) || isBlank(request.password())) {
            throw ApiException.badRequest("Email and password are required");
        }

        String email = request.email().trim().toLowerCase();
        try {
            authenticationManager.authenticate(
                    new UsernamePasswordAuthenticationToken(email, request.password()));
        } catch (BadCredentialsException e) {
            throw ApiException.badRequest("Invalid email or password");
        }

        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> ApiException.badRequest("Invalid email or password"));

        String token = jwtService.generateToken(user.getId(), user.getEmail(), user.getRole().name());
        return new AuthResponse(token, UserResponse.from(user));
    }

    public void forgotPassword(ForgotPasswordRequest request) {
        if (isBlank(request.email())) {
            throw ApiException.badRequest("Email is required");
        }

        // Always respond as if the request succeeded, regardless of whether the email exists,
        // to avoid leaking which addresses are registered.
        userRepository.findByEmail(request.email().trim().toLowerCase()).ifPresent(user -> {
            String token = UUID.randomUUID().toString();
            PasswordResetToken resetToken = PasswordResetToken.builder()
                    .user(user)
                    .token(token)
                    .expiresAt(Instant.now().plusSeconds(RESET_TOKEN_TTL_MINUTES * 60))
                    .used(false)
                    .build();
            passwordResetTokenRepository.save(resetToken);
            mailService.sendPasswordResetEmail(user.getEmail(), token);
        });
    }

    public void resetPassword(ResetPasswordRequest request) {
        if (isBlank(request.token()) || isBlank(request.newPassword())) {
            throw ApiException.badRequest("Token and new password are required");
        }
        if (request.newPassword().length() < 8) {
            throw ApiException.badRequest("Password must be at least 8 characters");
        }

        PasswordResetToken resetToken = passwordResetTokenRepository.findByToken(request.token())
                .orElseThrow(() -> ApiException.badRequest("Invalid or expired reset token"));

        if (resetToken.isUsed() || resetToken.getExpiresAt().isBefore(Instant.now())) {
            throw ApiException.badRequest("Invalid or expired reset token");
        }

        User user = resetToken.getUser();
        user.setPasswordHash(passwordEncoder.encode(request.newPassword()));
        userRepository.save(user);

        resetToken.setUsed(true);
        passwordResetTokenRepository.save(resetToken);
    }

    public UserResponse currentUser(UserPrincipal principal) {
        User user = userRepository.findById(principal.getId())
                .orElseThrow(() -> ApiException.notFound("User not found"));
        return UserResponse.from(user);
    }

    private void validateRegister(RegisterRequest request) {
        if (isBlank(request.name())) {
            throw ApiException.badRequest("Name is required");
        }
        if (isBlank(request.email()) || !EMAIL_PATTERN.matcher(request.email().trim()).matches()) {
            throw ApiException.badRequest("A valid email is required");
        }
        if (isBlank(request.password()) || request.password().length() < 8) {
            throw ApiException.badRequest("Password must be at least 8 characters");
        }
        if (userRepository.existsByEmail(request.email().trim().toLowerCase())) {
            throw ApiException.conflict("An account with this email already exists");
        }
    }

    private boolean isBlank(String value) {
        return value == null || value.trim().isEmpty();
    }
}
