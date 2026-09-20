package com.club.backend.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.crypto.password.PasswordEncoder;

import com.club.backend.config.ApiException;
import com.club.backend.dto.AuthResponse;
import com.club.backend.dto.ForgotPasswordRequest;
import com.club.backend.dto.LoginRequest;
import com.club.backend.dto.RegisterRequest;
import com.club.backend.dto.ResetPasswordRequest;
import com.club.backend.entity.PasswordResetToken;
import com.club.backend.entity.Role;
import com.club.backend.entity.User;
import com.club.backend.repository.PasswordResetTokenRepository;
import com.club.backend.repository.UserRepository;
import com.club.backend.security.JwtService;

@ExtendWith(MockitoExtension.class)
class AuthServiceTest {

    @Mock
    private UserRepository userRepository;
    @Mock
    private PasswordResetTokenRepository passwordResetTokenRepository;
    @Mock
    private com.club.backend.repository.EmailVerificationTokenRepository emailVerificationTokenRepository;
    @Mock
    private PasswordEncoder passwordEncoder;
    @Mock
    private AuthenticationManager authenticationManager;
    @Mock
    private JwtService jwtService;
    @Mock
    private MailService mailService;
    @Mock
    private com.club.backend.security.LoginAttemptService loginAttemptService;
    @Mock
    private EmailVerificationPolicy emailVerificationPolicy;
    @Mock
    private com.club.backend.repository.MembershipRepository membershipRepository;
    @Mock
    private NotificationService notificationService;

    @InjectMocks
    private AuthService authService;

    private User user;

    @BeforeEach
    void setUp() {
        user = User.builder()
                .id(UUID.randomUUID())
                .name("Ada Lovelace")
                .email("ada@example.com")
                .passwordHash("hashed")
                .role(Role.STUDENT)
                .build();
    }

    @Test
    void register_rejectsShortPassword() {
        RegisterRequest request = new RegisterRequest("Ada", "ada@example.com", "short");

        assertThatThrownBy(() -> authService.register(request))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("at least 8 characters");
    }

    @Test
    void register_rejectsInvalidEmail() {
        RegisterRequest request = new RegisterRequest("Ada", "not-an-email", "password123");

        assertThatThrownBy(() -> authService.register(request))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("valid email");
    }

    @Test
    void register_rejectsDuplicateEmail() {
        RegisterRequest request = new RegisterRequest("Ada", "ada@example.com", "password123");
        when(userRepository.existsByEmail("ada@example.com")).thenReturn(true);

        assertThatThrownBy(() -> authService.register(request))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("already exists");
    }

    @Test
    void register_createsStudentAndReturnsToken() {
        RegisterRequest request = new RegisterRequest("Ada", "ada@example.com", "password123");
        when(userRepository.existsByEmail("ada@example.com")).thenReturn(false);
        when(passwordEncoder.encode("password123")).thenReturn("hashed");
        when(userRepository.save(any(User.class))).thenReturn(user);
        when(jwtService.generateToken(any(), anyString(), anyString())).thenReturn("jwt-token");

        AuthResponse response = authService.register(request);

        assertThat(response.accessToken()).isEqualTo("jwt-token");
        assertThat(response.user().email()).isEqualTo("ada@example.com");
        assertThat(response.user().role()).isEqualTo(Role.STUDENT);
    }

    @Test
    void login_wrapsBadCredentialsAsApiException() {
        LoginRequest request = new LoginRequest("ada@example.com", "wrong-password");
        when(authenticationManager.authenticate(any())).thenThrow(new BadCredentialsException("bad"));

        assertThatThrownBy(() -> authService.login(request))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("Invalid email or password");
    }

    @Test
    void login_succeedsAndReturnsToken() {
        LoginRequest request = new LoginRequest("ada@example.com", "password123");
        when(userRepository.findByEmail("ada@example.com")).thenReturn(Optional.of(user));
        when(jwtService.generateToken(any(), anyString(), anyString())).thenReturn("jwt-token");

        AuthResponse response = authService.login(request);

        assertThat(response.accessToken()).isEqualTo("jwt-token");
    }

