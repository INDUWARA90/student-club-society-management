package com.club.backend.integration;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.options;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Date;
import java.util.UUID;

import javax.crypto.SecretKey;

import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;

import com.club.backend.entity.Club;
import com.club.backend.entity.ClubStatus;
import com.club.backend.entity.Role;
import com.club.backend.entity.User;

import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;

/** Who may call what, exercised through the real filter chain, JWT parsing and @PreAuthorize rules. */
class SecurityIntegrationTest extends IntegrationTestBase {

    // ---------------------------------------------------------------- authentication

    @Test
    void protectedEndpointsRequireALogin() throws Exception {
        mvc.perform(get("/api/clubs")).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/auth/me")).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/notifications/me")).andExpect(status().isUnauthorized());
        mvc.perform(post("/api/events/" + UUID.randomUUID() + "/rsvp")).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/audit-logs")).andExpect(status().isUnauthorized());
    }

    @Test
    void publicEndpointsNeedNoLogin() throws Exception {
        mvc.perform(get("/api/health"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("UP"))
                .andExpect(jsonPath("$.database").value("UP"));
        mvc.perform(get("/api/certificates/verify/not-a-real-code"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.valid").value(false));
    }

    @Test
    void garbageAndForgedTokensAreRejected() throws Exception {
        User student = student("Stu");

        mvc.perform(get("/api/auth/me").header("Authorization", "Bearer not.a.jwt")).andExpect(status().isUnauthorized());

        SecretKey otherKey = Keys.hmacShaKeyFor("a-completely-different-secret-key-of-32-chars!".getBytes(StandardCharsets.UTF_8));
        String forged = Jwts.builder().subject(student.getEmail()).claim("userId", student.getId().toString())
                .claim("role", "SUPER_ADMIN").issuedAt(new Date()).expiration(new Date(System.currentTimeMillis() + 60_000))
                .signWith(otherKey).compact();
        mvc.perform(get("/api/audit-logs").header("Authorization", "Bearer " + forged)).andExpect(status().isUnauthorized());
    }

    @Test
    void aTokenNeverGrantsMoreThanTheStoredRole() throws Exception {
        // The role claim inside the token is not trusted: the user's real role in the database decides.
        User student = student("Stu");
        String claimsAdmin = jwtService.generateToken(student.getId(), student.getEmail(), "SUPER_ADMIN");

        mvc.perform(get("/api/audit-logs").header("Authorization", "Bearer " + claimsAdmin)).andExpect(status().isForbidden());
    }

    @Test
    void tokensIssuedBeforeAPasswordChangeAreRevoked() throws Exception {
        User student = student("Stu");
        String token = bearer(student);
        mvc.perform(get("/api/auth/me").header("Authorization", token)).andExpect(status().isOk());

        student.setPasswordChangedAt(Instant.now().plusSeconds(30));
        userRepository.save(student);

        mvc.perform(get("/api/auth/me").header("Authorization", token)).andExpect(status().isUnauthorized());
    }

    // ---------------------------------------------------------------- authorization

    @Test
    void studentsCannotReachStaffEndpoints() throws Exception {
        User student = student("Stu");
        Club club = approvedClub(student, "Chess");
        String token = bearer(student);

        mvc.perform(get("/api/audit-logs").header("Authorization", token)).andExpect(status().isForbidden())
                .andExpect(jsonPath("$.message").value("You do not have permission to perform this action"));
        mvc.perform(get("/api/clubs/pending").header("Authorization", token)).andExpect(status().isForbidden());
        mvc.perform(get("/api/clubs/all").header("Authorization", token)).andExpect(status().isForbidden());
        mvc.perform(get("/api/analytics/university").header("Authorization", token)).andExpect(status().isForbidden());
        mvc.perform(get("/api/events/pending").header("Authorization", token)).andExpect(status().isForbidden());
        mvc.perform(post("/api/events/" + UUID.randomUUID() + "/approve").header("Authorization", token)).andExpect(status().isForbidden());
        mvc.perform(post("/api/clubs/" + club.getId() + "/approve").header("Authorization", token)).andExpect(status().isForbidden());
        mvc.perform(post("/api/clubs/" + club.getId() + "/unarchive").header("Authorization", token)).andExpect(status().isForbidden());
        mvc.perform(post("/api/venues").header("Authorization", token).contentType(MediaType.APPLICATION_JSON)
                .content("{\"name\":\"Hall\"}")).andExpect(status().isForbidden());
    }

    @Test
    void superAdminSeesTheAdminEndpoints() throws Exception {
        User admin = user("Admin", Role.SUPER_ADMIN);
        String token = bearer(admin);

        mvc.perform(get("/api/audit-logs").header("Authorization", token)).andExpect(status().isOk());
        mvc.perform(get("/api/clubs/pending").header("Authorization", token)).andExpect(status().isOk());
        mvc.perform(get("/api/clubs/all").header("Authorization", token)).andExpect(status().isOk());
        mvc.perform(get("/api/analytics/university").header("Authorization", token)).andExpect(status().isOk());
        mvc.perform(post("/api/venues").header("Authorization", token).contentType(MediaType.APPLICATION_JSON)
                .content("{\"name\":\"Main Hall\",\"building\":\"A\",\"capacity\":100}")).andExpect(status().isOk());
        // ...but event approval belongs to the Faculty Advisor alone.
        mvc.perform(get("/api/events/pending").header("Authorization", token)).andExpect(status().isForbidden());
    }

    @Test
    void facultyAdvisorHasOversightButNotAdministration() throws Exception {
        User advisor = user("Advisor", Role.FACULTY_ADVISOR);
        String token = bearer(advisor);

        mvc.perform(get("/api/events/pending").header("Authorization", token)).andExpect(status().isOk());
        mvc.perform(get("/api/analytics/university").header("Authorization", token)).andExpect(status().isOk());
        mvc.perform(get("/api/clubs/all").header("Authorization", token)).andExpect(status().isOk());
        mvc.perform(get("/api/audit-logs").header("Authorization", token)).andExpect(status().isForbidden());
        mvc.perform(get("/api/clubs/pending").header("Authorization", token)).andExpect(status().isForbidden());
    }

    @Test
    void clubPowersDependOnTheClubNotJustTheLogin() throws Exception {
        User alice = student("Alice");
        User dave = student("Dave");
        Club techClub = approvedClub(alice, "Tech");
        Club artsClub = approvedClub(dave, "Arts");
        member(alice, techClub, com.club.backend.entity.MembershipPosition.PRESIDENT);
        member(dave, artsClub, com.club.backend.entity.MembershipPosition.PRESIDENT);
        var target = member(student("Carol"), techClub, com.club.backend.entity.MembershipPosition.MEMBER);

        // Dave presides over Arts, not Tech: he can't touch Tech's members, finances or events.
        mvc.perform(post("/api/memberships/" + target.getId() + "/approve").header("Authorization", bearer(dave)))
                .andExpect(status().isForbidden());
        mvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders
                .put("/api/memberships/" + target.getId() + "/position").header("Authorization", bearer(dave))
                .contentType(MediaType.APPLICATION_JSON).content("{\"position\":\"PRESIDENT\"}"))
                .andExpect(status().isForbidden());
        mvc.perform(get("/api/clubs/" + techClub.getId() + "/expenses/ledger").header("Authorization", bearer(dave)))
                .andExpect(status().isForbidden());
        mvc.perform(post("/api/clubs/" + techClub.getId() + "/events").header("Authorization", bearer(dave))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"title\":\"Hijack\",\"eventDate\":\"" + Instant.now().plusSeconds(86_400) + "\"}"))
                .andExpect(status().isForbidden());
        mvc.perform(get("/api/clubs/" + techClub.getId() + "/members/csv").header("Authorization", bearer(dave)))
                .andExpect(status().isForbidden());
    }

    // ---------------------------------------------------------------- CORS

    @Test
    void corsAllowsOnlyTheConfiguredFrontendOrigin() throws Exception {
        mvc.perform(options("/api/clubs").header("Origin", "http://localhost:5173")
                .header("Access-Control-Request-Method", "GET").header("Access-Control-Request-Headers", "authorization"))
                .andExpect(status().isOk())
                .andExpect(header().string("Access-Control-Allow-Origin", "http://localhost:5173"));

        mvc.perform(options("/api/clubs").header("Origin", "https://evil.example")
                .header("Access-Control-Request-Method", "GET"))
                .andExpect(status().isForbidden());
    }

    @Test
    void paginationHeaderIsExposedToBrowserScripts() throws Exception {
        User student = student("Stu");
        Club club = club(student, "Pending one", ClubStatus.PENDING);

        mvc.perform(get("/api/clubs?size=5").header("Authorization", bearer(student)).header("Origin", "http://localhost:5173"))
                .andExpect(status().isOk())
                .andExpect(header().string("Access-Control-Expose-Headers", org.hamcrest.Matchers.containsString("X-Total-Count")))
                .andExpect(header().string("X-Total-Count", "0"));
        org.junit.jupiter.api.Assertions.assertNotNull(club.getId());
    }
}
