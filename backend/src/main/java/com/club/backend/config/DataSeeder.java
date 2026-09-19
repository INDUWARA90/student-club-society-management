package com.club.backend.config;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.temporal.ChronoUnit;

import org.springframework.boot.CommandLineRunner;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.core.annotation.Order;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

import com.club.backend.entity.Attendance;
import com.club.backend.entity.AttendanceMethod;
import com.club.backend.entity.Club;
import com.club.backend.entity.ClubAnnouncement;
import com.club.backend.entity.ClubStatus;
import com.club.backend.entity.Event;
import com.club.backend.entity.EventApprovalStatus;
import com.club.backend.entity.JoinPolicy;
import com.club.backend.entity.Membership;
import com.club.backend.entity.MembershipPosition;
import com.club.backend.entity.MembershipStatus;
import com.club.backend.entity.Role;
import com.club.backend.entity.Rsvp;
import com.club.backend.entity.RsvpStatus;
import com.club.backend.entity.User;
import com.club.backend.repository.AttendanceRepository;
import com.club.backend.repository.ClubAnnouncementRepository;
import com.club.backend.repository.ClubRepository;
import com.club.backend.repository.EventRepository;
import com.club.backend.repository.MembershipRepository;
import com.club.backend.repository.RsvpRepository;
import com.club.backend.repository.UserRepository;

import lombok.RequiredArgsConstructor;

/** Loads demo/seed data for a viva presentation — only runs against an empty database. */
@Component
@Order(1)
@ConditionalOnProperty(name = "app.seed-demo-data", havingValue = "true")
@RequiredArgsConstructor
public class DataSeeder implements CommandLineRunner {

    private static final String DEMO_PASSWORD = "password123";

    private final UserRepository userRepository;
    private final ClubRepository clubRepository;
    private final MembershipRepository membershipRepository;
    private final EventRepository eventRepository;
    private final RsvpRepository rsvpRepository;
    private final AttendanceRepository attendanceRepository;
    private final ClubAnnouncementRepository announcementRepository;
    private final PasswordEncoder passwordEncoder;

    @Override
    public void run(String... args) {
        if (userRepository.count() > 0) {
            return;
        }

        User superAdmin = createUser("Super Admin", "superadmin@example.com", Role.SUPER_ADMIN);
        User advisor = createUser("Faculty Advisor", "advisor@example.com", Role.FACULTY_ADVISOR);
        User alice = createUser("Alice Johnson", "alice@example.com", Role.STUDENT);
        User bob = createUser("Bob Smith", "bob@example.com", Role.STUDENT);
        User carol = createUser("Carol Lee", "carol@example.com", Role.STUDENT);
        User dave = createUser("Dave Kim", "dave@example.com", Role.STUDENT);

        Club techClub = createClub("Tech Innovators", "Tech", "Building cool things with code.", superAdmin);
        Club artClub = createClub("Creative Arts Society", "Cultural", "Painting, sculpture, and more.", superAdmin);

        makeMember(alice, techClub, MembershipPosition.PRESIDENT);
        makeMember(bob, techClub, MembershipPosition.VP);
        makeMember(carol, techClub, MembershipPosition.MEMBER);
        makeMember(dave, artClub, MembershipPosition.PRESIDENT);
        makeMember(alice, artClub, MembershipPosition.MEMBER);

        announcementRepository.save(ClubAnnouncement.builder()
                .club(techClub)
                .author(alice)
                .content("Welcome to Tech Innovators! Our first meetup is next week.")
                .build());

        Event hackNight = createEvent(techClub, "Hack Night", "An evening of building side projects.",
                Instant.now().plus(7, ChronoUnit.DAYS), BigDecimal.ZERO, 20, false, EventApprovalStatus.NOT_REQUIRED);

        Event pastWorkshop = createEvent(techClub, "Intro to Git Workshop", "Beginner-friendly Git workshop.",
                Instant.now().minus(14, ChronoUnit.DAYS), BigDecimal.ZERO, null, false, EventApprovalStatus.NOT_REQUIRED);

        Event artShow = createEvent(artClub, "Annual Art Show", "Showcasing student artwork, ticketed entry.",
                Instant.now().plus(21, ChronoUnit.DAYS), new BigDecimal("7500"), 50, true, EventApprovalStatus.PENDING);

        rsvpRepository.save(Rsvp.builder().event(hackNight).user(bob).status(RsvpStatus.GOING).build());
        rsvpRepository.save(Rsvp.builder().event(hackNight).user(carol).status(RsvpStatus.GOING).build());

        attendanceRepository.save(Attendance.builder().event(pastWorkshop).user(bob).method(AttendanceMethod.MANUAL).build());
        attendanceRepository.save(Attendance.builder().event(pastWorkshop).user(carol).method(AttendanceMethod.QR).build());

        System.out.println("Seed data loaded. Demo accounts (password: " + DEMO_PASSWORD + "):");
        System.out.println("  Super Admin:      " + superAdmin.getEmail());
        System.out.println("  Faculty Advisor:  " + advisor.getEmail());
        System.out.println("  Student (Pres.):  " + alice.getEmail());
        System.out.println("  Student:          " + bob.getEmail());
    }

    private User createUser(String name, String email, Role role) {
        return userRepository.save(User.builder()
                .name(name)
                .email(email)
                .passwordHash(passwordEncoder.encode(DEMO_PASSWORD))
                .role(role)
                .emailVerified(true)
                .build());
    }

    private Club createClub(String name, String category, String description, User creator) {
        return clubRepository.save(Club.builder()
                .name(name)
                .category(category)
                .description(description)
                .status(ClubStatus.APPROVED)
                .joinPolicy(JoinPolicy.OPEN)
                .createdBy(creator)
                .build());
    }

    private void makeMember(User user, Club club, MembershipPosition position) {
        membershipRepository.save(Membership.builder()
                .user(user)
                .club(club)
                .position(position)
                .status(MembershipStatus.APPROVED)
                .build());
    }

    private Event createEvent(Club club, String title, String description, Instant eventDate, BigDecimal fee,
            Integer capacity, boolean requiresFaApproval, EventApprovalStatus approvalStatus) {
        return eventRepository.save(Event.builder()
                .club(club)
                .title(title)
                .description(description)
                .eventDate(eventDate)
                .fee(fee)
                .capacity(capacity)
                .requiresFaApproval(requiresFaApproval)
                .approvalStatus(approvalStatus)
                .build());
    }
}
