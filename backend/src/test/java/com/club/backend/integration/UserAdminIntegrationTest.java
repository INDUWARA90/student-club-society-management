package com.club.backend.integration;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.Instant;
import java.time.temporal.ChronoUnit;

import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;

import com.club.backend.entity.AttendanceMethod;
import com.club.backend.entity.Club;
import com.club.backend.entity.Event;
import com.club.backend.entity.Role;
import com.club.backend.entity.User;
import com.club.backend.repository.AttendanceRepository;

/** Super Admin user management and the rules around deactivated accounts, through the real filter chain. */
class UserAdminIntegrationTest extends IntegrationTestBase {

    @org.springframework.beans.factory.annotation.Autowired
    private AttendanceRepository attendanceRepository;

    private static String json(String s) {
        return s;
    }

    @Test
    void onlyASuperAdminMayManageUsers() throws Exception {
        User student = student("Stu");
        User advisor = user("Adv", Role.FACULTY_ADVISOR);

        mvc.perform(get("/api/admin/users")).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/admin/users").header("Authorization", bearer(student))).andExpect(status().isForbidden());
        mvc.perform(get("/api/admin/users").header("Authorization", bearer(advisor))).andExpect(status().isForbidden());
        mvc.perform(post("/api/admin/users").header("Authorization", bearer(student))
                .contentType(MediaType.APPLICATION_JSON)
                .content(json("{\"name\":\"X\",\"email\":\"x@example.test\",\"password\":\"password123\"}")))
                .andExpect(status().isForbidden());
        mvc.perform(post("/api/admin/users/" + student.getId() + "/deactivate").header("Authorization", bearer(student)))
                .andExpect(status().isForbidden());
    }

    @Test
    void listSupportsSearchRoleFilterAndPaging() throws Exception {
        User admin = user("Root", Role.SUPER_ADMIN);
        student("Alice Wonder");
        student("Bob Builder");
        user("Carol Advisor", Role.FACULTY_ADVISOR);

        mvc.perform(get("/api/admin/users").header("Authorization", bearer(admin)))
                .andExpect(status().isOk())
                .andExpect(header().string("X-Total-Count", "4"))
                .andExpect(jsonPath("$.length()").value(4))
                .andExpect(jsonPath("$[0].profileImageB64").doesNotExist())
                .andExpect(jsonPath("$[0].passwordHash").doesNotExist());

        mvc.perform(get("/api/admin/users").param("q", "WONDER").header("Authorization", bearer(admin)))
                .andExpect(header().string("X-Total-Count", "1"))
                .andExpect(jsonPath("$[0].name").value("Alice Wonder"));

        mvc.perform(get("/api/admin/users").param("role", "FACULTY_ADVISOR").header("Authorization", bearer(admin)))
                .andExpect(header().string("X-Total-Count", "1"))
                .andExpect(jsonPath("$[0].role").value("FACULTY_ADVISOR"));

        mvc.perform(get("/api/admin/users").param("size", "3").param("page", "1").header("Authorization", bearer(admin)))
                .andExpect(header().string("X-Total-Count", "4"))
                .andExpect(jsonPath("$.length()").value(1));
    }

