package com.club.backend.integration;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.UUID;

import org.junit.jupiter.api.BeforeEach;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.jdbc.core.ConnectionCallback;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import com.club.backend.entity.Club;
import com.club.backend.entity.ClubStatus;
import com.club.backend.entity.Event;
import com.club.backend.entity.EventApprovalStatus;
import com.club.backend.entity.JoinPolicy;
import com.club.backend.entity.Membership;
import com.club.backend.entity.MembershipPosition;
import com.club.backend.entity.MembershipStatus;
import com.club.backend.entity.Role;
import com.club.backend.entity.User;
import com.club.backend.repository.ClubRepository;
import com.club.backend.repository.EventRepository;
import com.club.backend.repository.MembershipRepository;
import com.club.backend.repository.UserRepository;
import com.club.backend.security.JwtService;
import com.club.backend.security.UserPrincipal;

/**
 * Base for tests that run the whole application against a real MySQL database (the "test" profile: the same Flyway
 * migrations as production, in a dedicated database). Every test starts from an empty schema; the wipe refuses to run
 * against any database that isn't clearly a test database, so it can never touch development data.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
abstract class IntegrationTestBase {

    @Autowired
    protected MockMvc mvc;
    @Autowired
    protected JdbcTemplate jdbc;
    @Autowired
    protected UserRepository userRepository;
    @Autowired
    protected ClubRepository clubRepository;
    @Autowired
    protected MembershipRepository membershipRepository;
    @Autowired
    protected EventRepository eventRepository;
    @Autowired
    protected JwtService jwtService;
    @Autowired
    protected PasswordEncoder passwordEncoder;

    @BeforeEach
    void wipeTestDatabase() {
        jdbc.execute((ConnectionCallback<Void>) connection -> {
            String database = null;
            try (var st = connection.createStatement(); var rs = st.executeQuery("SELECT DATABASE()")) {
                if (rs.next()) {
                    database = rs.getString(1);
                }
            }
            if (database == null || !database.toLowerCase().contains("test")) {
                throw new IllegalStateException("Refusing to wipe database '" + database
                        + "': integration tests only run against a database whose name contains 'test'");
            }
            List<String> tables = new java.util.ArrayList<>();
            try (var st = connection.createStatement();
                    var rs = st.executeQuery("SELECT table_name FROM information_schema.tables WHERE table_schema = DATABASE() "
                            + "AND table_type = 'BASE TABLE' AND table_name <> 'flyway_schema_history'")) {
                while (rs.next()) {
                    tables.add(rs.getString(1));
                }
            }
            try (var st = connection.createStatement()) {
                st.execute("SET FOREIGN_KEY_CHECKS = 0");
                for (String table : tables) {
                    st.execute("TRUNCATE TABLE `" + table + "`");
                }
                st.execute("SET FOREIGN_KEY_CHECKS = 1");
            }
            return null;
        });
    }

    // ------------------------------------------------------------------ data helpers

    protected User user(String label, Role role) {
        return userRepository.save(User.builder()
                .name(label)
                .email("it-" + label.toLowerCase().replace(' ', '-') + "-" + UUID.randomUUID().toString().substring(0, 8) + "@example.test")
                .passwordHash(passwordEncoder.encode("password123"))
                .role(role)
                .emailVerified(true)
                .build());
    }

    protected User student(String label) {
        return user(label, Role.STUDENT);
    }

    protected Club club(User creator, String name, ClubStatus status) {
        return clubRepository.save(Club.builder()
                .name(name + " " + UUID.randomUUID().toString().substring(0, 6))
                .description("A club about " + name)
                .category("Tech")
                .status(status)
                .joinPolicy(JoinPolicy.OPEN)
                .createdBy(creator)
                .build());
    }

    protected Club approvedClub(User creator, String name) {
        return club(creator, name, ClubStatus.APPROVED);
    }

    protected Membership member(User user, Club club, MembershipPosition position) {
        return membershipRepository.save(Membership.builder()
                .user(user).club(club).position(position).status(MembershipStatus.APPROVED).build());
    }

    protected Event event(Club club, String title, Integer capacity) {
        return eventRepository.save(Event.builder()
                .club(club)
                .title(title)
                .description("About " + title)
                .eventDate(Instant.now().plus(3, ChronoUnit.DAYS))
                .capacity(capacity)
                .approvalStatus(EventApprovalStatus.NOT_REQUIRED)
                .build());
    }

    protected String bearer(User user) {
        return "Bearer " + jwtService.generateToken(user.getId(), user.getEmail(), user.getRole().name());
    }

    protected UserPrincipal principal(User user) {
        return new UserPrincipal(user);
    }
}
