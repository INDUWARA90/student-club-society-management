package com.club.backend.security;

import static org.assertj.core.api.Assertions.assertThat;

import java.io.IOException;

import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockFilterChain;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

import jakarta.servlet.ServletException;

class RateLimitFilterTest {

    private MockHttpServletResponse hit(RateLimitFilter filter, String path, String remoteAddr, String forwardedFor)
            throws ServletException, IOException {
        MockHttpServletRequest request = new MockHttpServletRequest("POST", path);
        request.setRequestURI(path);
        request.setRemoteAddr(remoteAddr);
        if (forwardedFor != null) {
            request.addHeader("X-Forwarded-For", forwardedFor);
        }
        MockHttpServletResponse response = new MockHttpServletResponse();
        filter.doFilter(request, response, new MockFilterChain());
        return response;
    }

    @Test
    void login_isLimitedToTenPerMinutePerIp() throws Exception {
        RateLimitFilter filter = new RateLimitFilter(false);

        for (int i = 0; i < 10; i++) {
            assertThat(hit(filter, "/api/auth/login", "10.0.0.1", null).getStatus()).isEqualTo(200);
        }

        MockHttpServletResponse blocked = hit(filter, "/api/auth/login", "10.0.0.1", null);
        assertThat(blocked.getStatus()).isEqualTo(429);
        assertThat(blocked.getContentAsString()).contains("Too many requests");
    }

    @Test
    void differentIps_haveSeparateBudgets() throws Exception {
        RateLimitFilter filter = new RateLimitFilter(false);
        for (int i = 0; i < 11; i++) {
            hit(filter, "/api/auth/login", "10.0.0.1", null);
        }

        assertThat(hit(filter, "/api/auth/login", "10.0.0.2", null).getStatus()).isEqualTo(200);
    }

    @Test
    void authenticatedAuthRoutes_areNotLimited() throws Exception {
        RateLimitFilter filter = new RateLimitFilter(false);

        for (int i = 0; i < 50; i++) {
            assertThat(hit(filter, "/api/auth/me", "10.0.0.1", null).getStatus()).isEqualTo(200);
            assertThat(hit(filter, "/api/auth/me/password", "10.0.0.1", null).getStatus()).isEqualTo(200);
        }
    }

    @Test
    void otherEndpoints_areNotLimited() throws Exception {
        RateLimitFilter filter = new RateLimitFilter(false);

        for (int i = 0; i < 50; i++) {
            assertThat(hit(filter, "/api/clubs", "10.0.0.1", null).getStatus()).isEqualTo(200);
        }
    }

    @Test
    void spoofedForwardedHeader_isIgnoredUnlessProxyIsTrusted() throws Exception {
        RateLimitFilter filter = new RateLimitFilter(false);

        // An attacker rotating X-Forwarded-For must not get a fresh budget each time.
        for (int i = 0; i < 10; i++) {
            hit(filter, "/api/auth/login", "10.0.0.1", "203.0.113." + i);
        }

        assertThat(hit(filter, "/api/auth/login", "10.0.0.1", "203.0.113.99").getStatus()).isEqualTo(429);
    }

    @Test
    void forwardedHeader_isHonouredBehindATrustedProxy() throws Exception {
        RateLimitFilter filter = new RateLimitFilter(true);

        // Every request arrives from the proxy's address, but real clients differ.
        for (int i = 0; i < 11; i++) {
            hit(filter, "/api/auth/login", "10.0.0.1", "203.0.113.5");
        }

        assertThat(hit(filter, "/api/auth/login", "10.0.0.1", "203.0.113.5").getStatus()).isEqualTo(429);
        assertThat(hit(filter, "/api/auth/login", "10.0.0.1", "198.51.100.7").getStatus()).isEqualTo(200);
    }

    @Test
    void eachSensitivePath_hasItsOwnBudget() throws Exception {
        RateLimitFilter filter = new RateLimitFilter(false);
        for (int i = 0; i < 11; i++) {
            hit(filter, "/api/auth/login", "10.0.0.1", null);
        }

        assertThat(hit(filter, "/api/auth/forgot-password", "10.0.0.1", null).getStatus()).isEqualTo(200);
    }
}
