package com.club.backend.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import com.club.backend.config.ApiException;
import com.club.backend.dto.NextAvailableSlotResponse;
import com.club.backend.dto.VenueRequest;
import com.club.backend.dto.VenueResponse;
import com.club.backend.dto.VenueUtilizationResponse;
import com.club.backend.entity.Club;
import com.club.backend.entity.Event;
import com.club.backend.entity.EventApprovalStatus;
import com.club.backend.entity.Venue;
import com.club.backend.repository.EventRepository;
import com.club.backend.repository.VenueRepository;

@ExtendWith(MockitoExtension.class)
class VenueServiceTest {

    @Mock
    private VenueRepository venueRepository;
    @Mock
    private EventRepository eventRepository;

    @InjectMocks
    private VenueService venueService;

    @Test
    void createVenue_blankName_throws() {
        VenueRequest request = new VenueRequest("  ", null, null);

        assertThatThrownBy(() -> venueService.createVenue(request))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("name");
    }

    @Test
    void createVenue_valid_saves() {
        VenueRequest request = new VenueRequest("Main Hall", "Building A", 200);
        when(venueRepository.save(any(Venue.class))).thenAnswer(inv -> inv.getArgument(0));

        VenueResponse response = venueService.createVenue(request);

        assertThat(response.name()).isEqualTo("Main Hall");
        assertThat(response.building()).isEqualTo("Building A");
        assertThat(response.capacity()).isEqualTo(200);
        assertThat(response.active()).isTrue();
    }

    @Test
    void listActiveVenues_onlyReturnsActive() {
        Venue active = Venue.builder().id(UUID.randomUUID()).name("Hall A").active(true).build();
        when(venueRepository.findByActiveTrue()).thenReturn(List.of(active));

        List<VenueResponse> venues = venueService.listActiveVenues();

        assertThat(venues).hasSize(1);
        assertThat(venues.get(0).name()).isEqualTo("Hall A");
    }

    @Test
    void updateVenue_notFound_throws() {
        UUID venueId = UUID.randomUUID();
        when(venueRepository.findById(venueId)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> venueService.updateVenue(venueId, new VenueRequest("Hall B", null, null)))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("not found");
    }

    @Test
    void getBookings_venueNotFound_throws() {
        UUID venueId = UUID.randomUUID();
        when(venueRepository.existsById(venueId)).thenReturn(false);

        assertThatThrownBy(() -> venueService.getBookings(venueId, null, null))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("not found");
    }

    @Test
    void getUtilizationSummary_noBookings_returnsZeroCounts() {
        Venue venue = Venue.builder().id(UUID.randomUUID()).name("Hall A").active(true).build();
        when(venueRepository.findByActiveTrue()).thenReturn(List.of(venue));
        when(eventRepository.findByVenueId(venue.getId())).thenReturn(List.of());

        List<VenueUtilizationResponse> summary = venueService.getUtilizationSummary();

        assertThat(summary).hasSize(1);
        assertThat(summary.get(0).totalBookings()).isZero();
        assertThat(summary.get(0).upcomingBookingCount()).isZero();
        assertThat(summary.get(0).nextBooking()).isNull();
    }

    @Test
    void getUtilizationSummary_excludesRejectedAndPastBookings() {
        Venue venue = Venue.builder().id(UUID.randomUUID()).name("Hall A").active(true).build();
        Club club = Club.builder().id(UUID.randomUUID()).name("Tech Club").build();
        Instant future = Instant.now().plusSeconds(3600);
        Instant past = Instant.now().minusSeconds(3600);

        Event upcoming = Event.builder().id(UUID.randomUUID()).club(club).title("Upcoming")
                .eventDate(future).endDate(future.plusSeconds(1800)).approvalStatus(EventApprovalStatus.APPROVED).build();
        Event rejected = Event.builder().id(UUID.randomUUID()).club(club).title("Rejected")
                .eventDate(future).endDate(future.plusSeconds(1800)).approvalStatus(EventApprovalStatus.REJECTED).build();
        Event pastEvent = Event.builder().id(UUID.randomUUID()).club(club).title("Past")
                .eventDate(past).endDate(past.plusSeconds(1800)).approvalStatus(EventApprovalStatus.NOT_REQUIRED).build();

        when(venueRepository.findByActiveTrue()).thenReturn(List.of(venue));
        when(eventRepository.findByVenueId(venue.getId())).thenReturn(List.of(upcoming, rejected, pastEvent));

        List<VenueUtilizationResponse> summary = venueService.getUtilizationSummary();

        assertThat(summary.get(0).totalBookings()).isEqualTo(2); // rejected excluded, past+upcoming both count
        assertThat(summary.get(0).upcomingBookingCount()).isEqualTo(1);
        assertThat(summary.get(0).nextBooking().title()).isEqualTo("Upcoming");
    }

    @Test
    void findNextAvailableSlot_noConflicts_returnsDesiredStart() {
        UUID venueId = UUID.randomUUID();
        Instant start = Instant.now();
        when(venueRepository.existsById(venueId)).thenReturn(true);
        when(eventRepository.findConflictingBookings(any(), any(), any(), any())).thenReturn(List.of());

        NextAvailableSlotResponse response = venueService.findNextAvailableSlot(venueId, start, 3600);

        assertThat(response.found()).isTrue();
        assertThat(response.start()).isEqualTo(start);
        assertThat(response.end()).isEqualTo(start.plusSeconds(3600));
    }

    @Test
    void findNextAvailableSlot_conflictThenFree_advancesPastConflict() {
        UUID venueId = UUID.randomUUID();
        Instant start = Instant.now();
        Instant conflictEnd = start.plusSeconds(1800);
        Event conflicting = Event.builder().id(UUID.randomUUID()).endDate(conflictEnd).build();

        when(venueRepository.existsById(venueId)).thenReturn(true);
        when(eventRepository.findConflictingBookings(any(), any(), any(), any()))
                .thenReturn(List.of(conflicting))
                .thenReturn(List.of());

        NextAvailableSlotResponse response = venueService.findNextAvailableSlot(venueId, start, 3600);

        assertThat(response.found()).isTrue();
        assertThat(response.start()).isEqualTo(conflictEnd);
    }

    @Test
    void findNextAvailableSlot_venueNotFound_throws() {
        UUID venueId = UUID.randomUUID();
        when(venueRepository.existsById(venueId)).thenReturn(false);

        assertThatThrownBy(() -> venueService.findNextAvailableSlot(venueId, Instant.now(), 3600))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("not found");
    }
}
