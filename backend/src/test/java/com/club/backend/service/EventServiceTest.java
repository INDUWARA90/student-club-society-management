package com.club.backend.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyCollection;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.test.util.ReflectionTestUtils;

import com.club.backend.config.ApiException;
import com.club.backend.dto.CreateEventRequest;
import com.club.backend.dto.EventResponse;
import com.club.backend.entity.Club;
import com.club.backend.entity.ClubStatus;
import com.club.backend.entity.Event;
import com.club.backend.entity.EventApprovalStatus;
import com.club.backend.entity.Membership;
import com.club.backend.entity.MembershipPosition;
import com.club.backend.entity.MembershipStatus;
import com.club.backend.entity.Role;
import com.club.backend.entity.Rsvp;
import com.club.backend.entity.RsvpStatus;
import com.club.backend.entity.User;
import com.club.backend.entity.Venue;
import com.club.backend.repository.ClubRepository;
import com.club.backend.repository.EventRepository;
import com.club.backend.repository.MembershipRepository;
import com.club.backend.repository.PaymentRepository;
import com.club.backend.repository.RsvpRepository;
import com.club.backend.repository.UserRepository;
import com.club.backend.repository.VenueRepository;
import com.club.backend.security.UserPrincipal;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class EventServiceTest {

    @Mock
    private EventRepository eventRepository;
    @Mock
    private ClubRepository clubRepository;
    @Mock
    private MembershipRepository membershipRepository;
    @Mock
    private UserRepository userRepository;
    @Mock
    private VenueRepository venueRepository;
    @Mock
    private RsvpRepository rsvpRepository;
    @Mock
    private PaymentRepository paymentRepository;
    @Mock
    private PaymentService paymentService;
    @Mock
    private RsvpService rsvpService;
    @Mock
    private AuditLogService auditLogService;
    @Mock
    private NotificationService notificationService;
    @Mock
    private CheckInTokenService checkInTokenService;

    @InjectMocks
    private EventService eventService;

    private User president;
    private Club club;
    private UserPrincipal principal;
    private Instant future;

    @BeforeEach
    void setUp() {
        president = User.builder().id(UUID.randomUUID()).name("Pres").email("pres@example.com").role(Role.STUDENT).build();
        club = Club.builder().id(UUID.randomUUID()).name("Chess Club").category("Games").createdBy(president)
                .status(ClubStatus.APPROVED).build();
        principal = new UserPrincipal(president);
        future = Instant.now().plusSeconds(7 * 86_400);

        when(clubRepository.findById(club.getId())).thenReturn(Optional.of(club));
        when(userRepository.findById(president.getId())).thenReturn(Optional.of(president));
        when(eventRepository.save(any(Event.class))).thenAnswer(inv -> inv.getArgument(0));
        ReflectionTestUtils.setField(eventService, "frontendUrl", "http://localhost:5173");
    }

    private void asOfficer(MembershipPosition position) {
        Membership membership = Membership.builder().position(position).status(MembershipStatus.APPROVED).build();
        when(membershipRepository.findByUserIdAndClubId(president.getId(), club.getId()))
                .thenReturn(Optional.of(membership));
    }

    private CreateEventRequest request(String title, Instant date, BigDecimal fee, Integer capacity, UUID venueId, Instant end) {
        return new CreateEventRequest(title, null, null, null, date, fee, capacity, venueId, end);
    }

    private Event existingEvent(BigDecimal fee, EventApprovalStatus status) {
        Event event = Event.builder().id(UUID.randomUUID()).club(club).title("Old title").eventDate(future)
                .fee(fee).approvalStatus(status).requiresFaApproval(status != EventApprovalStatus.NOT_REQUIRED).build();
        when(eventRepository.findById(event.getId())).thenReturn(Optional.of(event));
        when(eventRepository.findByIdForUpdate(event.getId())).thenReturn(Optional.of(event));
        return event;
    }

    // ---- create

    @Test
    void createEvent_blankTitle_throws() {
        assertThatThrownBy(() -> eventService.createEvent(club.getId(), request("  ", future, null, null, null, null), principal))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("title");
    }

    @Test
    void createEvent_nonOfficer_throws() {
        when(membershipRepository.findByUserIdAndClubId(president.getId(), club.getId())).thenReturn(Optional.empty());

        assertThatThrownBy(() -> eventService.createEvent(club.getId(), request("Tournament", future, null, null, null, null), principal))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("officers");
    }

    @Test
    void createEvent_inThePast_throws() {
        asOfficer(MembershipPosition.PRESIDENT);

        assertThatThrownBy(() -> eventService.createEvent(club.getId(),
                request("Tournament", Instant.now().minusSeconds(3600), null, null, null, null), principal))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("in the future");
    }

    @Test
    void createEvent_forUnapprovedClub_throws() {
        club.setStatus(ClubStatus.PENDING);
        asOfficer(MembershipPosition.PRESIDENT);

        assertThatThrownBy(() -> eventService.createEvent(club.getId(), request("Tournament", future, null, null, null, null), principal))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("active, approved club");
    }

    @Test
    void createEvent_negativeFeeOrCapacity_throws() {
        asOfficer(MembershipPosition.PRESIDENT);

        assertThatThrownBy(() -> eventService.createEvent(club.getId(),
                request("Tournament", future, new BigDecimal("-1"), null, null, null), principal))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("Fee");
        assertThatThrownBy(() -> eventService.createEvent(club.getId(),
                request("Tournament", future, null, 0, null, null), principal))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("Capacity");
    }

    @Test
    void createEvent_feeAboveThreshold_requiresFaApprovalAndNotifiesAdvisors() {
        asOfficer(MembershipPosition.PRESIDENT);
        User advisor = User.builder().id(UUID.randomUUID()).name("FA").email("fa@example.com").role(Role.FACULTY_ADVISOR).build();
        when(userRepository.findByRole(Role.FACULTY_ADVISOR)).thenReturn(List.of(advisor));

        EventResponse response = eventService.createEvent(club.getId(),
                request("Gala", future, new BigDecimal("10000"), null, null, null), principal);

        assertThat(response.requiresFaApproval()).isTrue();
        assertThat(response.approvalStatus()).isEqualTo(EventApprovalStatus.PENDING);
        verify(notificationService).notifyUsers(eq(List.of(advisor.getId())), anyString());
    }

    @Test
    void createEvent_feeBelowThreshold_doesNotRequireApproval() {
        asOfficer(MembershipPosition.PRESIDENT);

        EventResponse response = eventService.createEvent(club.getId(),
                request("Meetup", future, BigDecimal.ZERO, null, null, null), principal);

        assertThat(response.requiresFaApproval()).isFalse();
        assertThat(response.approvalStatus()).isEqualTo(EventApprovalStatus.NOT_REQUIRED);
        verify(notificationService, never()).notifyUsers(anyCollection(), anyString());
    }

    @Test
    void createEvent_venueEndBeforeStart_throws() {
        Venue venue = Venue.builder().id(UUID.randomUUID()).name("Hall A").active(true).build();
        asOfficer(MembershipPosition.PRESIDENT);

        assertThatThrownBy(() -> eventService.createEvent(club.getId(),
                request("Gala", future, null, null, venue.getId(), future.minusSeconds(60)), principal))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("end time");
    }

    @Test
    void createEvent_overlappingVenueBooking_throwsConflict() {
        Venue venue = Venue.builder().id(UUID.randomUUID()).name("Hall A").active(true).build();
        asOfficer(MembershipPosition.PRESIDENT);
        Event existingBooking = Event.builder().id(UUID.randomUUID()).club(club).title("Other Event").eventDate(future).build();
        when(venueRepository.findById(venue.getId())).thenReturn(Optional.of(venue));
        when(eventRepository.findConflictingBookings(any(), any(), any(), any())).thenReturn(List.of(existingBooking));

        assertThatThrownBy(() -> eventService.createEvent(club.getId(),
                request("Gala", future, null, null, venue.getId(), future.plusSeconds(3600)), principal))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("already booked");
    }

    @Test
    void createEvent_nonOverlappingVenueBooking_succeeds() {
        Venue venue = Venue.builder().id(UUID.randomUUID()).name("Hall A").active(true).build();
        asOfficer(MembershipPosition.PRESIDENT);
        Instant end = future.plusSeconds(3600);
        when(venueRepository.findById(venue.getId())).thenReturn(Optional.of(venue));
        when(eventRepository.findConflictingBookings(any(), any(), any(), any())).thenReturn(List.of());

        EventResponse response = eventService.createEvent(club.getId(),
                request("Gala", future, null, null, venue.getId(), end), principal);

        assertThat(response.venueId()).isEqualTo(venue.getId());
        assertThat(response.endDate()).isEqualTo(end);
    }

    @Test
    void createEvent_capacityAboveVenueCapacity_throws() {
        Venue venue = Venue.builder().id(UUID.randomUUID()).name("Hall A").capacity(50).active(true).build();
        asOfficer(MembershipPosition.PRESIDENT);
        when(venueRepository.findById(venue.getId())).thenReturn(Optional.of(venue));
        when(eventRepository.findConflictingBookings(any(), any(), any(), any())).thenReturn(List.of());

        assertThatThrownBy(() -> eventService.createEvent(club.getId(),
                request("Gala", future, null, 80, venue.getId(), future.plusSeconds(3600)), principal))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("exceeds");
    }

    @Test
    void createEvent_unlimitedCapacityInVenue_inheritsVenueCapacity() {
        Venue venue = Venue.builder().id(UUID.randomUUID()).name("Hall A").capacity(50).active(true).build();
        asOfficer(MembershipPosition.PRESIDENT);
        when(venueRepository.findById(venue.getId())).thenReturn(Optional.of(venue));
        when(eventRepository.findConflictingBookings(any(), any(), any(), any())).thenReturn(List.of());

        EventResponse response = eventService.createEvent(club.getId(),
                request("Gala", future, null, null, venue.getId(), future.plusSeconds(3600)), principal);

        assertThat(response.capacity()).isEqualTo(50);
    }

    // ---- update

    @Test
    void updateEvent_feeChangeAfterSignups_throws() {
        Event event = existingEvent(new BigDecimal("100"), EventApprovalStatus.NOT_REQUIRED);
        asOfficer(MembershipPosition.PRESIDENT);
        when(rsvpRepository.countByEventIdAndStatus(event.getId(), RsvpStatus.GOING)).thenReturn(2L);

        assertThatThrownBy(() -> eventService.updateEvent(event.getId(),
                request("Old title", future, new BigDecimal("150"), null, null, null), principal))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("fee can't be changed");
    }

    @Test
    void updateEvent_capacityBelowConfirmedRsvps_throws() {
        Event event = existingEvent(BigDecimal.ZERO, EventApprovalStatus.NOT_REQUIRED);
        asOfficer(MembershipPosition.PRESIDENT);
        when(rsvpRepository.countByEventIdAndStatus(event.getId(), RsvpStatus.GOING)).thenReturn(10L);

        assertThatThrownBy(() -> eventService.updateEvent(event.getId(),
                request("Old title", future, BigDecimal.ZERO, 5, null, null), principal))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("Capacity can't be lower");
    }

    @Test
    void updateEvent_approvedEventKeepsApprovalWhenFeeDoesNotRise() {
        Event event = existingEvent(new BigDecimal("8000"), EventApprovalStatus.APPROVED);
        asOfficer(MembershipPosition.PRESIDENT);

        EventResponse response = eventService.updateEvent(event.getId(),
                request("Renamed gala", future, new BigDecimal("8000"), null, null, null), principal);

        assertThat(response.approvalStatus()).isEqualTo(EventApprovalStatus.APPROVED);
        assertThat(response.title()).isEqualTo("Renamed gala");
    }

    @Test
    void updateEvent_approvedEventNeedsFreshSignOffWhenFeeRises() {
        Event event = existingEvent(new BigDecimal("6000"), EventApprovalStatus.APPROVED);
        asOfficer(MembershipPosition.PRESIDENT);

        EventResponse response = eventService.updateEvent(event.getId(),
                request("Old title", future, new BigDecimal("9000"), null, null, null), principal);

        assertThat(response.approvalStatus()).isEqualTo(EventApprovalStatus.PENDING);
    }

    @Test
    void updateEvent_rejectedEventIsResubmittedAndReasonCleared() {
        Event event = existingEvent(new BigDecimal("9000"), EventApprovalStatus.REJECTED);
        event.setRejectionReason("Too expensive");
        asOfficer(MembershipPosition.PRESIDENT);

        EventResponse response = eventService.updateEvent(event.getId(),
                request("Old title", future, new BigDecimal("9000"), null, null, null), principal);

        assertThat(response.approvalStatus()).isEqualTo(EventApprovalStatus.PENDING);
        assertThat(response.rejectionReason()).isNull();
    }

    @Test
    void updateEvent_changedTime_notifiesEveryoneSignedUp() {
        Event event = existingEvent(BigDecimal.ZERO, EventApprovalStatus.NOT_REQUIRED);
        asOfficer(MembershipPosition.PRESIDENT);
        User attendee = User.builder().id(UUID.randomUUID()).name("A").email("a@example.com").role(Role.STUDENT).build();
        when(rsvpRepository.findByEventIdAndStatus(event.getId(), RsvpStatus.GOING))
                .thenReturn(List.of(Rsvp.builder().event(event).user(attendee).status(RsvpStatus.GOING).build()));

        eventService.updateEvent(event.getId(),
                request("Old title", future.plusSeconds(7200), BigDecimal.ZERO, null, null, null), principal);

        verify(notificationService).notifyUsers(eq(List.of(attendee.getId())), org.mockito.ArgumentMatchers.contains("Details changed"));
    }

    @Test
    void updateEvent_raisedCapacity_promotesFromWaitlist() {
        Event event = existingEvent(BigDecimal.ZERO, EventApprovalStatus.NOT_REQUIRED);
        event.setCapacity(5);
        asOfficer(MembershipPosition.PRESIDENT);

        eventService.updateEvent(event.getId(), request("Old title", future, BigDecimal.ZERO, 8, null, null), principal);

        verify(rsvpService).promoteFromWaitlist(event);
    }

    @Test
    void updateEvent_cancelledEvent_throws() {
        Event event = existingEvent(BigDecimal.ZERO, EventApprovalStatus.NOT_REQUIRED);
        event.setCancelled(true);
        asOfficer(MembershipPosition.PRESIDENT);

        assertThatThrownBy(() -> eventService.updateEvent(event.getId(),
                request("Old title", future, BigDecimal.ZERO, null, null, null), principal))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("cancelled");
    }

    // ---- cancel

    @Test
    void cancelEvent_marksCancelledRefundsAndNotifies() {
        Event event = existingEvent(new BigDecimal("100"), EventApprovalStatus.NOT_REQUIRED);
        asOfficer(MembershipPosition.SECRETARY);
        User attendee = User.builder().id(UUID.randomUUID()).name("A").email("a@example.com").role(Role.STUDENT).build();
        when(rsvpRepository.findByEventIdAndStatus(event.getId(), RsvpStatus.GOING))
                .thenReturn(List.of(Rsvp.builder().event(event).user(attendee).status(RsvpStatus.GOING).build()));

        EventResponse response = eventService.cancelEvent(event.getId(), "Venue flooded", principal);

        assertThat(response.cancelled()).isTrue();
        assertThat(response.cancelReason()).isEqualTo("Venue flooded");
        verify(paymentService).refundAllForEvent(event, "event cancelled");
        verify(notificationService).notifyUsers(eq(List.of(attendee.getId())),
                eq("\"Old title\" has been cancelled: Venue flooded."));
        verify(auditLogService).log(eq(president), eq("CANCEL_EVENT"), eq("EVENT"), eq(event.getId()), anyString());
    }

    @Test
    void cancelEvent_byNonOfficer_throwsForbidden() {
        Event event = existingEvent(BigDecimal.ZERO, EventApprovalStatus.NOT_REQUIRED);
        when(membershipRepository.findByUserIdAndClubId(president.getId(), club.getId()))
                .thenReturn(Optional.of(Membership.builder().position(MembershipPosition.MEMBER)
                        .status(MembershipStatus.APPROVED).build()));

        assertThatThrownBy(() -> eventService.cancelEvent(event.getId(), null, principal))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("officers");
    }

    @Test
    void cancelEvent_alreadyStarted_throws() {
        Event event = existingEvent(BigDecimal.ZERO, EventApprovalStatus.NOT_REQUIRED);
        event.setEventDate(Instant.now().minusSeconds(60));
        asOfficer(MembershipPosition.PRESIDENT);

        assertThatThrownBy(() -> eventService.cancelEvent(event.getId(), null, principal))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("already started");
    }

    @Test
    void cancelEvent_twice_throws() {
        Event event = existingEvent(BigDecimal.ZERO, EventApprovalStatus.NOT_REQUIRED);
        event.setCancelled(true);
        asOfficer(MembershipPosition.PRESIDENT);

        assertThatThrownBy(() -> eventService.cancelEvent(event.getId(), null, principal))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("already cancelled");
    }

    // ---- visibility

    @Test
    void getEvent_pendingEvent_hiddenFromOrdinaryUsers() {
        Event event = existingEvent(new BigDecimal("9000"), EventApprovalStatus.PENDING);
        User stranger = User.builder().id(UUID.randomUUID()).name("S").email("s@example.com").role(Role.STUDENT).build();
        when(userRepository.findById(stranger.getId())).thenReturn(Optional.of(stranger));
        when(membershipRepository.findByUserIdAndClubId(stranger.getId(), club.getId())).thenReturn(Optional.empty());

        assertThatThrownBy(() -> eventService.getEvent(event.getId(), new UserPrincipal(stranger)))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("not found");
    }

    @Test
    void getEvent_pendingEvent_visibleToOfficersAndAdvisors() {
        Event event = existingEvent(new BigDecimal("9000"), EventApprovalStatus.PENDING);
        asOfficer(MembershipPosition.TREASURER);
        assertThat(eventService.getEvent(event.getId(), principal).id()).isEqualTo(event.getId());

        User advisor = User.builder().id(UUID.randomUUID()).name("FA").email("fa@example.com").role(Role.FACULTY_ADVISOR).build();
        when(userRepository.findById(advisor.getId())).thenReturn(Optional.of(advisor));
        assertThat(eventService.getEvent(event.getId(), new UserPrincipal(advisor)).id()).isEqualTo(event.getId());
    }

    @Test
    void getEvent_publishedEvent_visibleToAnyone() {
        Event event = existingEvent(BigDecimal.ZERO, EventApprovalStatus.NOT_REQUIRED);

        assertThat(eventService.getEvent(event.getId(), null).id()).isEqualTo(event.getId());
    }

    @Test
    void listPublishedEvents_delegatesFilteringAndSortingToTheDatabase() {
        Event live = Event.builder().id(UUID.randomUUID()).club(club).title("Chess night").eventDate(future)
                .approvalStatus(EventApprovalStatus.NOT_REQUIRED).build();
        when(eventRepository.findAll(any(org.springframework.data.jpa.domain.Specification.class),
                any(org.springframework.data.domain.Sort.class))).thenReturn(List.of(live));

        assertThat(eventService.listPublishedEvents(null)).extracting(EventResponse::id).containsExactly(live.getId());
        assertThat(eventService.listPublishedEvents(club.getId(), "chess", "Games", future.minusSeconds(1), future.plusSeconds(1)))
                .hasSize(1);

        verify(eventRepository, org.mockito.Mockito.times(2)).findAll(
                any(org.springframework.data.jpa.domain.Specification.class),
                eq(org.springframework.data.domain.Sort.by("eventDate")));
    }

    @Test
    void pagePublishedEvents_returnsOnePageAndTheTotalCount() {
        Event live = Event.builder().id(UUID.randomUUID()).club(club).title("Chess night").eventDate(future)
                .approvalStatus(EventApprovalStatus.NOT_REQUIRED).build();
        var pageable = org.springframework.data.domain.PageRequest.of(2, 1);
        when(eventRepository.findAll(any(org.springframework.data.jpa.domain.Specification.class),
                any(org.springframework.data.domain.Pageable.class)))
                .thenReturn(new org.springframework.data.domain.PageImpl<>(List.of(live), pageable, 9));

        var page = eventService.pagePublishedEvents(null, null, null, null, null, pageable);

        assertThat(page.getTotalElements()).isEqualTo(9);
        assertThat(page.getContent()).extracting(EventResponse::id).containsExactly(live.getId());
    }

    // ---- budget and size limits

    @Test
    void createEvent_storesBudget_andRejectsNegativeOnes() {
        asOfficer(MembershipPosition.PRESIDENT);

        EventResponse response = eventService.createEvent(club.getId(), new CreateEventRequest(
                "Gala", null, null, null, future, null, null, null, null, new BigDecimal("1200")), principal);
        assertThat(response.budget()).isEqualByComparingTo("1200");

        assertThatThrownBy(() -> eventService.createEvent(club.getId(), new CreateEventRequest(
                "Gala", null, null, null, future, null, null, null, null, new BigDecimal("-1")), principal))
                .isInstanceOf(ApiException.class).hasMessageContaining("Budget");
    }

    @Test
    void updateEvent_canChangeOrClearTheBudget() {
        Event event = existingEvent(BigDecimal.ZERO, EventApprovalStatus.NOT_REQUIRED);
        event.setBudget(new BigDecimal("500"));
        asOfficer(MembershipPosition.PRESIDENT);

        EventResponse changed = eventService.updateEvent(event.getId(), new CreateEventRequest(
                "Old title", null, null, null, future, BigDecimal.ZERO, null, null, null, new BigDecimal("800")), principal);
        assertThat(changed.budget()).isEqualByComparingTo("800");

        EventResponse cleared = eventService.updateEvent(event.getId(),
                request("Old title", future, BigDecimal.ZERO, null, null, null), principal);
        assertThat(cleared.budget()).isNull();
    }

    @Test
    void createEvent_oversizedBanner_isRejected() {
        asOfficer(MembershipPosition.PRESIDENT);
        String huge = "A".repeat(InputLimits.MAX_IMAGE_CHARS + 1);

        assertThatThrownBy(() -> eventService.createEvent(club.getId(), new CreateEventRequest(
                "Gala", null, null, huge, future, null, null, null, null), principal))
                .isInstanceOf(ApiException.class).hasMessageContaining("too large");
    }

    // ---- review

    @Test
    void reviewEvent_notPending_throws() {
        Event event = Event.builder().id(UUID.randomUUID()).club(club).approvalStatus(EventApprovalStatus.APPROVED).build();
        when(eventRepository.findById(event.getId())).thenReturn(Optional.of(event));

        assertThatThrownBy(() -> eventService.reviewEvent(event.getId(), true, principal))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("pending");
    }

    @Test
    void reviewEvent_rejectWithReason_storesAndSendsReason() {
        Event event = existingEvent(new BigDecimal("9000"), EventApprovalStatus.PENDING);
        Membership presidentMembership = Membership.builder().user(president).club(club)
                .position(MembershipPosition.PRESIDENT).status(MembershipStatus.APPROVED).build();
        when(membershipRepository.findByClubIdAndPosition(club.getId(), MembershipPosition.PRESIDENT))
                .thenReturn(Optional.of(presidentMembership));

        EventResponse response = eventService.reviewEvent(event.getId(), false, "  Budget too high  ", principal);

        assertThat(response.approvalStatus()).isEqualTo(EventApprovalStatus.REJECTED);
        assertThat(response.rejectionReason()).isEqualTo("Budget too high");
        verify(notificationService).notify(eq(president), org.mockito.ArgumentMatchers.contains("Reason: Budget too high"));
    }

    // ---- calendar + QR

    @Test
    void generateIcs_usesEndDateAndEscapesText() {
        Event event = existingEvent(BigDecimal.ZERO, EventApprovalStatus.NOT_REQUIRED);
        event.setTitle("Talks, demos; more");
        event.setEndDate(event.getEventDate().plusSeconds(7200));

        String ics = eventService.generateIcs(event.getId());

        assertThat(ics).contains("SUMMARY:Talks\\, demos\\; more");
        assertThat(ics).contains("DTEND:" + java.time.format.DateTimeFormatter.ofPattern("yyyyMMdd'T'HHmmss'Z'")
                .withZone(java.time.ZoneOffset.UTC).format(event.getEndDate()));
    }

    @Test
    void generateQrCode_officersOnly() {
        Event event = existingEvent(BigDecimal.ZERO, EventApprovalStatus.NOT_REQUIRED);
        when(membershipRepository.findByUserIdAndClubId(president.getId(), club.getId())).thenReturn(Optional.empty());

        assertThatThrownBy(() -> eventService.generateQrCode(event.getId(), principal))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("officers");
    }

    @Test
    void generateQrCode_embedsFreshToken() {
        Event event = existingEvent(BigDecimal.ZERO, EventApprovalStatus.NOT_REQUIRED);
        asOfficer(MembershipPosition.VP);
        when(checkInTokenService.generate(event.getId())).thenReturn("tok123");

        byte[] png = eventService.generateQrCode(event.getId(), principal);

        assertThat(png).isNotEmpty();
        verify(checkInTokenService).generate(event.getId());
    }
}
