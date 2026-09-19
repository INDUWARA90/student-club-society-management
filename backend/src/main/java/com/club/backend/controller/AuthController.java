package com.club.backend.controller;

import java.util.Map;

import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.club.backend.dto.AuthResponse;
import com.club.backend.dto.ChangePasswordRequest;
import com.club.backend.dto.ForgotPasswordRequest;
import com.club.backend.dto.LoginRequest;
import com.club.backend.dto.RegisterRequest;
import com.club.backend.dto.ResetPasswordRequest;
import com.club.backend.dto.UpdateProfileImageRequest;
import com.club.backend.dto.UpdateProfileRequest;
import com.club.backend.dto.UserResponse;
import com.club.backend.dto.VerifyEmailRequest;
import com.club.backend.security.UserPrincipal;
import com.club.backend.service.AuthService;

import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {

    private final AuthService authService;

    @PostMapping("/register")
    public ResponseEntity<Object> register(@RequestBody RegisterRequest request) {
        AuthResponse response = authService.register(request);
        if (response.accessToken() == null) {
            // Verification is required: same neutral answer whether or not the address was already registered.
            return ResponseEntity.accepted().body(Map.of("message", "Check your email to finish creating your account."));
        }
        return ResponseEntity.ok(response);
    }

    @PostMapping("/login")
    public ResponseEntity<AuthResponse> login(@RequestBody LoginRequest request) {
        return ResponseEntity.ok(authService.login(request));
    }

    @PostMapping("/forgot-password")
    public ResponseEntity<Void> forgotPassword(@RequestBody ForgotPasswordRequest request) {
        authService.forgotPassword(request);
        return ResponseEntity.ok().build();
    }

    @PostMapping("/reset-password")
    public ResponseEntity<Void> resetPassword(@RequestBody ResetPasswordRequest request) {
        authService.resetPassword(request);
        return ResponseEntity.ok().build();
    }

    @PostMapping("/verify-email")
    public ResponseEntity<Void> verifyEmail(@RequestBody VerifyEmailRequest request) {
        authService.verifyEmail(request.token());
        return ResponseEntity.ok().build();
    }

    @PostMapping("/resend-verification")
    public ResponseEntity<Void> resendVerification(@AuthenticationPrincipal UserPrincipal principal) {
        authService.resendVerificationEmail(principal);
        return ResponseEntity.ok().build();
    }

    @GetMapping("/me")
    public ResponseEntity<UserResponse> me(@AuthenticationPrincipal UserPrincipal principal) {
        return ResponseEntity.ok(authService.currentUser(principal));
    }

    @PutMapping("/me/profile")
    public ResponseEntity<UserResponse> updateProfile(@RequestBody UpdateProfileRequest request,
            @AuthenticationPrincipal UserPrincipal principal) {
        return ResponseEntity.ok(authService.updateProfile(principal, request));
    }

    @PutMapping("/me/profile-image")
    public ResponseEntity<UserResponse> updateProfileImage(@RequestBody UpdateProfileImageRequest request,
            @AuthenticationPrincipal UserPrincipal principal) {
        return ResponseEntity.ok(authService.updateProfileImage(principal, request.profileImageB64()));
    }

    @PutMapping("/me/password")
    public ResponseEntity<AuthResponse> changePassword(@RequestBody ChangePasswordRequest request,
            @AuthenticationPrincipal UserPrincipal principal) {
        return ResponseEntity.ok(authService.changePassword(principal, request));
    }
}
