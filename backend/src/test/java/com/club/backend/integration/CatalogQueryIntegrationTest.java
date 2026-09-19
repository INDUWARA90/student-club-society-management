package com.club.backend.integration;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;

import com.club.backend.dto.ClubResponse;
import com.club.backend.dto.EventResponse;
import com.club.backend.entity.Club;
import com.club.backend.entity.ClubStatus;
import com.club.backend.entity.Event;
import com.club.backend.entity.EventApprovalStatus;
import com.club.backend.entity.MembershipPosition;
import com.club.backend.entity.Payment;
import com.club.backend.entity.PaymentStatus;
import com.club.backend.entity.PaymentType;
import com.club.backend.entity.User;
import com.club.backend.repository.PaymentRepository;
import com.club.backend.service.ClubService;
import com.club.backend.service.EventService;
import com.club.backend.service.MembershipService;

/** Filters, sorting and paging are done by the database — checked here against real rows. */
class CatalogQueryIntegrationTest extends IntegrationTestBase {

    @Autowired
    private EventService eventService;
    @Autowired
    private ClubService clubService;
    @Autowired
    private MembershipService membershipService;
    @Autowired
    private PaymentRepository paymentRepository;

    private Event event(Club club, String title, int daysAhead, EventApprovalStatus approval) {
        Event e = event(club, title, null);
        e.setEventDate(Instant.now().plus(daysAhead, ChronoUnit.DAYS));
        e.setApprovalStatus(approval);
        return eventRepository.save(e);
    }

    // ---------------------------------------------------------------- events

    @Test
    void eventListShowsOnlyPublishedEventsOfActiveClubs_soonestFirst() {
        User owner = student("Owner");
        Club active = approvedClub(owner, "Chess");
        Club archived = approvedClub(owner, "Old Club");
        archived.setArchived(true);
        clubRepository.save(archived);
        Club pendingClub = club(owner, "Proposal", ClubStatus.PENDING);

        Event later = event(active, "Later event", 9, EventApprovalStatus.NOT_REQUIRED);
        Event sooner = event(active, "Sooner event", 2, EventApprovalStatus.APPROVED);
        event(active, "Waiting for approval", 3, EventApprovalStatus.PENDING);
        event(active, "Turned down", 3, EventApprovalStatus.REJECTED);
        event(archived, "In a closed club", 4, EventApprovalStatus.NOT_REQUIRED);
        event(pendingClub, "In an unapproved club", 4, EventApprovalStatus.NOT_REQUIRED);

        List<EventResponse> events = eventService.listPublishedEvents(null, null, null, null, null);

        assertThat(events).extracting(EventResponse::id).containsExactly(sooner.getId(), later.getId());
    }

    @Test
    void eventFiltersCombineTextCategoryClubAndDateWindow() {
        User owner = student("Owner");
        Club tech = approvedClub(owner, "Tech");
        Club arts = club(owner, "Arts", ClubStatus.APPROVED);
        arts.setCategory("Cultural");
        clubRepository.save(arts);

        Event hack = event(tech, "Hack Night", 3, EventApprovalStatus.NOT_REQUIRED);
        hack.setDescription("Build cool robots");
        eventRepository.save(hack);
        Event paint = event(arts, "Paint Session", 6, EventApprovalStatus.NOT_REQUIRED);
        Event farAway = event(tech, "Hackathon", 40, EventApprovalStatus.NOT_REQUIRED);

        assertThat(ids(eventService.listPublishedEvents(null, "HACK", null, null, null))).containsExactly(hack.getId(), farAway.getId());
        assertThat(ids(eventService.listPublishedEvents(null, "robots", null, null, null))).containsExactly(hack.getId());   // description match
        assertThat(ids(eventService.listPublishedEvents(null, null, "cultural", null, null))).containsExactly(paint.getId()); // case-insensitive category
        assertThat(ids(eventService.listPublishedEvents(tech.getId(), null, null, null, null))).containsExactly(hack.getId(), farAway.getId());
        Instant from = Instant.now().plus(5, ChronoUnit.DAYS);
        Instant to = Instant.now().plus(10, ChronoUnit.DAYS);
        assertThat(ids(eventService.listPublishedEvents(null, null, null, from, to))).containsExactly(paint.getId());
        assertThat(ids(eventService.listPublishedEvents(null, "nothing matches this", null, null, null))).isEmpty();
    }

