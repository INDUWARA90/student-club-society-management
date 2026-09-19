package com.club.backend.dto;

import java.time.Instant;

public record NextAvailableSlotResponse(boolean found, Instant start, Instant end) {
}