    @Test
    void forgotPassword_silentlyNoOpsForUnknownEmail() {
        when(userRepository.findByEmail("ghost@example.com")).thenReturn(Optional.empty());

        authService.forgotPassword(new ForgotPasswordRequest("ghost@example.com"));

        verify(passwordResetTokenRepository, never()).save(any());
        verify(mailService, never()).sendPasswordResetEmail(anyString(), anyString());
    }

    @Test
    void forgotPassword_savesTokenAndSendsEmailForKnownUser() {
        when(userRepository.findByEmail("ada@example.com")).thenReturn(Optional.of(user));

        authService.forgotPassword(new ForgotPasswordRequest("ada@example.com"));

        verify(passwordResetTokenRepository).save(any(PasswordResetToken.class));
        verify(mailService).sendPasswordResetEmail(anyString(), anyString());
    }

    @Test
    void resetPassword_rejectsExpiredToken() {
        PasswordResetToken token = PasswordResetToken.builder()
                .user(user)
                .token("abc")
                .expiresAt(Instant.now().minusSeconds(60))
                .used(false)
                .build();
        when(passwordResetTokenRepository.findByToken("abc")).thenReturn(Optional.of(token));

        assertThatThrownBy(() -> authService.resetPassword(new ResetPasswordRequest("abc", "newpassword1")))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("Invalid or expired");
    }

    @Test
    void resetPassword_rejectsAlreadyUsedToken() {
        PasswordResetToken token = PasswordResetToken.builder()
                .user(user)
                .token("abc")
                .expiresAt(Instant.now().plusSeconds(60))
                .used(true)
                .build();
        when(passwordResetTokenRepository.findByToken("abc")).thenReturn(Optional.of(token));

        assertThatThrownBy(() -> authService.resetPassword(new ResetPasswordRequest("abc", "newpassword1")))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("Invalid or expired");
    }

    @Test
    void resetPassword_updatesPasswordAndMarksTokenUsed() {
        PasswordResetToken token = PasswordResetToken.builder()
                .user(user)
                .token("abc")
                .expiresAt(Instant.now().plusSeconds(60))
                .used(false)
                .build();
        when(passwordResetTokenRepository.findByToken("abc")).thenReturn(Optional.of(token));
        when(passwordEncoder.encode("newpassword1")).thenReturn("new-hash");

        authService.resetPassword(new ResetPasswordRequest("abc", "newpassword1"));

        assertThat(user.getPasswordHash()).isEqualTo("new-hash");
        assertThat(token.isUsed()).isTrue();
        verify(userRepository).save(user);
        verify(passwordResetTokenRepository).save(token);
    }


    @Test
    void login_lockedAccount_isRefusedWithoutCheckingThePassword() {
        when(loginAttemptService.isLocked("ada@example.com")).thenReturn(true);

        assertThatThrownBy(() -> authService.login(new LoginRequest("ada@example.com", "password123")))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("Too many failed");
        verify(authenticationManager, never()).authenticate(any());
    }

    @Test
    void login_failure_isCountedTowardsLockout() {
        when(authenticationManager.authenticate(any())).thenThrow(new BadCredentialsException("bad"));

        assertThatThrownBy(() -> authService.login(new LoginRequest("Ada@Example.com", "wrong")))
                .isInstanceOf(ApiException.class);

        verify(loginAttemptService).recordFailure("ada@example.com");
    }

    @Test
    void login_success_clearsFailureCount() {
        when(userRepository.findByEmail("ada@example.com")).thenReturn(Optional.of(user));
        when(jwtService.generateToken(any(), anyString(), anyString())).thenReturn("jwt-token");

        authService.login(new LoginRequest("ada@example.com", "password123"));

        verify(loginAttemptService).recordSuccess("ada@example.com");
    }

