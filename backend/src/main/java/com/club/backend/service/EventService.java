package com.club.backend.service;

import java.math.BigDecimal;
import java.util.List;
import java.util.Set;
import java.util.UUID;

import org.springframework.stereotype.Service;

import com.club.backend.config.ApiException;
import com.club.backend.dto.CreateEventRequest;
import com.club.backend.dto.EventResponse;
import com.club.backend.entity.Club;
import com.club.backend.entity.Event;
import com.club.backend.entity.EventApprovalStatus;
import com.club.backend.entity.Membership;
import com.club.backend.entity.MembershipPosition;
import com.club.backend.entity.MembershipStatus;
import com.club.backend.repository.ClubRepository;
import com.club.backend.repository.EventRepository;
import com.club.backend.repository.MembershipRepository;
import com.club.backend.security.UserPrincipal;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class EventService {

    /** Events with a fee above this amount require Faculty Advisor sign-off before publishing. */
    private static final BigDecimal FA_APPROVAL_FEE_THRESHOLD = new BigDecimal("5000");

    private static final Set<MembershipPosition> EVENT_CREATOR_POSITIONS = Set.of(
            MembershipPosition.PRESIDENT, MembershipPosition.VP,
            MembershipPosition.SECRETARY, MembershipPosition.TREASURER);

    private final EventRepository eventRepository;
    private final ClubRepository clubRepository;
    private final MembershipRepository membershipRepository;

    public EventResponse createEvent(UUID clubId, CreateEventRequest request, UserPrincipal principal) {
        if (request.title() == null || request.title().trim().isEmpty()) {
            throw ApiException.badRequest("Event title is required");
        }
        if (request.eventDate() == null) {
            throw ApiException.badRequest("Event date is required");
        }

        Club club = clubRepository.findById(clubId)
                .orElseThrow(() -> ApiException.notFound("Club not found"));

        Membership membership = membershipRepository.findByUserIdAndClubId(principal.getId(), clubId)
                .orElseThrow(() -> ApiException.forbidden("Only club officers can create events"));

        if (membership.getStatus() != MembershipStatus.APPROVED
                || !EVENT_CREATOR_POSITIONS.contains(membership.getPosition())) {
            throw ApiException.forbidden("Only club officers can create events");
        }

        BigDecimal fee = request.fee() != null ? request.fee() : BigDecimal.ZERO;
        boolean requiresFaApproval = fee.compareTo(FA_APPROVAL_FEE_THRESHOLD) > 0;

        Event event = Event.builder()
                .club(club)
                .title(request.title().trim())
                .description(request.description())
                .bannerB64(request.bannerB64())
                .eventDate(request.eventDate())
                .fee(fee)
                .capacity(request.capacity())
                .requiresFaApproval(requiresFaApproval)
                .approvalStatus(requiresFaApproval ? EventApprovalStatus.PENDING : EventApprovalStatus.NOT_REQUIRED)
                .build();
        event = eventRepository.save(event);

        return EventResponse.from(event);
    }

    public List<EventResponse> listPublishedEvents(UUID clubId) {
        List<Event> events = clubId != null ? eventRepository.findByClubId(clubId) : eventRepository.findAll();
        return events.stream()
                .filter(e -> e.getApprovalStatus() == EventApprovalStatus.NOT_REQUIRED
                        || e.getApprovalStatus() == EventApprovalStatus.APPROVED)
                .map(EventResponse::from)
                .toList();
    }

    public List<EventResponse> listPendingApprovals() {
        return eventRepository.findByApprovalStatus(EventApprovalStatus.PENDING)
                .stream().map(EventResponse::from).toList();
    }

    public EventResponse getEvent(UUID eventId) {
        Event event = eventRepository.findById(eventId)
                .orElseThrow(() -> ApiException.notFound("Event not found"));
        return EventResponse.from(event);
    }

    public EventResponse reviewEvent(UUID eventId, boolean approve) {
        Event event = eventRepository.findById(eventId)
                .orElseThrow(() -> ApiException.notFound("Event not found"));

        if (event.getApprovalStatus() != EventApprovalStatus.PENDING) {
            throw ApiException.badRequest("Only pending events can be approved or rejected");
        }

        event.setApprovalStatus(approve ? EventApprovalStatus.APPROVED : EventApprovalStatus.REJECTED);
        event = eventRepository.save(event);
        return EventResponse.from(event);
    }
}