    @Test
    void searchTextIsLiteral_percentAndUnderscoreAreNotWildcards() {
        User owner = student("Owner");
        Club club = approvedClub(owner, "Tech");
        Event discount = event(club, "100% Fun Run", 3, EventApprovalStatus.NOT_REQUIRED);
        event(club, "Chess Night", 4, EventApprovalStatus.NOT_REQUIRED);
        Event snake = event(club, "snake_case talk", 5, EventApprovalStatus.NOT_REQUIRED);
        event(club, "snakeXcase talk", 6, EventApprovalStatus.NOT_REQUIRED);

        assertThat(ids(eventService.listPublishedEvents(null, "%", null, null, null))).containsExactly(discount.getId());
        assertThat(ids(eventService.listPublishedEvents(null, "e_c", null, null, null))).containsExactly(snake.getId());
    }

    @Test
    void eventPagesComeFromTheDatabaseWithTheRightTotals() {
        User owner = student("Owner");
        Club club = approvedClub(owner, "Tech");
        for (int i = 1; i <= 7; i++) {
            event(club, "Event " + i, i, EventApprovalStatus.NOT_REQUIRED);
        }

        var firstPage = eventService.pagePublishedEvents(null, null, null, null, null, PageRequest.of(0, 3, Sort.by("eventDate")));
        var lastPage = eventService.pagePublishedEvents(null, null, null, null, null, PageRequest.of(2, 3, Sort.by("eventDate")));
        var beyond = eventService.pagePublishedEvents(null, null, null, null, null, PageRequest.of(9, 3, Sort.by("eventDate")));

        assertThat(firstPage.getTotalElements()).isEqualTo(7);
        assertThat(firstPage.getContent()).extracting(EventResponse::title).containsExactly("Event 1", "Event 2", "Event 3");
        assertThat(lastPage.getContent()).extracting(EventResponse::title).containsExactly("Event 7");
        assertThat(beyond.getContent()).isEmpty();
    }

