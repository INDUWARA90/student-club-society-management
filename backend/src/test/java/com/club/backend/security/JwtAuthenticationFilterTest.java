package com.club.backend.security;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockFilterChain;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.core.context.SecurityContextHolder;

import com.club.backend.entity.Role;
import com.club.backend.entity.User;
import com.club.backend.repository.UserRepository;

class JwtAuthenticationFilterTest {

    private final JwtService jwtService = new JwtService("a-test-secret-that-is-long-enough-1234567890", 3_600_000);
    private final UserRepository userRepository = mock(UserRepository.class);
    private final JwtAuthenticationFilter filter = new JwtAuthenticationFilter(jwtService, userRepository);
    private User user;
    private String token;

    @BeforeEach
    void setUp() {
        SecurityContextHolder.clearContext();
        user = User.builder().id(UUID.randomUUID()).name("Ada").email("ada@example.com")
                .passwordHash("h").role(Role.STUDENT).build();
        when(userRepository.findByEmail("ada@example.com")).thenReturn(Optional.of(user));
        token = jwtService.generateToken(user.getId(), user.getEmail(), user.getRole().name());
    }

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clearContext();
    }

    private boolean authenticated() throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/auth/me");
        request.addHeader("Authorization", "Bearer " + token);
        filter.doFilter(request, new MockHttpServletResponse(), new MockFilterChain());
        return SecurityContextHolder.getContext().getAuthentication() != null;
    }

    @Test
    void validToken_authenticates() throws Exception {
        assertThat(authenticated()).isTrue();
    }

    @Test
    void tokenIssuedBeforeAPasswordChange_isRejected() throws Exception {
        user.setPasswordChangedAt(Instant.now().plusSeconds(5));

        assertThat(authenticated()).isFalse();
    }

    @Test
    void tokenIssuedAfterAPasswordChange_isAccepted() throws Exception {
        user.setPasswordChangedAt(Instant.now().minusSeconds(60));

        assertThat(authenticated()).isTrue();
    }

    @Test
    void tokenIssuedInTheSameSecondAsTheChange_isAccepted() throws Exception {
        // A token minted right after changing the password must survive (JWT times are whole seconds).
        user.setPasswordChangedAt(Instant.now());

        assertThat(authenticated()).isTrue();
    }

    @Test
    void garbageToken_isIgnored() throws Exception {
        token = "not.a.jwt";

        assertThat(authenticated()).isFalse();
    }
}
