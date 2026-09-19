package com.club.backend.service;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.UUID;

import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import com.club.backend.entity.ClubStatus;
import com.club.backend.entity.Event;
import com.club.backend.entity.EventApprovalStatus;
import com.club.backend.entity.Role;
import com.club.backend.entity.Rsvp;
import com.club.backend.entity.RsvpStatus;
import com.club.backend.entity.User;
import com.club.backend.repository.ClubRepository;
import com.club.backend.repository.EventRepository;
import com.club.backend.repository.RsvpRepository;
import com.club.backend.repository.UserRepository;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

/** Daily jobs: event reminders for attendees, and nudges for approvers with items waiting. */
@Service
@RequiredArgsConstructor
@Slf4j
public class EventReminderScheduler {

    private final EventRepository eventRepository;
    private final RsvpRepository rsvpRepository;
    private final ClubRepository clubRepository;
    private final UserRepository userRepository;
    private final NotificationService notificationService;

    /** Reminds confirmed attendees of live events starting in the next 24-48 hours. */
    @Scheduled(cron = "0 0 8 * * *")
    public void sendUpcomingEventReminders() {
        Instant windowStart = Instant.now().plus(24, ChronoUnit.HOURS);
        Instant windowEnd = Instant.now().plus(48, ChronoUnit.HOURS);

        List<Event> upcomingEvents = eventRepository.findByEventDateBetween(windowStart, windowEnd).stream()
                .filter(EventRules::isPublished)
                .filter(e -> !e.isCancelled())
                .filter(e -> EventRules.isClubActive(e.getClub()))
                .toList();
        for (Event event : upcomingEvents) {
            List<Rsvp> going = rsvpRepository.findByEventIdAndStatus(event.getId(), RsvpStatus.GOING);
            for (Rsvp rsvp : going) {
                notificationService.notify(rsvp.getUser(),
                        "Reminder: " + event.getTitle() + " is coming up soon at " + event.getClub().getName() + ".");
            }
        }
        log.info("Sent event reminders for {} upcoming event(s)", upcomingEvents.size());
    }

    /** Tells Faculty Advisors and Super Admins each morning if approvals are waiting on them. */
    @Scheduled(cron = "0 0 9 * * *")
    public void sendPendingApprovalReminders() {
        long pendingEvents = eventRepository.findByApprovalStatus(EventApprovalStatus.PENDING).stream()
                .filter(e -> !e.isCancelled())
                .count();
        if (pendingEvents > 0) {
            notifyAll(Role.FACULTY_ADVISOR, pendingEvents + " event(s) are waiting for your approval.");
        }

        long pendingClubs = clubRepository.findByStatus(ClubStatus.PENDING).size();
        if (pendingClubs > 0) {
            notifyAll(Role.SUPER_ADMIN, pendingClubs + " club proposal(s) are waiting for your review.");
        }
        log.info("Approval reminders: {} pending event(s), {} pending club(s)", pendingEvents, pendingClubs);
    }

    /** Sends each digest subscriber their last 24 hours of notifications in one email. */
    @Scheduled(cron = "0 0 18 * * *")
    public void sendDailyDigests() {
        int sent = notificationService.sendDailyDigests();
        log.info("Sent {} notification digest email(s)", sent);
    }

    private void notifyAll(Role role, String message) {
        List<UUID> ids = userRepository.findByRole(role).stream().map(User::getId).toList();
        if (!ids.isEmpty()) {
            notificationService.notifyUsers(ids, message);
        }
    }
}
