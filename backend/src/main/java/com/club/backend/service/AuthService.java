package com.club.backend.service;

import java.time.Instant;
import java.time.Year;
import java.util.UUID;
import java.util.regex.Pattern;

import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.club.backend.config.ApiException;
import com.club.backend.dto.AuthResponse;
import com.club.backend.dto.ChangePasswordRequest;
import com.club.backend.dto.ForgotPasswordRequest;
import com.club.backend.dto.LoginRequest;
import com.club.backend.dto.RegisterRequest;
import com.club.backend.dto.ResetPasswordRequest;
import com.club.backend.dto.UpdateProfileRequest;
import com.club.backend.dto.UserResponse;
import com.club.backend.entity.EmailVerificationToken;
import com.club.backend.entity.MembershipPosition;
import com.club.backend.entity.MembershipStatus;
import com.club.backend.entity.PasswordResetToken;
import com.club.backend.entity.Role;
import com.club.backend.entity.User;
import com.club.backend.repository.EmailVerificationTokenRepository;
import com.club.backend.repository.MembershipRepository;
import com.club.backend.repository.PasswordResetTokenRepository;
import com.club.backend.repository.UserRepository;
import com.club.backend.security.JwtService;
import com.club.backend.security.LoginAttemptService;
import com.club.backend.security.UserPrincipal;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
@Transactional
public class AuthService {

    private static final Pattern EMAIL_PATTERN = Pattern.compile("^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$");
    private static final long RESET_TOKEN_TTL_MINUTES = 30;
    private static final long VERIFICATION_TOKEN_TTL_HOURS = 24;

    private final UserRepository userRepository;
    private final PasswordResetTokenRepository passwordResetTokenRepository;
    private final EmailVerificationTokenRepository emailVerificationTokenRepository;
    private final PasswordEncoder passwordEncoder;
    private final AuthenticationManager authenticationManager;
    private final JwtService jwtService;
    private final MailService mailService;
    private final LoginAttemptService loginAttemptService;
    private final EmailVerificationPolicy emailVerificationPolicy;
    private final MembershipRepository membershipRepository;
    private final NotificationService notificationService;

    /**
     * With email verification required (production), registration never reveals whether an address is taken: the
     * response is the same either way and no token is issued — a new account gets a verification link, an existing
     * one gets a "you already have an account" email. Without it (local dev) duplicates are reported as 409 and the
     * user is signed straight in.
     */
    public AuthResponse register(RegisterRequest request) {
        validateRegister(request);

        String email = request.email().trim().toLowerCase();
        boolean exists = userRepository.existsByEmail(email);
        if (emailVerificationPolicy.isRequired() && exists) {
            mailService.sendAccountExistsEmail(email);
            return AuthResponse.pending();
        }
        if (exists) {
            throw ApiException.conflict("An account with this email already exists");
        }

        User user = User.builder()
                .name(request.name().trim())
                .email(request.email().trim().toLowerCase())
                .passwordHash(passwordEncoder.encode(request.password()))
                .role(Role.STUDENT)
                .emailVerified(false)
                .build();
        user = userRepository.save(user);

        sendVerificationEmail(user);

        if (emailVerificationPolicy.isRequired()) {
            return AuthResponse.pending();
        }

        String token = jwtService.generateToken(user.getId(), user.getEmail(), user.getRole().name());
        return new AuthResponse(token, UserResponse.from(user));
    }

    private void sendVerificationEmail(User user) {
        String token = UUID.randomUUID().toString();
        EmailVerificationToken verificationToken = EmailVerificationToken.builder()
                .user(user)
                .token(token)
                .expiresAt(Instant.now().plusSeconds(VERIFICATION_TOKEN_TTL_HOURS * 3600))
                .build();
        emailVerificationTokenRepository.save(verificationToken);
        mailService.sendVerificationEmail(user.getEmail(), token);
    }

    public void verifyEmail(String token) {
        EmailVerificationToken verificationToken = emailVerificationTokenRepository.findByToken(token)
                .orElseThrow(() -> ApiException.badRequest("Invalid or expired verification link"));

        if (verificationToken.isUsed() || verificationToken.getExpiresAt().isBefore(Instant.now())) {
            throw ApiException.badRequest("Invalid or expired verification link");
        }

        User user = verificationToken.getUser();
        user.setEmailVerified(true);
        userRepository.save(user);

        verificationToken.setUsed(true);
        emailVerificationTokenRepository.save(verificationToken);
    }

    public void resendVerificationEmail(UserPrincipal principal) {
        User user = userRepository.findById(principal.getId())
                .orElseThrow(() -> ApiException.notFound("User not found"));

        if (user.isEmailVerified()) {
            throw ApiException.badRequest("Your email is already verified");
        }

        sendVerificationEmail(user);
    }