    @Test
    void login_deactivatedAccount_isRefusedAndNoTokenIssued() {
        user.setActive(false);
        when(userRepository.findByEmail("ada@example.com")).thenReturn(Optional.of(user));

        assertThatThrownBy(() -> authService.login(new LoginRequest("ada@example.com", "password123")))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("deactivated");
        verify(jwtService, never()).generateToken(any(), anyString(), anyString());
    }

    @Test
    void changePassword_revokesOldSessionsAndReturnsFreshToken() {
        when(userRepository.findById(user.getId())).thenReturn(Optional.of(user));
        when(passwordEncoder.matches("current-pass", "hashed")).thenReturn(true);
        when(passwordEncoder.encode("brand-new-pass")).thenReturn("new-hash");
        when(userRepository.save(any(User.class))).thenAnswer(inv -> inv.getArgument(0));
        when(jwtService.generateToken(any(), anyString(), anyString())).thenReturn("fresh-token");

        AuthResponse response = authService.changePassword(new com.club.backend.security.UserPrincipal(user),
                new com.club.backend.dto.ChangePasswordRequest("current-pass", "brand-new-pass"));

        assertThat(response.accessToken()).isEqualTo("fresh-token");
        assertThat(user.getPasswordHash()).isEqualTo("new-hash");
        assertThat(user.getPasswordChangedAt()).isNotNull();
    }

    @Test
    void updateProfile_canTurnOffEmailNotifications() {
        when(userRepository.findById(user.getId())).thenReturn(Optional.of(user));
        when(userRepository.save(any(User.class))).thenAnswer(inv -> inv.getArgument(0));

        var response = authService.updateProfile(new com.club.backend.security.UserPrincipal(user),
                new com.club.backend.dto.UpdateProfileRequest("Ada Lovelace", "ada@example.com", null, false));

        assertThat(response.emailNotificationsEnabled()).isFalse();
        assertThat(user.isEmailNotificationsEnabled()).isFalse();
    }


    @Test
    void register_verificationRequired_newAddress_createsTheAccountButIssuesNoToken() {
        when(emailVerificationPolicy.isRequired()).thenReturn(true);
        when(userRepository.existsByEmail("ada@example.com")).thenReturn(false);
        when(userRepository.save(any(User.class))).thenAnswer(inv -> inv.getArgument(0));

        AuthResponse response = authService.register(new RegisterRequest("Ada", "ada@example.com", "password123"));

        assertThat(response.accessToken()).isNull();
        assertThat(response.user()).isNull();
        verify(userRepository).save(any(User.class));
        verify(mailService).sendVerificationEmail(eq("ada@example.com"), anyString());
        verify(jwtService, never()).generateToken(any(), anyString(), anyString());
    }

    @Test
    void register_verificationRequired_existingAddress_looksIdenticalAndEmailsTheOwner() {
        when(emailVerificationPolicy.isRequired()).thenReturn(true);
        when(userRepository.existsByEmail("ada@example.com")).thenReturn(true);

        AuthResponse response = authService.register(new RegisterRequest("Someone", "Ada@Example.com", "password123"));

        // Same neutral outcome as a brand-new address — nothing reveals that the account exists.
        assertThat(response.accessToken()).isNull();
        assertThat(response.user()).isNull();
        verify(mailService).sendAccountExistsEmail("ada@example.com");
        verify(userRepository, never()).save(any(User.class));
        verify(mailService, never()).sendVerificationEmail(anyString(), anyString());
    }

    @Test
    void register_verificationNotRequired_stillSignsInImmediately() {
        when(emailVerificationPolicy.isRequired()).thenReturn(false);
        when(userRepository.save(any(User.class))).thenAnswer(inv -> {
            User saved = inv.getArgument(0);
            saved.setId(UUID.randomUUID());
            return saved;
        });
        when(jwtService.generateToken(any(), anyString(), anyString())).thenReturn("jwt-token");

        AuthResponse response = authService.register(new RegisterRequest("Ada", "ada@example.com", "password123"));

        assertThat(response.accessToken()).isEqualTo("jwt-token");
    }

