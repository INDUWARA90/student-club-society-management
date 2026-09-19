package com.club.backend.service;

import java.time.Instant;
import java.util.Comparator;
import java.util.List;
import java.util.Objects;
import java.util.Optional;
import java.util.UUID;

import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.club.backend.config.ApiException;
import com.club.backend.dto.RsvpResponse;
import com.club.backend.entity.Event;
import com.club.backend.entity.PaymentType;
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
@Transactional
public class RsvpService {

    private final RsvpRepository rsvpRepository;
    private final EventRepository eventRepository;
    private final UserRepository userRepository;
    private final NotificationService notificationService;
    private final SimpMessagingTemplate messagingTemplate;
    private final PaymentService paymentService;
    private final EmailVerificationPolicy emailVerificationPolicy;

    public RsvpResponse rsvp(UUID eventId, UserPrincipal principal) {
        // Lock the event row so two simultaneous RSVPs can't both take the last seat.
        Event event = eventRepository.findByIdForUpdate(eventId)
                .orElseThrow(() -> ApiException.notFound("Event not found"));

        EventRules.requireOpenForSignup(event);

        User user = userRepository.findById(principal.getId())
                .orElseThrow(() -> ApiException.notFound("User not found"));
        emailVerificationPolicy.requireVerified(user);

        if (event.getFee() != null && event.getFee().signum() > 0
                && !paymentService.hasLivePayment(user.getId(), PaymentType.EVENT, eventId)) {
            throw ApiException.badRequest("Pay the event fee before RSVPing");
        }

        Optional<Rsvp> existing = rsvpRepository.findByEventIdAndUserId(eventId, user.getId());
        if (existing.isPresent() && existing.get().getStatus() != RsvpStatus.CANCELLED) {
            throw ApiException.conflict("You have already RSVP'd to this event");
        }

        boolean atCapacity = event.getCapacity() != null
                && rsvpRepository.countByEventIdAndStatus(eventId, RsvpStatus.GOING) >= event.getCapacity();

        // A previously cancelled RSVP is reused rather than rejected, so people can change their mind.
        Rsvp rsvp = existing.orElseGet(() -> Rsvp.builder().event(event).user(user).build());
        rsvp.setRsvpAt(Instant.now());
        if (atCapacity) {
            int nextOrder = rsvpRepository.findByEventIdAndStatus(eventId, RsvpStatus.WAITLISTED).stream()
                    .map(Rsvp::getWaitlistOrder)
                    .filter(Objects::nonNull)
                    .max(Comparator.naturalOrder())
                    .orElse(0) + 1;
            rsvp.setStatus(RsvpStatus.WAITLISTED);
            rsvp.setWaitlistOrder(nextOrder);
        } else {
            rsvp.setStatus(RsvpStatus.GOING);
            rsvp.setWaitlistOrder(null);
        }
        rsvp = rsvpRepository.save(rsvp);

        notificationService.notify(user, atCapacity
                ? "You've been waitlisted for " + event.getTitle() + "."
                : "Your RSVP for " + event.getTitle() + " is confirmed.");

        if (atCapacity) {
            broadcastWaitlist(eventId);
        }

        return RsvpResponse.from(rsvp);
    }

    /**
     * Cancelling frees a seat (promoting the next waitlisted person) or, for a waitlisted RSVP, closes the gap in
     * the queue. The fee is refunded if the event hasn't started yet.
     */
    public void cancelRsvp(UUID eventId, UserPrincipal principal) {
        Event event = eventRepository.findByIdForUpdate(eventId)
                .orElseThrow(() -> ApiException.notFound("Event not found"));

        Rsvp rsvp = rsvpRepository.findByEventIdAndUserId(eventId, principal.getId())
                .orElseThrow(() -> ApiException.notFound("You have not RSVP'd to this event"));

        if (rsvp.getStatus() == RsvpStatus.CANCELLED) {
            throw ApiException.badRequest("This RSVP is already cancelled");
        }

        rsvp.setStatus(RsvpStatus.CANCELLED);
        rsvp.setWaitlistOrder(null);
        rsvpRepository.save(rsvp);

        if (event.getEventDate() == null || event.getEventDate().isAfter(Instant.now())) {
            paymentService.refundEventPayment(principal.getId(), event, "RSVP cancelled");
        }

        promoteFromWaitlist(event);
    }

    /**
     * Fills any free seats from the waitlist in queue order and renumbers whoever is still waiting, so positions
     * always run 1..n. Called on cancellations and whenever an event's capacity is raised. The caller should
     * already hold the event row lock.
     */
    public void promoteFromWaitlist(Event event) {
        List<Rsvp> waitlist = rsvpRepository.findByEventIdAndStatusOrderByWaitlistOrderAsc(
                event.getId(), RsvpStatus.WAITLISTED);
        if (waitlist.isEmpty()) {
            return;
        }

        int free = waitlist.size();
        if (event.getCapacity() != null) {
            long going = rsvpRepository.countByEventIdAndStatus(event.getId(), RsvpStatus.GOING);
            free = (int) Math.max(0, event.getCapacity() - going);
        }

        int promoted = 0;
        for (Rsvp next : waitlist) {
            if (promoted >= free) {
                break;
            }
            next.setStatus(RsvpStatus.GOING);
            next.setWaitlistOrder(null);
            rsvpRepository.save(next);
            notificationService.notify(next.getUser(),
                    "A spot opened up — you're now going to " + event.getTitle() + "!");
            promoted++;
        }

        int order = 1;
        for (int i = promoted; i < waitlist.size(); i++) {
            Rsvp waiting = waitlist.get(i);
            waiting.setWaitlistOrder(order++);
            rsvpRepository.save(waiting);
        }

        broadcastWaitlist(event.getId());
    }

    /** Pushes the live waitlist (with updated positions) to anyone viewing the event page. */
    private void broadcastWaitlist(UUID eventId) {
        List<RsvpResponse> waitlist = listWaitlist(eventId);
        messagingTemplate.convertAndSend("/topic/events/" + eventId + "/waitlist", waitlist);
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
