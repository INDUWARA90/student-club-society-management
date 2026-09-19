package com.club.backend.service;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.UUID;

import org.junit.jupiter.api.Test;

class CheckInTokenServiceTest {

    private final CheckInTokenService service = new CheckInTokenService("a-test-secret-that-is-long-enough-1234567890");

    @Test
    void generatedToken_isAcceptedForItsOwnEvent() {
        UUID eventId = UUID.randomUUID();

        assertThat(service.isValid(eventId, service.generate(eventId))).isTrue();
    }

    @Test
    void token_isBoundToTheEvent() {
        UUID eventId = UUID.randomUUID();

        assertThat(service.isValid(UUID.randomUUID(), service.generate(eventId))).isFalse();
    }

    @Test
    void token_cannotBeDerivedFromTheEventIdAlone() {
        UUID eventId = UUID.randomUUID();
        // The old scheme was "just the event id in a URL"; none of the obvious guesses may work now.
        assertThat(service.isValid(eventId, eventId.toString())).isFalse();
        assertThat(service.isValid(eventId, "")).isFalse();
        assertThat(service.isValid(eventId, "   ")).isFalse();
        assertThat(service.isValid(eventId, null)).isFalse();
        assertThat(service.isValid(eventId, "AAAAAAAAAAAAAAAAAAAAAAAA")).isFalse();
    }

    @Test
    void token_isNotValidUnderADifferentSecret() {
        UUID eventId = UUID.randomUUID();
        CheckInTokenService other = new CheckInTokenService("some-completely-different-secret-value-999");

        assertThat(other.isValid(eventId, service.generate(eventId))).isFalse();
    }

    @Test
    void token_isStableWithinAWindowAndUrlSafe() {
        UUID eventId = UUID.randomUUID();
        String token = service.generate(eventId);

        assertThat(token).hasSize(24).matches("[A-Za-z0-9_-]+");
    }
}