    @Test
    void updateProfile_presidentMarkedGraduated_tellsTheClubsOfficers() {
        com.club.backend.entity.Club club = com.club.backend.entity.Club.builder().id(UUID.randomUUID()).name("Chess Club").build();
        User vp = User.builder().id(UUID.randomUUID()).name("Vee").email("vee@example.com").role(Role.STUDENT).build();
        User member = User.builder().id(UUID.randomUUID()).name("Mem").email("mem@example.com").role(Role.STUDENT).build();
        var presidency = com.club.backend.entity.Membership.builder().user(user).club(club)
                .position(com.club.backend.entity.MembershipPosition.PRESIDENT)
                .status(com.club.backend.entity.MembershipStatus.APPROVED).build();
        var vpMembership = com.club.backend.entity.Membership.builder().user(vp).club(club)
                .position(com.club.backend.entity.MembershipPosition.VP)
                .status(com.club.backend.entity.MembershipStatus.APPROVED).build();
        var plain = com.club.backend.entity.Membership.builder().user(member).club(club)
                .position(com.club.backend.entity.MembershipPosition.MEMBER)
                .status(com.club.backend.entity.MembershipStatus.APPROVED).build();
        when(userRepository.findById(user.getId())).thenReturn(Optional.of(user));
        when(userRepository.save(any(User.class))).thenAnswer(inv -> inv.getArgument(0));
        when(membershipRepository.findByUserId(user.getId())).thenReturn(java.util.List.of(presidency));
        when(membershipRepository.findByClubIdAndStatus(club.getId(), com.club.backend.entity.MembershipStatus.APPROVED))
                .thenReturn(java.util.List.of(presidency, vpMembership, plain));

        authService.updateProfile(new com.club.backend.security.UserPrincipal(user),
                new com.club.backend.dto.UpdateProfileRequest("Ada Lovelace", "ada@example.com", 2020));

        verify(notificationService).notify(eq(vp), org.mockito.ArgumentMatchers.contains("Claim presidency"));
        verify(notificationService, never()).notify(eq(member), anyString());
    }

    @Test
    void updateProfile_futureGraduationYear_notifiesNobody() {
        when(userRepository.findById(user.getId())).thenReturn(Optional.of(user));
        when(userRepository.save(any(User.class))).thenAnswer(inv -> inv.getArgument(0));

        authService.updateProfile(new com.club.backend.security.UserPrincipal(user),
                new com.club.backend.dto.UpdateProfileRequest("Ada Lovelace", "ada@example.com", java.time.Year.now().getValue() + 2));

        verify(notificationService, never()).notify(any(User.class), anyString());
    }

    @Test
    void updateProfile_canSwitchToDailyDigest() {
        when(userRepository.findById(user.getId())).thenReturn(Optional.of(user));
        when(userRepository.save(any(User.class))).thenAnswer(inv -> inv.getArgument(0));

        var response = authService.updateProfile(new com.club.backend.security.UserPrincipal(user),
                new com.club.backend.dto.UpdateProfileRequest("Ada Lovelace", "ada@example.com", null, true, true));

        assertThat(response.emailDigestEnabled()).isTrue();
        assertThat(user.isEmailDigestEnabled()).isTrue();
    }

    @Test
    void updateProfileImage_oversizedPicture_isRejected() {
        assertThatThrownBy(() -> authService.updateProfileImage(new com.club.backend.security.UserPrincipal(user),
                "A".repeat(InputLimits.MAX_IMAGE_CHARS + 1)))
                .isInstanceOf(ApiException.class).hasMessageContaining("too large");
    }
}
