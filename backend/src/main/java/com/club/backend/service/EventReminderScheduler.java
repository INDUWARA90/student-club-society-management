package com.club.backend.service;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;

import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import com.club.backend.entity.Event;
import com.club.backend.entity.Rsvp;
import com.club.backend.entity.RsvpStatus;
import com.club.backend.repository.EventRepository;
import com.club.backend.repository.RsvpRepository;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

/** Emails students a reminder for events starting in the next 24-48 hours, once a day. */
@Service
@RequiredArgsConstructor
@Slf4j
public class EventReminderScheduler {

    private final EventRepository eventRepository;
    private final RsvpRepository rsvpRepository;
    private final NotificationService notificationService;

    @Scheduled(cron = "0 0 8 * * *")
    public void sendUpcomingEventReminders() {
        Instant windowStart = Instant.now().plus(24, ChronoUnit.HOURS);
        Instant windowEnd = Instant.now().plus(48, ChronoUnit.HOURS);

        List<Event> upcomingEvents = eventRepository.findByEventDateBetween(windowStart, windowEnd);
        for (Event event : upcomingEvents) {
            List<Rsvp> going = rsvpRepository.findByEventIdAndStatus(event.getId(), RsvpStatus.GOING);
            for (Rsvp rsvp : going) {
                notificationService.notify(rsvp.getUser(),
                        "Reminder: " + event.getTitle() + " is coming up soon at " + event.getClub().getName() + ".");
            }
        }
        log.info("Sent event reminders for {} upcoming event(s)", upcomingEvents.size());
    }
}
