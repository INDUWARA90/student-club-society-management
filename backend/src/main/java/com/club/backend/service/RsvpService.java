package com.club.backend.service;

import java.util.List;
import java.util.UUID;

import org.springframework.stereotype.Service;

import com.club.backend.config.ApiException;
import com.club.backend.dto.RsvpResponse;
import com.club.backend.entity.Event;
import com.club.backend.entity.Rsvp;
import com.club.backend.entity.RsvpStatus;
import com.club.backend.entity.User;
import com.club.backend.repository.EventRepository;
import com.club.backend.repository.RsvpRepository;
import com.club.backend.repository.UserRepository;
import com.club.backend.security.UserPrincipal;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class RsvpService {

    private final RsvpRepository rsvpRepository;
    private final EventRepository eventRepository;
    private final UserRepository userRepository;
    private final NotificationService notificationService;

    public RsvpResponse rsvp(UUID eventId, UserPrincipal principal) {
        Event event = eventRepository.findById(eventId)
                .orElseThrow(() -> ApiException.notFound("Event not found"));

        User user = userRepository.findById(principal.getId())
                .orElseThrow(() -> ApiException.notFound("User not found"));

        if (rsvpRepository.findByEventIdAndUserId(eventId, user.getId()).isPresent()) {
            throw ApiException.conflict("You have already RSVP'd to this event");
        }

        boolean atCapacity = event.getCapacity() != null
                && rsvpRepository.countByEventIdAndStatus(eventId, RsvpStatus.GOING) >= event.getCapacity();

        Rsvp rsvp;
        if (atCapacity) {
            int nextOrder = rsvpRepository.findByEventIdAndStatus(eventId, RsvpStatus.WAITLISTED).size() + 1;
            rsvp = Rsvp.builder().event(event).user(user).status(RsvpStatus.WAITLISTED).waitlistOrder(nextOrder).build();
        } else {
            rsvp = Rsvp.builder().event(event).user(user).status(RsvpStatus.GOING).build();
        }
        rsvp = rsvpRepository.save(rsvp);

        notificationService.notify(user, atCapacity
                ? "You've been waitlisted for " + event.getTitle() + "."
                : "Your RSVP for " + event.getTitle() + " is confirmed.");

        return RsvpResponse.from(rsvp);
    }

    /** Cancelling a GOING rsvp promotes the next-lowest-order WAITLISTED rsvp to GOING. */
    public void cancelRsvp(UUID eventId, UserPrincipal principal) {
        Rsvp rsvp = rsvpRepository.findByEventIdAndUserId(eventId, principal.getId())
                .orElseThrow(() -> ApiException.notFound("You have not RSVP'd to this event"));

        if (rsvp.getStatus() == RsvpStatus.CANCELLED) {
            throw ApiException.badRequest("This RSVP is already cancelled");
        }

        boolean wasGoing = rsvp.getStatus() == RsvpStatus.GOING;
        rsvp.setStatus(RsvpStatus.CANCELLED);
        rsvpRepository.save(rsvp);

        if (wasGoing) {
            rsvpRepository.findByEventIdAndStatusOrderByWaitlistOrderAsc(eventId, RsvpStatus.WAITLISTED)
                    .stream().findFirst()
                    .ifPresent(next -> {
                        next.setStatus(RsvpStatus.GOING);
                        next.setWaitlistOrder(null);
                        rsvpRepository.save(next);
                        notificationService.notify(next.getUser(), "A spot opened up — you're now going to "
                                + next.getEvent().getTitle() + "!");
                    });
        }
    }

    public List<RsvpResponse> listRsvps(UUID eventId) {
        return rsvpRepository.findByEventIdAndStatus(eventId, RsvpStatus.GOING)
                .stream().map(RsvpResponse::from).toList();
    }

    public List<RsvpResponse> listWaitlist(UUID eventId) {
        return rsvpRepository.findByEventIdAndStatusOrderByWaitlistOrderAsc(eventId, RsvpStatus.WAITLISTED)
                .stream().map(RsvpResponse::from).toList();
    }

    public List<RsvpResponse> listMyRsvps(UserPrincipal principal) {
        return rsvpRepository.findByUserId(principal.getId()).stream().map(RsvpResponse::from).toList();
    }
}
