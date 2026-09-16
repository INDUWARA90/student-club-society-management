package com.club.backend.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
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
}
