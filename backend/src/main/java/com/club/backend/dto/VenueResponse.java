package com.club.backend.dto;

import java.util.UUID;

import com.club.backend.entity.Venue;

public record VenueResponse(UUID id, String name, String building, Integer capacity, boolean active) {

    public static VenueResponse from(Venue venue) {
        return new VenueResponse(venue.getId(), venue.getName(), venue.getBuilding(), venue.getCapacity(), venue.isActive());
    }
}
