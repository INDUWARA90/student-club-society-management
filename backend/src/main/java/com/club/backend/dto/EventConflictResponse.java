package com.club.backend.dto;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

public record EventConflictResponse(
        boolean hasConflict,
        String conflictType,
        UUID conflictingEventId,
        String conflictingEventTitle,
        String conflictingClubName,
        Instant conflictStart,
        Instant conflictEnd,
        String placeName,
        String message,
        Instant nextAvailableStart,
        Instant nextAvailableEnd,
        List<AlternativeVenueDto> alternativeVenues) {

    public record AlternativeVenueDto(
            UUID id,
            String name,
            String building,
            Integer capacity) {}

    public static EventConflictResponse noConflict() {
        return new EventConflictResponse(
                false, null, null, null, null, null, null, null, null, null, null, List.of());
    }
}