    public AuthResponse login(LoginRequest request) {
        if (isBlank(request.email()) || isBlank(request.password())) {
            throw ApiException.badRequest("Email and password are required");
        }

        String email = request.email().trim().toLowerCase();
        if (loginAttemptService.isLocked(email)) {
            throw ApiException.tooManyRequests("Too many failed sign-in attempts. Please try again in a few minutes.");
        }
        try {
            authenticationManager.authenticate(
                    new UsernamePasswordAuthenticationToken(email, request.password()));
        } catch (BadCredentialsException e) {
            loginAttemptService.recordFailure(email);
            throw ApiException.badRequest("Invalid email or password");
        }
        loginAttemptService.recordSuccess(email);

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
        user.setPasswordChangedAt(Instant.now());
        userRepository.save(user);

        resetToken.setUsed(true);
        passwordResetTokenRepository.save(resetToken);
    }

    public UserResponse currentUser(UserPrincipal principal) {
        User user = userRepository.findById(principal.getId())
                .orElseThrow(() -> ApiException.notFound("User not found"));
        return UserResponse.from(user);
    }

    /** Changing the password signs out every other session; the caller gets a fresh token to stay signed in. */
    public AuthResponse changePassword(UserPrincipal principal, ChangePasswordRequest request) {
        if (isBlank(request.currentPassword()) || isBlank(request.newPassword())) {
            throw ApiException.badRequest("Current and new password are required");
        }
        if (request.newPassword().length() < 8) {
            throw ApiException.badRequest("New password must be at least 8 characters");
        }

        User user = userRepository.findById(principal.getId())
                .orElseThrow(() -> ApiException.notFound("User not found"));

        if (!passwordEncoder.matches(request.currentPassword(), user.getPasswordHash())) {
            throw ApiException.badRequest("Current password is incorrect");
        }

        user.setPasswordHash(passwordEncoder.encode(request.newPassword()));
        user.setPasswordChangedAt(Instant.now());
        user = userRepository.save(user);

        String token = jwtService.generateToken(user.getId(), user.getEmail(), user.getRole().name());
        return new AuthResponse(token, UserResponse.from(user));
    }

    public UserResponse updateProfile(UserPrincipal principal, UpdateProfileRequest request) {
        if (isBlank(request.name())) {
            throw ApiException.badRequest("Name is required");
        }
        if (isBlank(request.email()) || !EMAIL_PATTERN.matcher(request.email().trim()).matches()) {
            throw ApiException.badRequest("A valid email is required");
        }

        User user = userRepository.findById(principal.getId())
                .orElseThrow(() -> ApiException.notFound("User not found"));

        String newEmail = request.email().trim().toLowerCase();
        if (!newEmail.equals(user.getEmail()) && userRepository.existsByEmail(newEmail)) {
            throw ApiException.conflict("An account with this email already exists");
        }

        boolean emailChanged = !newEmail.equals(user.getEmail());
        user.setName(request.name().trim());
        user.setEmail(newEmail);
        Integer previousGraduationYear = user.getGraduationYear();
        user.setGraduationYear(request.graduationYear());
        if (request.emailNotificationsEnabled() != null) {
            user.setEmailNotificationsEnabled(request.emailNotificationsEnabled());
        }
        if (request.emailDigestEnabled() != null) {
            user.setEmailDigestEnabled(request.emailDigestEnabled());
        }
        if (emailChanged) {
            user.setEmailVerified(false);
        }
        user = userRepository.save(user);

        if (emailChanged) {
            sendVerificationEmail(user);
        }
        if (request.graduationYear() != null && request.graduationYear() < Year.now().getValue()
                && !request.graduationYear().equals(previousGraduationYear)) {
            tellOfficersPresidentGraduated(user);
        }

        return UserResponse.from(user);
    }

    /** When a President marks themselves as graduated, their club's officers learn the succession route is open. */
    private void tellOfficersPresidentGraduated(User president) {
        membershipRepository.findByUserId(president.getId()).stream()
                .filter(m -> m.getStatus() == MembershipStatus.APPROVED && m.getPosition() == MembershipPosition.PRESIDENT)
                .forEach(presidency -> membershipRepository
                        .findByClubIdAndStatus(presidency.getClub().getId(), MembershipStatus.APPROVED).stream()
                        .filter(m -> m.getPosition() == MembershipPosition.VP || m.getPosition() == MembershipPosition.SECRETARY
                                || m.getPosition() == MembershipPosition.TREASURER)
                        .forEach(officer -> notificationService.notify(officer.getUser(), president.getName()
                                + ", President of " + presidency.getClub().getName() + ", is now marked as graduated. "
                                + "The Vice President can take over from the club page (\"Claim presidency\").")));
    }

    public UserResponse updateProfileImage(UserPrincipal principal, String profileImageB64) {
        InputLimits.requireImageSize(profileImageB64, "profile picture");
        User user = userRepository.findById(principal.getId())
                .orElseThrow(() -> ApiException.notFound("User not found"));
        user.setProfileImageB64(profileImageB64);
        user = userRepository.save(user);
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
    }

    private boolean isBlank(String value) {
        return value == null || value.trim().isEmpty();
    }
}
