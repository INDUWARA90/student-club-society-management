package com.club.backend.config;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
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
import com.club.backend.entity.ClubExpense;
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
import com.club.backend.entity.Venue;
import com.club.backend.repository.AttendanceRepository;
import com.club.backend.repository.ClubAnnouncementRepository;
import com.club.backend.repository.ClubExpenseRepository;
import com.club.backend.repository.ClubRepository;
import com.club.backend.repository.EventRepository;
import com.club.backend.repository.MembershipRepository;
import com.club.backend.repository.RsvpRepository;
import com.club.backend.repository.UserRepository;
import com.club.backend.repository.AuditLogRepository;
import com.club.backend.service.AuditLogService;
import com.club.backend.repository.VenueRepository;

import lombok.RequiredArgsConstructor;

/** Loads demo/seed data for a viva presentation. */
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
    private final ClubExpenseRepository expenseRepository;
    private final VenueRepository venueRepository;
    private final AuditLogRepository auditLogRepository;
    private final AuditLogService auditLogService;
    private final PasswordEncoder passwordEncoder;

    @Override
    public void run(String... args) {
        seedVenuesIfMissing();

        if (userRepository.count() > 0) {
            seedExpensesIfMissing();
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

        // Make Bob a pending applicant in artClub
        membershipRepository.save(Membership.builder()
                .user(bob)
                .club(artClub)
                .position(MembershipPosition.MEMBER)
                .status(MembershipStatus.PENDING)
                .build());

        // Initial expenses
        expenseRepository.save(ClubExpense.builder()
                .club(artClub)
                .loggedBy(dave)
                .description("Studio Light Soft Boxes & Tripods")
                .amount(new BigDecimal("1040.00"))
                .category("Equipment & Gear")
                .expenseDate(LocalDate.now().minusDays(7))
                .build());

        expenseRepository.save(ClubExpense.builder()
                .club(artClub)
                .loggedBy(dave)
                .description("Canvas Rolls & Acrylic Paint Supplies")
                .amount(new BigDecimal("1450.00"))
                .category("Marketing")
                .expenseDate(LocalDate.now().minusDays(5))
                .build());

        expenseRepository.save(ClubExpense.builder()
                .club(artClub)
                .loggedBy(dave)
                .description("Exhibition Opening Night Refreshments")
                .amount(new BigDecimal("750.00"))
                .category("Food & Refreshments")
                .expenseDate(LocalDate.now().minusDays(3))
                .build());

        announcementRepository.save(ClubAnnouncement.builder()
                .club(techClub)
                .author(alice)
                .content("Welcome to Tech Innovators! Our first meetup is next week.")
                .build());

        Venue labVenue = venueRepository.findByNameIgnoreCase("Innovation & Robotics Lab").orElse(null);
        Venue auditoriumVenue = venueRepository.findByNameIgnoreCase("Grand Auditorium").orElse(null);

        Event hackNight = createEvent(techClub, "Hack Night", "An evening of building side projects.",
                Instant.now().plus(7, ChronoUnit.DAYS), BigDecimal.ZERO, 20, false, EventApprovalStatus.NOT_REQUIRED, labVenue);

        Event pastWorkshop = createEvent(techClub, "Intro to Git Workshop", "Beginner-friendly Git workshop.",
                Instant.now().minus(14, ChronoUnit.DAYS), BigDecimal.ZERO, null, false, EventApprovalStatus.NOT_REQUIRED, labVenue);

        Event artShow = createEvent(artClub, "Annual Art Show", "Showcasing student artwork, ticketed entry.",
                Instant.now().plus(21, ChronoUnit.DAYS), new BigDecimal("7500"), 50, true, EventApprovalStatus.PENDING, auditoriumVenue);

        rsvpRepository.save(Rsvp.builder().event(hackNight).user(bob).status(RsvpStatus.GOING).build());
        rsvpRepository.save(Rsvp.builder().event(hackNight).user(carol).status(RsvpStatus.GOING).build());

        attendanceRepository.save(Attendance.builder().event(pastWorkshop).user(bob).method(AttendanceMethod.MANUAL).build());
        attendanceRepository.save(Attendance.builder().event(pastWorkshop).user(carol).method(AttendanceMethod.QR).build());

        seedAuditLogsIfMissing(superAdmin, advisor, alice, techClub, artClub, pastWorkshop);

        System.out.println("Seed data loaded. Demo accounts (password: " + DEMO_PASSWORD + "):");
        System.out.println("  Super Admin:      " + superAdmin.getEmail());
        System.out.println("  Faculty Advisor:  " + advisor.getEmail());
        System.out.println("  Student (Pres.):  " + alice.getEmail());
        System.out.println("  Student:          " + bob.getEmail());
    }

    private void seedExpensesIfMissing() {
        if (expenseRepository.count() > 0) {
            return;
        }
        Club club = clubRepository.findAll().stream().findFirst().orElse(null);
        if (club == null) {
            return;
        }
        User president = membershipRepository.findByClubIdAndStatus(club.getId(), MembershipStatus.APPROVED).stream()
                .filter(m -> m.getPosition() == MembershipPosition.PRESIDENT)
                .map(Membership::getUser)
                .findFirst()
                .orElseGet(() -> userRepository.findAll().stream().findFirst().orElse(null));
        if (president == null) {
            return;
        }

        expenseRepository.save(ClubExpense.builder()
                .club(club)
                .loggedBy(president)
                .description("Studio Light Soft Boxes & Tripods")
                .amount(new BigDecimal("1040.00"))
                .category("Equipment & Gear")
                .expenseDate(LocalDate.now().minusDays(7))
                .build());

        expenseRepository.save(ClubExpense.builder()
                .club(club)
                .loggedBy(president)
                .description("Canvas Rolls & Acrylic Paint Supplies")
                .amount(new BigDecimal("1450.00"))
                .category("Marketing")
                .expenseDate(LocalDate.now().minusDays(5))
                .build());

        expenseRepository.save(ClubExpense.builder()
                .club(club)
                .loggedBy(president)
                .description("Exhibition Opening Night Refreshments")
                .amount(new BigDecimal("750.00"))
                .category("Food & Refreshments")
                .expenseDate(LocalDate.now().minusDays(3))
                .build());
    }


    private void seedAuditLogsIfMissing(User superAdmin, User advisor, User alice, Club techClub, Club artClub, Event pastWorkshop) {
        if (auditLogRepository.count() > 0) {
            return;
        }
        auditLogService.log(superAdmin, "CREATE_USER", "USER", advisor.getId(), advisor.getEmail() + " as FACULTY_ADVISOR");
        auditLogService.log(superAdmin, "CREATE_CLUB", "CLUB", techClub.getId(), techClub.getName());
        auditLogService.log(superAdmin, "APPROVE_CLUB", "CLUB", artClub.getId(), artClub.getName());
        auditLogService.log(advisor, "APPROVE_EVENT", "EVENT", pastWorkshop.getId(), pastWorkshop.getTitle());
        auditLogService.log(alice, "LOG_EXPENSE", "EXPENSE", techClub.getId(), "Hackathon Refreshments & Cloud Server credits");
        auditLogService.log(superAdmin, "ACTIVATE_USER", "USER", alice.getId(), alice.getEmail());
    }

    private void seedAuditLogsIfEmpty() {
        if (auditLogRepository.count() > 0) {
            return;
        }
        User superAdmin = userRepository.findByRole(Role.SUPER_ADMIN).stream().findFirst().orElse(null);
        User advisor = userRepository.findByRole(Role.FACULTY_ADVISOR).stream().findFirst().orElse(null);
        User student = userRepository.findByRole(Role.STUDENT).stream().findFirst().orElse(null);
        Club club = clubRepository.findAll().stream().findFirst().orElse(null);
        Event event = eventRepository.findAll().stream().findFirst().orElse(null);

        if (superAdmin != null && club != null) {
            auditLogService.log(superAdmin, "CREATE_CLUB", "CLUB", club.getId(), club.getName());
            auditLogService.log(superAdmin, "APPROVE_CLUB", "CLUB", club.getId(), club.getName());
        }
        if (advisor != null && event != null) {
            auditLogService.log(advisor, "APPROVE_EVENT", "EVENT", event.getId(), event.getTitle());
        }
        if (student != null && club != null) {
            auditLogService.log(student, "LOG_EXPENSE", "EXPENSE", club.getId(), "Event materials and venue supplies");
        }
        if (superAdmin != null && student != null) {
            auditLogService.log(superAdmin, "ACTIVATE_USER", "USER", student.getId(), student.getEmail());
        }
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

    private void seedVenuesIfMissing() {
        createVenueIfMissing("Grand Auditorium", "Main Academic Complex", 500);
        createVenueIfMissing("Innovation & Robotics Lab", "Engineering Block B", 80);
        createVenueIfMissing("Conference Hall A", "Student Center Level 2", 150);
        createVenueIfMissing("Conference Hall B", "Student Center Level 2", 100);
        createVenueIfMissing("Multimedia & Podcast Studio", "Creative Arts Pavilion", 35);
        createVenueIfMissing("University Sports Arena", "Athletics Complex", 1200);
        createVenueIfMissing("STEM Seminar Room 101", "Science & Research Tower", 60);
        createVenueIfMissing("Outdoor Amphitheater", "Campus Central Plaza", 300);
    }

    private Venue createVenueIfMissing(String name, String building, Integer capacity) {
        return venueRepository.findByNameIgnoreCase(name)
                .orElseGet(() -> venueRepository.save(Venue.builder()
                        .name(name)
                        .building(building)
                        .capacity(capacity)
                        .active(true)
                        .build()));
    }

    private Event createEvent(Club club, String title, String description, Instant eventDate, BigDecimal fee,
            Integer capacity, boolean requiresFaApproval, EventApprovalStatus approvalStatus, Venue venue) {
        Instant endDate = eventDate != null ? eventDate.plus(2, ChronoUnit.HOURS) : null;
        return eventRepository.save(Event.builder()
                .club(club)
                .title(title)
                .description(description)
                .eventDate(eventDate)
                .endDate(endDate)
                .location(venue != null ? venue.getName() : null)
                .venue(venue)
                .fee(fee)
                .capacity(capacity)
                .requiresFaApproval(requiresFaApproval)
                .approvalStatus(approvalStatus)
                .build());
    }
}