    @Test
    void createdUserCanSignInWithTheChosenRoleAndIsAudited() throws Exception {
        User admin = user("Root", Role.SUPER_ADMIN);

        mvc.perform(post("/api/admin/users").header("Authorization", bearer(admin)).contentType(MediaType.APPLICATION_JSON)
                .content(json("{\"name\":\"Dr Advisor\",\"email\":\"Dr.Advisor@Example.test\",\"password\":\"password123\",\"role\":\"FACULTY_ADVISOR\"}")))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.email").value("dr.advisor@example.test"))
                .andExpect(jsonPath("$.role").value("FACULTY_ADVISOR"))
                .andExpect(jsonPath("$.active").value(true))
                .andExpect(jsonPath("$.emailVerified").value(true));

        mvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
                .content(json("{\"email\":\"dr.advisor@example.test\",\"password\":\"password123\"}")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.user.role").value("FACULTY_ADVISOR"));

        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM audit_logs WHERE action = 'CREATE_USER'", Integer.class)).isEqualTo(1);

        mvc.perform(post("/api/admin/users").header("Authorization", bearer(admin)).contentType(MediaType.APPLICATION_JSON)
                .content(json("{\"name\":\"Dup\",\"email\":\"dr.advisor@example.test\",\"password\":\"password123\"}")))
                .andExpect(status().isConflict());
    }

    @Test
    void aRoleChangeTakesEffectOnTheNextRequestWithoutANewLogin() throws Exception {
        User admin = user("Root", Role.SUPER_ADMIN);
        User student = student("Stu");
        String studentToken = bearer(student);

        mvc.perform(get("/api/clubs/all").header("Authorization", studentToken)).andExpect(status().isForbidden());

        mvc.perform(put("/api/admin/users/" + student.getId()).header("Authorization", bearer(admin))
                .contentType(MediaType.APPLICATION_JSON).content(json("{\"role\":\"FACULTY_ADVISOR\"}")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.role").value("FACULTY_ADVISOR"));

        mvc.perform(get("/api/clubs/all").header("Authorization", studentToken)).andExpect(status().isOk());
    }

    @Test
    void deactivatedUserIsLockedOutImmediatelyAndCanBeRestored() throws Exception {
        User admin = user("Root", Role.SUPER_ADMIN);
        User student = student("Stu");
        String studentToken = bearer(student);

        mvc.perform(get("/api/auth/me").header("Authorization", studentToken)).andExpect(status().isOk());

        mvc.perform(post("/api/admin/users/" + student.getId() + "/deactivate").header("Authorization", bearer(admin)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.active").value(false));

        // the token they already hold stops working at once
        mvc.perform(get("/api/auth/me").header("Authorization", studentToken)).andExpect(status().isUnauthorized());
        // a correct password no longer signs them in; a wrong one is not told the account is deactivated
        mvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
                .content(json("{\"email\":\"" + student.getEmail() + "\",\"password\":\"password123\"}")))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.message").value(org.hamcrest.Matchers.containsString("deactivated")));
        mvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
                .content(json("{\"email\":\"" + student.getEmail() + "\",\"password\":\"wrong-password\"}")))
                .andExpect(status().isBadRequest());

        // their data is untouched
        assertThat(userRepository.findById(student.getId())).isPresent();

        mvc.perform(post("/api/admin/users/" + student.getId() + "/activate").header("Authorization", bearer(admin)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.active").value(true));
        mvc.perform(get("/api/auth/me").header("Authorization", studentToken)).andExpect(status().isOk());

        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM audit_logs WHERE action IN ('DEACTIVATE_USER','ACTIVATE_USER')",
                Integer.class)).isEqualTo(2);
    }

    @Test
    void adminCannotLockThemselvesOutOrRemoveTheLastSuperAdmin() throws Exception {
        User admin = user("Root", Role.SUPER_ADMIN);
        String token = bearer(admin);

        mvc.perform(post("/api/admin/users/" + admin.getId() + "/deactivate").header("Authorization", token))
                .andExpect(status().isBadRequest());
        mvc.perform(put("/api/admin/users/" + admin.getId()).header("Authorization", token)
                .contentType(MediaType.APPLICATION_JSON).content(json("{\"role\":\"STUDENT\"}")))
                .andExpect(status().isBadRequest());
        assertThat(userRepository.findById(admin.getId()).orElseThrow().getRole()).isEqualTo(Role.SUPER_ADMIN);

        // with a second Super Admin, one may demote the other; the demoted user loses admin access immediately
        User other = user("Second", Role.SUPER_ADMIN);
        String otherToken = bearer(other);
        mvc.perform(get("/api/admin/users").header("Authorization", otherToken)).andExpect(status().isOk());
        mvc.perform(put("/api/admin/users/" + other.getId()).header("Authorization", token)
                .contentType(MediaType.APPLICATION_JSON).content(json("{\"role\":\"STUDENT\"}")))
                .andExpect(status().isOk());
        mvc.perform(get("/api/admin/users").header("Authorization", otherToken)).andExpect(status().isForbidden());
    }

    @Test
    void myAttendanceListsOnlyTheCallersOwnCheckIns() throws Exception {
        User creator = student("Creator");
        Club club = approvedClub(creator, "Chess");
        Event first = event(club, "Opening Night", null);
        Event second = event(club, "Blitz Cup", null);
        first.setEventDate(Instant.now().minus(10, ChronoUnit.DAYS));
        eventRepository.save(first);
        User me = student("Me");
        User someoneElse = student("Other");
        checkIn(first, me);
        checkIn(second, me);
        checkIn(second, someoneElse);

        mvc.perform(get("/api/attendance/me").header("Authorization", bearer(me)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(2))
                .andExpect(jsonPath("$[0].eventTitle").value("Blitz Cup"))
                .andExpect(jsonPath("$[1].eventTitle").value("Opening Night"))
                .andExpect(jsonPath("$[0].clubName").value(club.getName()));

        mvc.perform(get("/api/attendance/me").header("Authorization", bearer(creator)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(0));
        mvc.perform(get("/api/attendance/me")).andExpect(status().isUnauthorized());
    }

    @Test
    void clubReportCsvIsDownloadableWithDetailSectionsAndAnUnknownClubIs404() throws Exception {
        User president = student("Pres");
        Club club = approvedClub(president, "Chess");
        member(president, club, com.club.backend.entity.MembershipPosition.PRESIDENT);
        event(club, "Blitz Cup", null);

        String csv = mvc.perform(get("/api/analytics/clubs/" + club.getId() + "/csv").header("Authorization", bearer(president)))
                .andExpect(status().isOk())
                .andExpect(header().string("Content-Disposition", org.hamcrest.Matchers.containsString("club-stats.csv")))
                .andReturn().getResponse().getContentAsString();
        assertThat(csv).contains("Metric,Value").contains("Club information").contains("Activities and participation")
                .contains("Blitz Cup").contains("Members").contains("Pres,PRESIDENT");

        byte[] pdf = mvc.perform(get("/api/analytics/clubs/" + club.getId() + "/pdf").header("Authorization", bearer(president)))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsByteArray();
        assertThat(new String(pdf, 0, 5, java.nio.charset.StandardCharsets.ISO_8859_1)).isEqualTo("%PDF-");

        mvc.perform(get("/api/analytics/clubs/" + java.util.UUID.randomUUID() + "/csv").header("Authorization", bearer(president)))
                .andExpect(status().isNotFound());
    }

    private void checkIn(Event event, User user) {
        attendanceRepository.save(com.club.backend.entity.Attendance.builder()
                .event(event).user(user).method(AttendanceMethod.MANUAL).build());
    }
}
