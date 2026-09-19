package com.club.backend.security;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

class LoginAttemptServiceTest {

    private final LoginAttemptService service = new LoginAttemptService();

    @Test
    void account_locksAfterFiveConsecutiveFailures() {
        for (int i = 0; i < LoginAttemptService.MAX_FAILURES - 1; i++) {
            service.recordFailure("ada@example.com");
            assertThat(service.isLocked("ada@example.com")).isFalse();
        }

        service.recordFailure("ada@example.com");

        assertThat(service.isLocked("ada@example.com")).isTrue();
    }

    @Test
    void successfulLogin_resetsTheCounter() {
        for (int i = 0; i < LoginAttemptService.MAX_FAILURES - 1; i++) {
            service.recordFailure("ada@example.com");
        }
        service.recordSuccess("ada@example.com");
        service.recordFailure("ada@example.com");

        assertThat(service.isLocked("ada@example.com")).isFalse();
    }

    @Test
    void lockouts_areIndependentPerAccount() {
        for (int i = 0; i < LoginAttemptService.MAX_FAILURES; i++) {
            service.recordFailure("ada@example.com");
        }

        assertThat(service.isLocked("ada@example.com")).isTrue();
        assertThat(service.isLocked("grace@example.com")).isFalse();
    }

    @Test
    void unknownEmails_areTrackedToo_soLockoutDoesNotRevealWhichAccountsExist() {
        for (int i = 0; i < LoginAttemptService.MAX_FAILURES; i++) {
            service.recordFailure("nobody@example.com");
        }

        assertThat(service.isLocked("nobody@example.com")).isTrue();
    }
}