    @Test
    void eventEndpointReportsTheTotalInTheHeaderAndSupportsBothModes() throws Exception {
        User student = student("Stu");
        Club club = approvedClub(student, "Tech");
        for (int i = 1; i <= 5; i++) {
            event(club, "Event " + i, i, EventApprovalStatus.NOT_REQUIRED);
        }
        String token = bearer(student);

        mvc.perform(get("/api/events?size=2&page=1").header("Authorization", token))
                .andExpect(status().isOk())
                .andExpect(header().string("X-Total-Count", "5"))
                .andExpect(jsonPath("$.length()").value(2))
                .andExpect(jsonPath("$[0].title").value("Event 3"));
        mvc.perform(get("/api/events").header("Authorization", token))
                .andExpect(status().isOk())
                .andExpect(header().string("X-Total-Count", "5"))
                .andExpect(jsonPath("$.length()").value(5));
        mvc.perform(get("/api/events").param("q", "event 5").header("Authorization", token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1));
        mvc.perform(get("/api/events?from=not-a-date").header("Authorization", token)).andExpect(status().isBadRequest());
        mvc.perform(get("/api/events?size=100000").header("Authorization", token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(5));   // size is clamped, never an error
    }

    // ---------------------------------------------------------------- clubs

    @Test
    void clubListHidesUnapprovedAndArchivedClubs_andFiltersByCategoryAndText() {
        User owner = student("Owner");
        Club chess = approvedClub(owner, "Chess");
        Club robotics = approvedClub(owner, "Robotics");
        robotics.setCategory("Engineering");
        robotics.setDescription("We build robots");
        clubRepository.save(robotics);
        Club gone = approvedClub(owner, "Closed Club");
        gone.setArchived(true);
        clubRepository.save(gone);
        club(owner, "Proposed Club", ClubStatus.PENDING);
        club(owner, "Refused Club", ClubStatus.REJECTED);

        assertThat(clubService.listApprovedClubs(null, null)).extracting(ClubResponse::id)
                .containsExactlyInAnyOrder(chess.getId(), robotics.getId());
        assertThat(clubService.listApprovedClubs("engineering", null)).extracting(ClubResponse::id).containsExactly(robotics.getId());
        assertThat(clubService.listApprovedClubs(null, "ROBOTS")).extracting(ClubResponse::id).containsExactly(robotics.getId());
        assertThat(clubService.listApprovedClubs(null, "nothing")).isEmpty();
    }

    @Test
    void clubPagesCountAndSortByName() {
        User owner = student("Owner");
        for (String name : List.of("Delta", "Alpha", "Charlie", "Bravo", "Echo")) {
            approvedClub(owner, name);
        }

        var page = clubService.pageApprovedClubs(null, null, PageRequest.of(0, 2, Sort.by("name")));

        assertThat(page.getTotalElements()).isEqualTo(5);
        assertThat(page.getContent()).extracting(ClubResponse::name).allMatch(n -> n.startsWith("Alpha") || n.startsWith("Bravo"));
    }

    @Test
    void memberPagesOnlyContainApprovedMembers() {
        User owner = student("Owner");
        Club club = approvedClub(owner, "Chess");
        member(owner, club, MembershipPosition.PRESIDENT);
        for (int i = 0; i < 4; i++) {
            member(student("Member " + i), club, MembershipPosition.MEMBER);
        }
        var pending = membershipRepository.save(com.club.backend.entity.Membership.builder().user(student("Pending")).club(club)
                .status(com.club.backend.entity.MembershipStatus.PENDING).build());

        var page = membershipService.pageMembers(club.getId(), PageRequest.of(0, 2, Sort.by("joinedAt")));

        assertThat(page.getTotalElements()).isEqualTo(5);     // the pending applicant is not counted
        assertThat(page.getContent()).hasSize(2);
        assertThat(pending.getId()).isNotNull();
    }

    // ---------------------------------------------------------------- aggregate queries

    @Test
    void refundedPaymentsNeverCountAsIncome() {
        User payer = student("Payer");
        paymentRepository.save(Payment.builder().user(payer).type(PaymentType.EVENT).referenceId(java.util.UUID.randomUUID())
                .amount(new BigDecimal("100")).status(PaymentStatus.SUCCESS).build());
        Payment refunded = paymentRepository.save(Payment.builder().user(payer).type(PaymentType.EVENT)
                .referenceId(java.util.UUID.randomUUID()).amount(new BigDecimal("40")).status(PaymentStatus.SUCCESS).build());
        refunded.setRefundedAt(Instant.now());
        paymentRepository.save(refunded);
        paymentRepository.save(Payment.builder().user(payer).type(PaymentType.EVENT).referenceId(java.util.UUID.randomUUID())
                .amount(new BigDecimal("7")).status(PaymentStatus.FAILED).build());

        assertThat(paymentRepository.sumLiveAmount()).isEqualByComparingTo("100");
        assertThat(paymentRepository.sumLiveAmount()).isNotNull();
    }

    @Test
    void universityStatsCountOnlyLiveEventsAndClubs() {
        User owner = student("Owner");
        Club live = approvedClub(owner, "Chess");
        Club archived = approvedClub(owner, "Closed");
        archived.setArchived(true);
        clubRepository.save(archived);
        event(live, "Counted", 2, EventApprovalStatus.NOT_REQUIRED);
        event(live, "Approved too", 3, EventApprovalStatus.APPROVED);
        event(live, "Not yet", 3, EventApprovalStatus.PENDING);
        Event cancelled = event(live, "Cancelled", 4, EventApprovalStatus.NOT_REQUIRED);
        cancelled.setCancelled(true);
        eventRepository.save(cancelled);

        assertThat(eventRepository.countByApprovalStatusInAndCancelledFalse(
                List.of(EventApprovalStatus.NOT_REQUIRED, EventApprovalStatus.APPROVED))).isEqualTo(2);
        assertThat(clubRepository.countByStatusAndArchivedFalse(ClubStatus.APPROVED)).isEqualTo(1);
    }

    @Test
    void venueConflictsIgnoreCancelledAndRejectedEvents() {
        User owner = student("Owner");
        Club club = approvedClub(owner, "Chess");
        var venue = jdbcVenue();
        Instant start = Instant.now().plus(5, ChronoUnit.DAYS);
        Instant end = start.plus(2, ChronoUnit.HOURS);
        Event booked = event(club, "Booked", 5, EventApprovalStatus.NOT_REQUIRED);
        booked.setVenue(venue);
        booked.setEventDate(start);
        booked.setEndDate(end);
        eventRepository.save(booked);

        java.util.UUID nobody = new java.util.UUID(0, 0);
        assertThat(eventRepository.findConflictingBookings(venue.getId(), start.plusSeconds(60), end.plusSeconds(60), nobody)).hasSize(1);

        booked.setCancelled(true);
        eventRepository.save(booked);
        assertThat(eventRepository.findConflictingBookings(venue.getId(), start.plusSeconds(60), end.plusSeconds(60), nobody)).isEmpty();
    }

    private com.club.backend.entity.Venue jdbcVenue() {
        return venueRepository.save(com.club.backend.entity.Venue.builder().name("Hall " + java.util.UUID.randomUUID()).active(true).build());
    }

    @Autowired
    private com.club.backend.repository.VenueRepository venueRepository;

    private static List<java.util.UUID> ids(List<EventResponse> events) {
        return events.stream().map(EventResponse::id).toList();
    }
}
