package com.club.backend.integration;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;

import com.club.backend.entity.Club;
import com.club.backend.entity.Role;
import com.club.backend.entity.User;

/** The production configuration: email verification required, and registration that reveals nothing about existing accounts. */
@SpringBootTest(properties = "app.require-email-verification=true")
class VerifiedRegistrationIntegrationTest extends IntegrationTestBase {

    private static final MediaType JSON = MediaType.APPLICATION_JSON;

    private String register(String email) throws Exception {
        return mvc.perform(post("/api/auth/register").contentType(JSON)
                .content("{\"name\":\"Someone\",\"email\":\"" + email + "\",\"password\":\"password123\"}"))
                .andExpect(status().isAccepted())
                .andExpect(jsonPath("$.accessToken").doesNotExist())
                .andExpect(jsonPath("$.message").value("Check your email to finish creating your account."))
                .andReturn().getResponse().getContentAsString();
    }

    @Test
    void registrationGivesTheSameAnswerWhetherOrNotTheAddressIsTaken() throws Exception {
        String fresh = register("it-fresh@example.test");
        long usersAfterFirst = userRepository.count();

        String again = register("it-fresh@example.test");      // now an existing account
        String differentCase = register("IT-Fresh@Example.Test");

        assertThat(again).isEqualTo(fresh);                    // indistinguishable responses
        assertThat(differentCase).isEqualTo(fresh);
        assertThat(userRepository.count()).isEqualTo(usersAfterFirst);   // no duplicate account was created
        assertThat(userRepository.findByEmail("it-fresh@example.test")).isPresent();
        assertThat(userRepository.findByEmail("it-fresh@example.test").orElseThrow().isEmailVerified()).isFalse();
    }

    @Test
    void invalidRegistrationStillGetsHelpfulErrors() throws Exception {
        mvc.perform(post("/api/auth/register").contentType(JSON)
                .content("{\"name\":\"\",\"email\":\"x@example.test\",\"password\":\"password123\"}")).andExpect(status().isBadRequest());
        mvc.perform(post("/api/auth/register").contentType(JSON)
                .content("{\"name\":\"A\",\"email\":\"not-an-email\",\"password\":\"password123\"}")).andExpect(status().isBadRequest());
        mvc.perform(post("/api/auth/register").contentType(JSON)
                .content("{\"name\":\"A\",\"email\":\"a@example.test\",\"password\":\"short\"}")).andExpect(status().isBadRequest());
    }

    @Test
    void anUnverifiedAccountCanBrowseButNotParticipate() throws Exception {
        User unverified = user("Unverified", Role.STUDENT);
        unverified.setEmailVerified(false);
        userRepository.save(unverified);
        User owner = student("Owner");
        Club club = approvedClub(owner, "Chess");
        var event = event(club, "Meetup", null);
        String token = bearer(unverified);

        mvc.perform(get("/api/clubs").header("Authorization", token)).andExpect(status().isOk());
        mvc.perform(post("/api/clubs/" + club.getId() + "/join").header("Authorization", token)).andExpect(status().isForbidden());
        mvc.perform(post("/api/events/" + event.getId() + "/rsvp").header("Authorization", token)).andExpect(status().isForbidden());
        mvc.perform(post("/api/clubs").header("Authorization", token).contentType(JSON)
                .content("{\"name\":\"My Club\",\"category\":\"Tech\"}")).andExpect(status().isForbidden());
        mvc.perform(post("/api/payments").header("Authorization", token).contentType(JSON)
                .content("{\"type\":\"EVENT\",\"referenceId\":\"" + event.getId() + "\"}")).andExpect(status().isForbidden());

        unverified.setEmailVerified(true);
        userRepository.save(unverified);
        mvc.perform(post("/api/clubs/" + club.getId() + "/join").header("Authorization", token)).andExpect(status().isOk());
    }
}
