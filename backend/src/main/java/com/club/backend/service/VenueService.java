package com.club.backend.service;

import java.time.Instant;
import java.util.Comparator;
import java.util.List;
import java.util.UUID;

import org.springframework.stereotype.Service;

import com.club.backend.config.ApiException;
import com.club.backend.dto.EventResponse;
import com.club.backend.dto.NextAvailableSlotResponse;
import com.club.backend.dto.VenueRequest;
import com.club.backend.dto.VenueResponse;
import com.club.backend.dto.VenueUtilizationResponse;
import com.club.backend.dto.VenueUtilizationResponse.NextBookingSummary;
import com.club.backend.entity.Event;
import com.club.backend.entity.EventApprovalStatus;
import com.club.backend.entity.Venue;
import com.club.backend.repository.EventRepository;
import com.club.backend.repository.VenueRepository;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class VenueService {

    private final VenueRepository venueRepository;
    private final EventRepository eventRepository;

    public List<VenueResponse> listActiveVenues() {
        return venueRepository.findByActiveTrue().stream().map(VenueResponse::from).toList();
    }

    public VenueResponse createVenue(VenueRequest request) {
        if (request.name() == null || request.name().trim().isEmpty()) {
            throw ApiException.badRequest("Venue name is required");
        }

        Venue venue = Venue.builder()
                .name(request.name().trim())
                .building(request.building())
                .capacity(request.capacity())
                .build();
        venue = venueRepository.save(venue);

        return VenueResponse.from(venue);
    }

    public VenueResponse updateVenue(UUID venueId, VenueRequest request) {
        if (request.name() == null || request.name().trim().isEmpty()) {
            throw ApiException.badRequest("Venue name is required");
        }

        Venue venue = venueRepository.findById(venueId)
                .orElseThrow(() -> ApiException.notFound("Venue not found"));

        venue.setName(request.name().trim());
        venue.setBuilding(request.building());
        venue.setCapacity(request.capacity());
        venue = venueRepository.save(venue);

        return VenueResponse.from(venue);
    }

    public VenueResponse deactivateVenue(UUID venueId) {
        Venue venue = venueRepository.findById(venueId)
                .orElseThrow(() -> ApiException.notFound("Venue not found"));
        venue.setActive(false);
        venue = venueRepository.save(venue);
        return VenueResponse.from(venue);
    }

    /** Bookings at this venue whose start falls within [from, to), for previewing availability before submitting. */
    public List<EventResponse> getBookings(UUID venueId, Instant from, Instant to) {
        if (!venueRepository.existsById(venueId)) {
            throw ApiException.notFound("Venue not found");
        }
        return eventRepository.findByVenueIdAndEventDateBetween(venueId, from, to)
                .stream().map(EventResponse::from).toList();
    }

    /** Busiest-first summary of each active venue's booking load, for capacity-planning at a glance. */
    public List<VenueUtilizationResponse> getUtilizationSummary() {
        Instant now = Instant.now();
        return venueRepository.findByActiveTrue().stream()
                .map(venue -> {
                    List<Event> bookings = eventRepository.findByVenueId(venue.getId()).stream()
                            .filter(e -> e.getApprovalStatus() != EventApprovalStatus.REJECTED && !e.isCancelled())
                            .toList();
                    List<Event> upcoming = bookings.stream()
                            .filter(e -> e.getEventDate() != null && !e.getEventDate().isBefore(now))
                            .sorted(Comparator.comparing(Event::getEventDate))
                            .toList();
                    NextBookingSummary next = upcoming.isEmpty() ? null : toSummary(upcoming.get(0));

                    return new VenueUtilizationResponse(
                            venue.getId(), venue.getName(), venue.getBuilding(),
                            bookings.size(), upcoming.size(), next);
                })
                .sorted(Comparator.comparingLong(VenueUtilizationResponse::upcomingBookingCount).reversed())
                .toList();
    }

    private NextBookingSummary toSummary(Event event) {
        return new NextBookingSummary(
                event.getId(), event.getTitle(), event.getClub().getName(), event.getEventDate(), event.getEndDate());
    }

    private static final int MAX_SLOT_SEARCH_ITERATIONS = 50;
    private static final long SLOT_SEARCH_HORIZON_SECONDS = 14L * 24 * 3600;

    /** Greedily finds the first free window of {@code durationSeconds} at this venue, starting from {@code desiredStart}. */
    public NextAvailableSlotResponse findNextAvailableSlot(UUID venueId, Instant desiredStart, long durationSeconds) {
        if (!venueRepository.existsById(venueId)) {
            throw ApiException.notFound("Venue not found");
        }

        Instant horizon = desiredStart.plusSeconds(SLOT_SEARCH_HORIZON_SECONDS);
        Instant candidateStart = desiredStart;

        for (int i = 0; i < MAX_SLOT_SEARCH_ITERATIONS && candidateStart.isBefore(horizon); i++) {
            Instant candidateEnd = candidateStart.plusSeconds(durationSeconds);
            // Reuse the same UUID sentinel createEvent() uses so no real event id is accidentally excluded.
            List<Event> conflicts = eventRepository.findConflictingBookings(
                    venueId, candidateStart, candidateEnd, new UUID(0, 0));

            if (conflicts.isEmpty()) {
                return new NextAvailableSlotResponse(true, candidateStart, candidateEnd);
            }

            Instant previousStart = candidateStart;
            candidateStart = conflicts.stream()
                    .map(Event::getEndDate)
                    .filter(end -> end != null && end.isAfter(previousStart))
                    .max(Comparator.naturalOrder())
                    .orElse(previousStart.plusSeconds(durationSeconds));
        }

        return new NextAvailableSlotResponse(false, null, null);
    }
}
