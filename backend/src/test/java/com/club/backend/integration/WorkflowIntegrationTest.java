package com.club.backend.integration;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.Instant;
import java.time.temporal.ChronoUnit;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MvcResult;

import com.club.backend.entity.Club;
import com.club.backend.entity.ClubStatus;
import com.club.backend.entity.Event;
import com.club.backend.entity.MembershipPosition;
import com.club.backend.entity.Role;
import com.club.backend.entity.User;
import com.club.backend.service.CheckInTokenService;
import com.jayway.jsonpath.JsonPath;

/** Whole features driven through HTTP — controllers, security, services, transactions and the database together. */
class WorkflowIntegrationTest extends IntegrationTestBase {

    @Autowired
    private CheckInTokenService checkInTokenService;

    private static final MediaType JSON = MediaType.APPLICATION_JSON;

    private String read(MvcResult result, String path) throws Exception {
        Object value = JsonPath.read(result.getResponse().getContentAsString(), path);
        return String.valueOf(value);
    }

    private String inDays(int days) {
        return Instant.now().plus(days, ChronoUnit.DAYS).toString();
    }

    // ---------------------------------------------------------------- account and club lifecycle

    @Test
    void aNewStudentRegistersProposesAClubAndTheSuperAdminApprovesIt() throws Exception {
        User admin = user("Admin", Role.SUPER_ADMIN);

        MvcResult registered = mvc.perform(post("/api/auth/register").contentType(JSON)
                .content("{\"name\":\"New Student\",\"email\":\"it-newbie@example.test\",\"password\":\"password123\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.accessToken").isNotEmpty())
                .andExpect(jsonPath("$.user.role").value("STUDENT"))
                .andReturn();
        String token = "Bearer " + read(registered, "$.accessToken");

        // Registering the same address again in this (dev) mode is reported plainly.
        mvc.perform(post("/api/auth/register").contentType(JSON)
                .content("{\"name\":\"Again\",\"email\":\"it-newbie@example.test\",\"password\":\"password123\"}"))
                .andExpect(status().isConflict());

        MvcResult proposed = mvc.perform(post("/api/clubs").header("Authorization", token).contentType(JSON)
                .content("{\"name\":\"Robotics Society\",\"category\":\"Tech\",\"description\":\"We build robots\","
                        + "\"joinPolicy\":\"OPEN\",\"membershipFee\":0,\"certificateThreshold\":2}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("PENDING"))
                .andExpect(jsonPath("$.certificateThreshold").value(2))
                .andReturn();
        String clubId = read(proposed, "$.id");

        // Pending clubs are invisible to browsing; a duplicate name is refused.
        mvc.perform(get("/api/clubs").header("Authorization", token)).andExpect(jsonPath("$.length()").value(0));
        mvc.perform(post("/api/clubs").header("Authorization", token).contentType(JSON)
                .content("{\"name\":\"robotics society\",\"category\":\"Tech\"}")).andExpect(status().isConflict());

        mvc.perform(post("/api/clubs/" + clubId + "/approve").header("Authorization", bearer(admin)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.status").value("APPROVED"));
        mvc.perform(get("/api/clubs").header("Authorization", token)).andExpect(jsonPath("$.length()").value(1));
        // The creator is the President and got told.
        mvc.perform(get("/api/notifications/me").header("Authorization", token))
                .andExpect(jsonPath("$[0].message").value(org.hamcrest.Matchers.containsString("approved")));
    }

    // ---------------------------------------------------------------- money

    @Test
    void feeEventNeedsPaymentAndEveryRefundPathTakesTheIncomeBackOut() throws Exception {
        User president = student("President");
        User carol = student("Carol");
        User bob = student("Bob");
        Club club = approvedClub(president, "Chess");
        member(president, club, MembershipPosition.PRESIDENT);
        String presidentToken = bearer(president);

        MvcResult created = mvc.perform(post("/api/clubs/" + club.getId() + "/events").header("Authorization", presidentToken)
                .contentType(JSON).content("{\"title\":\"Gala\",\"eventDate\":\"" + inDays(5) + "\",\"fee\":100,\"budget\":500}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.budget").value(500)).andReturn();
        String eventId = read(created, "$.id");
        String pay = "{\"type\":\"EVENT\",\"referenceId\":\"" + eventId + "\",\"amount\":0.01}";

        // Pay first; the sent amount is ignored.
        mvc.perform(post("/api/events/" + eventId + "/rsvp").header("Authorization", bearer(carol))).andExpect(status().isBadRequest());
        mvc.perform(post("/api/payments").header("Authorization", bearer(carol)).contentType(JSON).content(pay))
                .andExpect(status().isOk()).andExpect(jsonPath("$.amount").value(100));
        mvc.perform(post("/api/payments").header("Authorization", bearer(carol)).contentType(JSON).content(pay))
                .andExpect(status().isConflict());
        mvc.perform(post("/api/events/" + eventId + "/rsvp").header("Authorization", bearer(carol)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.status").value("GOING"));
        mvc.perform(post("/api/payments").header("Authorization", bearer(bob)).contentType(JSON).content(pay)).andExpect(status().isOk());
        mvc.perform(post("/api/events/" + eventId + "/rsvp").header("Authorization", bearer(bob))).andExpect(status().isOk());

        mvc.perform(get("/api/clubs/" + club.getId() + "/expenses/ledger").header("Authorization", presidentToken))
                .andExpect(jsonPath("$.totalIncome").value(200))
                .andExpect(jsonPath("$.eventBudgets[0].income").value(200))
                .andExpect(jsonPath("$.eventBudgets[0].budget").value(500));

        // The fee can no longer change once people have signed up.
        mvc.perform(put("/api/events/" + eventId).header("Authorization", presidentToken).contentType(JSON)
                .content("{\"title\":\"Gala\",\"eventDate\":\"" + inDays(5) + "\",\"fee\":150}")).andExpect(status().isBadRequest());

        // Carol cancels: refunded. Then the club cancels the event: Bob is refunded too.
        mvc.perform(delete("/api/events/" + eventId + "/rsvp").header("Authorization", bearer(carol))).andExpect(status().isOk());
        mvc.perform(get("/api/clubs/" + club.getId() + "/expenses/ledger").header("Authorization", presidentToken))
                .andExpect(jsonPath("$.totalIncome").value(100));
        mvc.perform(post("/api/events/" + eventId + "/cancel").header("Authorization", presidentToken).contentType(JSON)
                .content("{\"reason\":\"Venue flooded\"}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.cancelled").value(true));
        mvc.perform(get("/api/clubs/" + club.getId() + "/expenses/ledger").header("Authorization", presidentToken))
                .andExpect(jsonPath("$.totalIncome").value(0));
        mvc.perform(get("/api/payments/me").header("Authorization", bearer(bob)))
                .andExpect(jsonPath("$[0].refundedAt").isNotEmpty());
        mvc.perform(post("/api/events/" + eventId + "/rsvp").header("Authorization", bearer(student("Late")))).andExpect(status().isBadRequest());
    }

    @Test
    void expensesLinkedToEventsAppearInThePerEventBudgetLines() throws Exception {
        User president = student("President");
        Club club = approvedClub(president, "Chess");
        member(president, club, MembershipPosition.PRESIDENT);
        String token = bearer(president);
        Event event = event(club, "Tournament", null);
        event.setBudget(new java.math.BigDecimal("400"));
        eventRepository.save(event);

        mvc.perform(post("/api/clubs/" + club.getId() + "/expenses").header("Authorization", token).contentType(JSON)
                .content("{\"description\":\"Trophies\",\"amount\":150,\"category\":\"Prizes\",\"eventId\":\"" + event.getId() + "\"}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.eventTitle").value("Tournament"));

        mvc.perform(get("/api/clubs/" + club.getId() + "/expenses/ledger").header("Authorization", token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.eventBudgets[0].title").value("Tournament"))
                .andExpect(jsonPath("$.eventBudgets[0].spent").value(150))
                .andExpect(jsonPath("$.eventBudgets[0].remaining").value(250))
                .andExpect(jsonPath("$.totalExpenses").value(150));
    }

    @Test
    void membershipFeeMustBePaidBeforeJoiningAndIsRefundedOnRejection() throws Exception {
        User president = student("President");
        User joiner = student("Joiner");
        Club club = approvedClub(president, "Chess");
        club.setMembershipFee(new java.math.BigDecimal("50"));
        club.setJoinPolicy(com.club.backend.entity.JoinPolicy.APPROVAL_REQUIRED);
        clubRepository.save(club);
        member(president, club, MembershipPosition.PRESIDENT);

        mvc.perform(post("/api/clubs/" + club.getId() + "/join").header("Authorization", bearer(joiner))).andExpect(status().isBadRequest());
        mvc.perform(post("/api/payments").header("Authorization", bearer(joiner)).contentType(JSON)
                .content("{\"type\":\"MEMBERSHIP\",\"referenceId\":\"" + club.getId() + "\"}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.amount").value(50));
        MvcResult joined = mvc.perform(post("/api/clubs/" + club.getId() + "/join").header("Authorization", bearer(joiner)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.status").value("PENDING")).andReturn();

        mvc.perform(post("/api/memberships/" + read(joined, "$.id") + "/reject").header("Authorization", bearer(president)))
                .andExpect(status().isOk());
        mvc.perform(get("/api/payments/me").header("Authorization", bearer(joiner)))
                .andExpect(jsonPath("$[0].refundedAt").isNotEmpty());
        // Re-applying costs a new payment.
        mvc.perform(post("/api/clubs/" + club.getId() + "/join").header("Authorization", bearer(joiner))).andExpect(status().isBadRequest());
    }

    // ---------------------------------------------------------------- attendance

    @Test
    void qrCheckInNeedsAFreshTokenAndAnOfficerShownCode() throws Exception {
        User president = student("President");
        User attendee = student("Attendee");
        Club club = approvedClub(president, "Chess");
        member(president, club, MembershipPosition.PRESIDENT);
        Event event = event(club, "Meetup", null);
        event.setEventDate(Instant.now().minus(10, ChronoUnit.MINUTES));   // already under way
        eventRepository.save(event);
        String url = "/api/events/" + event.getId() + "/attendance/qr-check-in";

        mvc.perform(get("/api/events/" + event.getId() + "/qr-code").header("Authorization", bearer(attendee))).andExpect(status().isForbidden());
        mvc.perform(get("/api/events/" + event.getId() + "/qr-code").header("Authorization", bearer(president)))
                .andExpect(status().isOk())
                .andExpect(header().string("Content-Type", "image/png"))
                .andExpect(header().string("Cache-Control", org.hamcrest.Matchers.containsString("no-store")));

        mvc.perform(post(url).header("Authorization", bearer(attendee))).andExpect(status().isForbidden());
        mvc.perform(post(url + "?token=" + event.getId()).header("Authorization", bearer(attendee))).andExpect(status().isForbidden());
        mvc.perform(post(url + "?token=" + checkInTokenService.generate(event.getId())).header("Authorization", bearer(attendee)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.method").value("QR"));
        mvc.perform(post(url + "?token=" + checkInTokenService.generate(event.getId())).header("Authorization", bearer(attendee)))
                .andExpect(status().isConflict());

        // An ordinary attendee only ever sees their own check-in; officers see everyone.
        mvc.perform(get("/api/events/" + event.getId() + "/attendance").header("Authorization", bearer(attendee)))
                .andExpect(jsonPath("$.length()").value(1));
        mvc.perform(get("/api/events/" + event.getId() + "/attendance").header("Authorization", bearer(student("Snoop"))))
                .andExpect(jsonPath("$.length()").value(0));
        mvc.perform(get("/api/events/" + event.getId() + "/attendance").header("Authorization", bearer(president)))
                .andExpect(jsonPath("$.length()").value(1));
    }

    // ---------------------------------------------------------------- moderation

    @Test
    void membersReportACommentAndThePresidentRemovesIt() throws Exception {
        User president = student("President");
        User author = student("Author");
        User reporter = student("Reporter");
        Club club = approvedClub(president, "Chess");
        member(president, club, MembershipPosition.PRESIDENT);
        member(author, club, MembershipPosition.MEMBER);
        member(reporter, club, MembershipPosition.MEMBER);
        Event event = event(club, "Meetup", null);

        MvcResult comment = mvc.perform(post("/api/events/" + event.getId() + "/comments").header("Authorization", bearer(author))
                .contentType(JSON).content("{\"content\":\"buy cheap watches!!!\"}")).andExpect(status().isOk()).andReturn();
        String commentId = read(comment, "$.id");
        String reportUrl = "/api/events/" + event.getId() + "/comments/" + commentId + "/report";

        mvc.perform(post(reportUrl).header("Authorization", bearer(author)).contentType(JSON).content("{\"reason\":\"x\"}"))
                .andExpect(status().isBadRequest());                                          // own comment
        mvc.perform(post(reportUrl).header("Authorization", bearer(student("Outsider"))).contentType(JSON).content("{\"reason\":\"spam\"}"))
                .andExpect(status().isForbidden());                                           // not a member
        MvcResult reported = mvc.perform(post(reportUrl).header("Authorization", bearer(reporter)).contentType(JSON)
                .content("{\"reason\":\"spam\"}")).andExpect(status().isOk()).andExpect(jsonPath("$.status").value("OPEN")).andReturn();
        mvc.perform(post(reportUrl).header("Authorization", bearer(reporter)).contentType(JSON).content("{\"reason\":\"spam\"}"))
                .andExpect(status().isConflict());

        String queue = "/api/clubs/" + club.getId() + "/comment-reports";
        mvc.perform(get(queue).header("Authorization", bearer(reporter))).andExpect(status().isForbidden());
        mvc.perform(get(queue).header("Authorization", bearer(president)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].commentContent").value("buy cheap watches!!!"))
                .andExpect(jsonPath("$[0].commentAuthorName").value("Author"));

        mvc.perform(post(queue + "/" + read(reported, "$.id") + "/resolve").header("Authorization", bearer(president))
                .contentType(JSON).content("{\"action\":\"DELETE_COMMENT\"}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.status").value("ACTION_TAKEN"));

        mvc.perform(get("/api/events/" + event.getId() + "/comments").header("Authorization", bearer(reporter)))
                .andExpect(jsonPath("$.length()").value(0));
        mvc.perform(get(queue).header("Authorization", bearer(president))).andExpect(jsonPath("$.length()").value(0));
    }

    // ---------------------------------------------------------------- succession and moderation of members

    @Test
    void theVicePresidentTakesOverOnceThePresidentIsMarkedGraduated() throws Exception {
        User oldPresident = student("Old President");
        User vp = student("Vee");
        Club club = approvedClub(oldPresident, "Chess");
        member(oldPresident, club, MembershipPosition.PRESIDENT);
        member(vp, club, MembershipPosition.VP);
        String claim = "/api/clubs/" + club.getId() + "/claim-presidency";

        mvc.perform(post(claim).header("Authorization", bearer(vp))).andExpect(status().isBadRequest());   // still a student

        // The President marks themselves as graduated last year; the VP is told.
        mvc.perform(put("/api/auth/me/profile").header("Authorization", bearer(oldPresident)).contentType(JSON)
                .content("{\"name\":\"Old President\",\"email\":\"" + oldPresident.getEmail() + "\",\"graduationYear\":"
                        + (java.time.Year.now().getValue() - 1) + "}")).andExpect(status().isOk());
        mvc.perform(get("/api/notifications/me").header("Authorization", bearer(vp)))
                .andExpect(jsonPath("$[0].message").value(org.hamcrest.Matchers.containsString("Claim presidency")));

        mvc.perform(post(claim).header("Authorization", bearer(student("Nobody")))).andExpect(status().isForbidden());
        mvc.perform(post(claim).header("Authorization", bearer(vp)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.position").value("PRESIDENT"));
        mvc.perform(get("/api/clubs/" + club.getId() + "/members").header("Authorization", bearer(vp)))
                .andExpect(jsonPath("$[?(@.userName=='Old President')].position").value("MEMBER"));
    }

    @Test
    void theOnlyPresidentCannotBeDemotedOrRemoved() throws Exception {
        User president = student("President");
        Club club = approvedClub(president, "Chess");
        var presidency = member(president, club, MembershipPosition.PRESIDENT);
        String token = bearer(president);

        mvc.perform(put("/api/memberships/" + presidency.getId() + "/position").header("Authorization", token)
                .contentType(JSON).content("{\"position\":\"MEMBER\"}")).andExpect(status().isBadRequest());
        mvc.perform(delete("/api/memberships/" + presidency.getId()).header("Authorization", token)).andExpect(status().isBadRequest());
        mvc.perform(delete("/api/clubs/" + club.getId() + "/join").header("Authorization", token)).andExpect(status().isBadRequest());
        assertThat(membershipRepository.findByClubIdAndPosition(club.getId(), MembershipPosition.PRESIDENT)).isPresent();
    }

    // ---------------------------------------------------------------- oversized input, archive

    @Test
    void oversizedPayloadsAreRejectedNotStoredOrCrashing() throws Exception {
        User president = student("President");
        Club club = approvedClub(president, "Chess");
        member(president, club, MembershipPosition.PRESIDENT);
        String huge = "A".repeat(3_100_000);

        mvc.perform(put("/api/auth/me/profile-image").header("Authorization", bearer(president)).contentType(JSON)
                .content("{\"profileImageB64\":\"" + huge + "\"}")).andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value(org.hamcrest.Matchers.containsString("too large")));
        mvc.perform(post("/api/clubs/" + club.getId() + "/announcements").header("Authorization", bearer(president)).contentType(JSON)
                .content("{\"content\":\"" + "x".repeat(5_001) + "\"}")).andExpect(status().isBadRequest());
    }

    @Test
    void aRealisticImageAndALongAnnouncementSurviveTheRoundTrip() throws Exception {
        // Regression: Hibernate had created these columns as tinytext (255 bytes), so anything real failed to save.
        User president = student("President");
        Club club = approvedClub(president, "Chess");
        member(president, club, MembershipPosition.PRESIDENT);
        String image = "data:image/png;base64," + "iVBORw0KGgo".repeat(20_000);          // ~220 KB
        String longPost = "Announcement text. ".repeat(200);                                // ~3.8 KB

        mvc.perform(put("/api/auth/me/profile-image").header("Authorization", bearer(president)).contentType(JSON)
                .content("{\"profileImageB64\":\"" + image + "\"}")).andExpect(status().isOk());
        mvc.perform(post("/api/clubs/" + club.getId() + "/announcements").header("Authorization", bearer(president)).contentType(JSON)
                .content("{\"content\":\"" + longPost + "\"}")).andExpect(status().isOk());

        assertThat(userRepository.findById(president.getId()).orElseThrow().getProfileImageB64()).hasSize(image.length());
        mvc.perform(get("/api/clubs/" + club.getId() + "/announcements").header("Authorization", bearer(president)))
                .andExpect(content().string(org.hamcrest.Matchers.containsString("Announcement text.")));
    }

    @Test
    void archivingAClubCancelsItsUpcomingEventsAndHidesIt() throws Exception {
        User president = student("President");
        User attendee = student("Attendee");
        Club club = approvedClub(president, "Chess");
        member(president, club, MembershipPosition.PRESIDENT);
        Event event = event(club, "Meetup", null);
        mvc.perform(post("/api/events/" + event.getId() + "/rsvp").header("Authorization", bearer(attendee))).andExpect(status().isOk());

        mvc.perform(post("/api/clubs/" + club.getId() + "/archive").header("Authorization", bearer(attendee))).andExpect(status().isForbidden());
        mvc.perform(post("/api/clubs/" + club.getId() + "/archive").header("Authorization", bearer(president)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.archived").value(true));

        assertThat(eventRepository.findById(event.getId()).orElseThrow().isCancelled()).isTrue();
        mvc.perform(get("/api/clubs").header("Authorization", bearer(attendee))).andExpect(jsonPath("$.length()").value(0));
        mvc.perform(get("/api/events").header("Authorization", bearer(attendee))).andExpect(jsonPath("$.length()").value(0));
        mvc.perform(post("/api/clubs/" + club.getId() + "/join").header("Authorization", bearer(student("Late")))).andExpect(status().isBadRequest());
        assertThat(clubRepository.findById(club.getId()).orElseThrow().getStatus()).isEqualTo(ClubStatus.APPROVED);
    }
}
