package com.club.backend.service;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;

import javax.imageio.ImageIO;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.club.backend.config.ApiException;
import com.club.backend.dto.CreateEventRequest;
import com.club.backend.dto.EventResponse;
import com.club.backend.entity.Club;
import com.club.backend.entity.Event;
import com.club.backend.entity.EventApprovalStatus;
import com.club.backend.entity.Membership;
import com.club.backend.entity.MembershipPosition;
import com.club.backend.entity.MembershipStatus;
import com.club.backend.entity.PaymentStatus;
import com.club.backend.entity.PaymentType;
import com.club.backend.entity.Role;
import com.club.backend.entity.RsvpStatus;
import com.club.backend.entity.User;
import com.club.backend.entity.Venue;
import com.club.backend.repository.ClubRepository;
import com.club.backend.repository.EventRepository;
import com.club.backend.repository.MembershipRepository;
import com.club.backend.repository.PaymentRepository;
import com.club.backend.repository.RsvpRepository;
import com.club.backend.repository.UserRepository;
import com.club.backend.repository.VenueRepository;
import com.club.backend.security.UserPrincipal;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
@Transactional
public class EventService {

    /** Events with a fee above this amount require Faculty Advisor sign-off before publishing. */
    private static final BigDecimal FA_APPROVAL_FEE_THRESHOLD = new BigDecimal("5000");
    private static final BigDecimal MAX_FEE = new BigDecimal("1000000");

    private static final Set<MembershipPosition> EVENT_CREATOR_POSITIONS = Set.of(
            MembershipPosition.PRESIDENT, MembershipPosition.VP,
            MembershipPosition.SECRETARY, MembershipPosition.TREASURER);

    private static final DateTimeFormatter DISPLAY_DATE_FORMAT = DateTimeFormatter
            .ofPattern("d MMM yyyy, HH:mm 'UTC'", Locale.ENGLISH).withZone(ZoneOffset.UTC);

    private final EventRepository eventRepository;
    private final ClubRepository clubRepository;
    private final MembershipRepository membershipRepository;
    private final UserRepository userRepository;
    private final VenueRepository venueRepository;
    private final RsvpRepository rsvpRepository;
    private final PaymentRepository paymentRepository;
    private final PaymentService paymentService;
    private final RsvpService rsvpService;
    private final AuditLogService auditLogService;
    private final NotificationService notificationService;
    private final CheckInTokenService checkInTokenService;

    @Value("${app.frontend-url}")
    private String frontendUrl;

    public EventResponse createEvent(UUID clubId, CreateEventRequest request, UserPrincipal principal) {
        if (request.title() == null || request.title().trim().isEmpty()) {
            throw ApiException.badRequest("Event title is required");
        }
        if (request.eventDate() == null) {
            throw ApiException.badRequest("Event date is required");
        }

        Club club = clubRepository.findById(clubId)
                .orElseThrow(() -> ApiException.notFound("Club not found"));

        requireOfficer(clubId, principal, "Only club officers can create events");

        if (!EventRules.isClubActive(club)) {
            throw ApiException.badRequest("Events can only be created for an active, approved club");
        }
        if (!request.eventDate().isAfter(Instant.now())) {
            throw ApiException.badRequest("The event date must be in the future");
        }

        InputLimits.requireImageSize(request.bannerB64(), "event banner");
        BigDecimal fee = validatedFee(request.fee());
        boolean requiresFaApproval = fee.compareTo(FA_APPROVAL_FEE_THRESHOLD) > 0;
        Venue venue = resolveVenueBooking(request, new UUID(0, 0));
        Integer capacity = reconcileCapacity(venue, request.capacity());

        Event event = Event.builder()
                .club(club)
                .title(request.title().trim())
                .description(request.description())
                .location(request.location())
                .bannerB64(request.bannerB64())
                .eventDate(request.eventDate())
                .endDate(venue != null ? request.endDate() : null)
                .venue(venue)
                .fee(fee)
                .capacity(capacity)
                .budget(validatedBudget(request.budget()))
                .requiresFaApproval(requiresFaApproval)
                .approvalStatus(requiresFaApproval ? EventApprovalStatus.PENDING : EventApprovalStatus.NOT_REQUIRED)
                .build();
        event = eventRepository.save(event);

        if (requiresFaApproval) {
            notifyFacultyAdvisors(event);
        }

        return EventResponse.from(event);
    }

    /**
     * Validates and resolves the optional venue booking on a create/update request, throwing a 409 if it
     * overlaps an existing booking at the same venue. Returns null when no venue was requested.
     */
    private Venue resolveVenueBooking(CreateEventRequest request, UUID excludeEventId) {
        if (request.venueId() == null) {
            return null;
        }
        if (request.endDate() == null || !request.endDate().isAfter(request.eventDate())) {
            throw ApiException.badRequest("A venue booking needs an end time after the start time");
        }

        Venue venue = venueRepository.findById(request.venueId())
                .filter(Venue::isActive)
                .orElseThrow(() -> ApiException.notFound("Venue not found"));

        List<Event> conflicts = eventRepository.findConflictingBookings(
                venue.getId(), request.eventDate(), request.endDate(), excludeEventId);
        if (!conflicts.isEmpty()) {
            Event conflict = conflicts.get(0);
            throw ApiException.conflict(
                    "\"" + venue.getName() + "\" is already booked for \"" + conflict.getTitle() + "\" at that time");
        }

        return venue;
    }

    /** A venue with a known capacity caps the event: an unlimited event inherits it, a larger one is rejected. */
    private Integer reconcileCapacity(Venue venue, Integer requested) {
        if (requested != null && requested < 1) {
            throw ApiException.badRequest("Capacity must be at least 1");
        }
        if (venue == null || venue.getCapacity() == null) {
            return requested;
        }
        if (requested == null) {
            return venue.getCapacity();
        }
        if (requested > venue.getCapacity()) {
            throw ApiException.badRequest(
                    "Capacity " + requested + " exceeds \"" + venue.getName() + "\" (" + venue.getCapacity() + " seats)");
        }
        return requested;
    }

    private BigDecimal validatedFee(BigDecimal requested) {
        BigDecimal fee = requested != null ? requested : BigDecimal.ZERO;
        if (fee.signum() < 0 || fee.compareTo(MAX_FEE) > 0) {
            throw ApiException.badRequest("Fee must be between 0 and " + MAX_FEE.toPlainString());
        }
        return fee;
    }

    private BigDecimal validatedBudget(BigDecimal requested) {
        if (requested == null) {
            return null;
        }
        if (requested.signum() < 0 || requested.compareTo(MAX_FEE) > 0) {
            throw ApiException.badRequest("Budget must be between 0 and " + MAX_FEE.toPlainString());
        }
        return requested;
    }

    public EventResponse updateEvent(UUID eventId, CreateEventRequest request, UserPrincipal principal) {
        if (request.title() == null || request.title().trim().isEmpty()) {
            throw ApiException.badRequest("Event title is required");
        }
        if (request.eventDate() == null) {
            throw ApiException.badRequest("Event date is required");
        }

        // Locked so the capacity/fee checks below can't race with RSVPs and payments.
        Event event = eventRepository.findByIdForUpdate(eventId)
                .orElseThrow(() -> ApiException.notFound("Event not found"));

        requireOfficer(event.getClub().getId(), principal, "Only club officers can edit events");

        if (event.isCancelled()) {
            throw ApiException.badRequest("A cancelled event can't be edited");
        }

        Instant oldDate = event.getEventDate();
        Instant oldEnd = event.getEndDate();
        UUID oldVenueId = event.getVenue() != null ? event.getVenue().getId() : null;
        String oldLocation = event.getLocation();
        Integer oldCapacity = event.getCapacity();
        BigDecimal oldFee = event.getFee();
        EventApprovalStatus oldStatus = event.getApprovalStatus();

        if (!request.eventDate().equals(oldDate) && !request.eventDate().isAfter(Instant.now())) {
            throw ApiException.badRequest("The event date must be in the future");
        }

        InputLimits.requireImageSize(request.bannerB64(), "event banner");
        BigDecimal fee = validatedFee(request.fee());
        boolean requiresFaApproval = fee.compareTo(FA_APPROVAL_FEE_THRESHOLD) > 0;
        Venue venue = resolveVenueBooking(request, event.getId());
        Integer capacity = reconcileCapacity(venue, request.capacity());

        if (fee.compareTo(oldFee) != 0 && hasSignups(event)) {
            throw ApiException.badRequest("The fee can't be changed once people have RSVP'd or paid");
        }
        if (capacity != null) {
            long going = rsvpRepository.countByEventIdAndStatus(eventId, RsvpStatus.GOING);
            if (capacity < going) {
                throw ApiException.badRequest("Capacity can't be lower than the " + going + " confirmed RSVPs");
            }
        }

        // Keep an approved event live when an edit doesn't raise the approved fee; otherwise it needs a fresh
        // sign-off (this is also how a rejected event is resubmitted).
        EventApprovalStatus newStatus;
        if (!requiresFaApproval) {
            newStatus = EventApprovalStatus.NOT_REQUIRED;
        } else if (oldStatus == EventApprovalStatus.APPROVED && fee.compareTo(oldFee) <= 0) {
            newStatus = EventApprovalStatus.APPROVED;
        } else {
            newStatus = EventApprovalStatus.PENDING;
        }

        event.setTitle(request.title().trim());
        event.setDescription(request.description());
        event.setLocation(request.location());
        if (request.bannerB64() != null) {
            event.setBannerB64(request.bannerB64());
        }
        event.setEventDate(request.eventDate());
        event.setEndDate(venue != null ? request.endDate() : null);
        event.setVenue(venue);
        event.setFee(fee);
        event.setCapacity(capacity);
        event.setBudget(validatedBudget(request.budget()));
        event.setRequiresFaApproval(requiresFaApproval);
        event.setApprovalStatus(newStatus);
        if (newStatus == EventApprovalStatus.PENDING) {
            event.setRejectionReason(null);
        }
        event = eventRepository.save(event);

        UUID newVenueId = venue != null ? venue.getId() : null;
        boolean detailsChanged = !Objects.equals(oldDate, event.getEventDate())
                || !Objects.equals(oldEnd, event.getEndDate())
                || !Objects.equals(oldVenueId, newVenueId)
                || !Objects.equals(oldLocation, event.getLocation());
        if (detailsChanged) {
            List<UUID> attendees = activeSignupUserIds(eventId);
            if (!attendees.isEmpty()) {
                String where = venue != null ? venue.getName()
                        : (event.getLocation() != null && !event.getLocation().isBlank() ? event.getLocation() : "TBA");
                notificationService.notifyUsers(attendees, "Details changed for \"" + event.getTitle() + "\": now "
                        + DISPLAY_DATE_FORMAT.format(event.getEventDate()) + " at " + where + ".");
            }
        }

        // More seats (or no limit any more) means people who were waiting can now get in.
        if (capacity == null || (oldCapacity != null && capacity > oldCapacity)) {
            rsvpService.promoteFromWaitlist(event);
        }

        if (newStatus == EventApprovalStatus.PENDING && oldStatus != EventApprovalStatus.PENDING) {
            notifyFacultyAdvisors(event);
        }

        return EventResponse.from(event);
    }

    /** Officer-triggered cancellation: notifies everyone who signed up and refunds paid fees. */
    public EventResponse cancelEvent(UUID eventId, String reason, UserPrincipal principal) {
        Event event = eventRepository.findByIdForUpdate(eventId)
                .orElseThrow(() -> ApiException.notFound("Event not found"));

        requireOfficer(event.getClub().getId(), principal, "Only club officers can cancel events");

        if (event.isCancelled()) {
            throw ApiException.badRequest("This event is already cancelled");
        }
        if (event.getEventDate() != null && !event.getEventDate().isAfter(Instant.now())) {
            throw ApiException.badRequest("An event that has already started can't be cancelled");
        }

        cancelInternal(event, reason);

        userRepository.findById(principal.getId()).ifPresent(actor ->
                auditLogService.log(actor, "CANCEL_EVENT", "EVENT", event.getId(), event.getTitle()));

        return EventResponse.from(event);
    }

    /** Marks the event cancelled, notifies attendees and refunds every fee paid. No permission check — callers do that. */
    public void cancelInternal(Event event, String reason) {
        String trimmed = reason == null || reason.isBlank() ? null : reason.trim();
        if (trimmed != null && trimmed.length() > 500) {
            trimmed = trimmed.substring(0, 500);
        }
        event.setCancelled(true);
        event.setCancelReason(trimmed);
        eventRepository.save(event);

        List<UUID> attendees = activeSignupUserIds(event.getId());
        paymentService.refundAllForEvent(event, "event cancelled");
        if (!attendees.isEmpty()) {
            notificationService.notifyUsers(attendees,
                    "\"" + event.getTitle() + "\" has been cancelled" + (trimmed != null ? ": " + trimmed : "") + ".");
        }
    }

    private boolean hasSignups(Event event) {
        return rsvpRepository.countByEventIdAndStatus(event.getId(), RsvpStatus.GOING) > 0
                || rsvpRepository.countByEventIdAndStatus(event.getId(), RsvpStatus.WAITLISTED) > 0
                || !paymentRepository.findByTypeAndReferenceIdAndStatusAndRefundedAtIsNull(
                        PaymentType.EVENT, event.getId(), PaymentStatus.SUCCESS).isEmpty();
    }

    private List<UUID> activeSignupUserIds(UUID eventId) {
        List<UUID> ids = new ArrayList<>();
        rsvpRepository.findByEventIdAndStatus(eventId, RsvpStatus.GOING).forEach(r -> ids.add(r.getUser().getId()));
        rsvpRepository.findByEventIdAndStatus(eventId, RsvpStatus.WAITLISTED).forEach(r -> ids.add(r.getUser().getId()));
        return ids;
    }

    private void notifyFacultyAdvisors(Event event) {
        List<UUID> advisorIds = userRepository.findByRole(Role.FACULTY_ADVISOR).stream().map(User::getId).toList();
        if (!advisorIds.isEmpty()) {
            notificationService.notifyUsers(advisorIds, "\"" + event.getTitle() + "\" (" + event.getClub().getName()
                    + ", fee " + event.getFee() + ") needs your approval.");
        }
    }

    private void requireOfficer(UUID clubId, UserPrincipal principal, String message) {
        Membership membership = membershipRepository.findByUserIdAndClubId(principal.getId(), clubId)
                .orElseThrow(() -> ApiException.forbidden(message));

        if (membership.getStatus() != MembershipStatus.APPROVED
                || !EVENT_CREATOR_POSITIONS.contains(membership.getPosition())) {
            throw ApiException.forbidden(message);
        }
    }

    public List<EventResponse> listPublishedEvents(UUID clubId) {
        return listPublishedEvents(clubId, null, null, null, null);
    }

    /**
     * Published events of active clubs, soonest first. Optional filters: free-text on title/description, the
     * club's category, and a start-date window [from, to).
     */
    public List<EventResponse> listPublishedEvents(UUID clubId, String query, String category, Instant from, Instant to) {
        return eventRepository.findAll(EventSpecifications.published(clubId, query, category, from, to), Sort.by("eventDate"))
                .stream().map(EventResponse::from).toList();
    }

    /** The same filters, one page at a time: the database does the filtering, sorting and counting. */
    @Transactional(readOnly = true)
    public Page<EventResponse> pagePublishedEvents(UUID clubId, String query, String category, Instant from, Instant to,
            Pageable pageable) {
        return eventRepository.findAll(EventSpecifications.published(clubId, query, category, from, to), pageable)
                .map(EventResponse::from);
    }

    public List<EventResponse> listPendingApprovals() {
        return eventRepository.findByApprovalStatus(EventApprovalStatus.PENDING)
                .stream().filter(e -> !e.isCancelled()).map(EventResponse::from).toList();
    }

    /** Unpublished (pending/rejected) events are only visible to the club's officers and university staff. */
    public EventResponse getEvent(UUID eventId, UserPrincipal principal) {
        Event event = eventRepository.findById(eventId)
                .orElseThrow(() -> ApiException.notFound("Event not found"));

        if (EventRules.isPublished(event)) {
            return EventResponse.from(event);
        }

        User viewer = principal == null ? null : userRepository.findById(principal.getId()).orElse(null);
        boolean allowed = viewer != null && (viewer.getRole() == Role.SUPER_ADMIN
                || viewer.getRole() == Role.FACULTY_ADVISOR
                || membershipRepository.findByUserIdAndClubId(viewer.getId(), event.getClub().getId())
                        .filter(m -> m.getStatus() == MembershipStatus.APPROVED)
                        .map(m -> EVENT_CREATOR_POSITIONS.contains(m.getPosition()))
                        .orElse(false));
        if (!allowed) {
            throw ApiException.notFound("Event not found");
        }
        return EventResponse.from(event);
    }

    private static final DateTimeFormatter ICS_DATE_FORMAT = DateTimeFormatter.ofPattern("yyyyMMdd'T'HHmmss'Z'")
            .withZone(ZoneOffset.UTC);

    /** A minimal RFC 5545 .ics file for the event, for adding to Google/Outlook calendars. */
    public String generateIcs(UUID eventId) {
        Event event = eventRepository.findById(eventId)
                .orElseThrow(() -> ApiException.notFound("Event not found"));
        if (!EventRules.isPublished(event)) {
            throw ApiException.notFound("Event not found");
        }

        String start = ICS_DATE_FORMAT.format(event.getEventDate());
        Instant endInstant = event.getEndDate() != null && event.getEndDate().isAfter(event.getEventDate())
                ? event.getEndDate() : event.getEventDate().plusSeconds(3600);
        String end = ICS_DATE_FORMAT.format(endInstant);
        String now = ICS_DATE_FORMAT.format(Instant.now());
        String location = event.getLocation() != null && !event.getLocation().isBlank()
                ? event.getLocation()
                : (event.getVenue() != null ? event.getVenue().getName() : event.getClub().getName());

        return "BEGIN:VCALENDAR\r\n"
                + "VERSION:2.0\r\n"
                + "PRODID:-//Club and Society Management//EN\r\n"
                + "BEGIN:VEVENT\r\n"
                + "UID:" + event.getId() + "@club-society-management\r\n"
                + "DTSTAMP:" + now + "\r\n"
                + "DTSTART:" + start + "\r\n"
                + "DTEND:" + end + "\r\n"
                + "SUMMARY:" + escapeIcs(event.getTitle()) + "\r\n"
                + "DESCRIPTION:" + escapeIcs(event.getDescription()) + "\r\n"
                + "LOCATION:" + escapeIcs(location) + "\r\n"
                + (event.isCancelled() ? "STATUS:CANCELLED\r\n" : "")
                + "END:VEVENT\r\n"
                + "END:VCALENDAR\r\n";
    }

    /** RFC 5545 text escaping: backslash, semicolon, comma and newlines. */
    private static String escapeIcs(String value) {
        if (value == null) {
            return "";
        }
        return value.replace("\\", "\\\\").replace(";", "\\;").replace(",", "\\,")
                .replace("\r\n", "\\n").replace("\n", "\\n").replace("\r", "\\n");
    }

    /**
     * A scannable QR code (PNG) for check-in, officers only. It embeds a short-lived token (see
     * {@link CheckInTokenService}), so the code has to be re-fetched every few minutes while it's on display.
     */
    public byte[] generateQrCode(UUID eventId, UserPrincipal principal) {
        Event event = eventRepository.findById(eventId)
                .orElseThrow(() -> ApiException.notFound("Event not found"));

        requireOfficer(event.getClub().getId(), principal, "Only club officers can show the check-in QR code");

        if (event.isCancelled()) {
            throw ApiException.badRequest("This event has been cancelled");
        }

        String checkInUrl = frontendUrl + "/checkin/" + eventId + "?t=" + checkInTokenService.generate(eventId);
        try {
            com.google.zxing.qrcode.QRCodeWriter writer = new com.google.zxing.qrcode.QRCodeWriter();
            com.google.zxing.common.BitMatrix matrix = writer.encode(
                    checkInUrl, com.google.zxing.BarcodeFormat.QR_CODE, 400, 400);
            java.awt.image.BufferedImage image = com.google.zxing.client.j2se.MatrixToImageWriter.toBufferedImage(matrix);

            ByteArrayOutputStream out = new ByteArrayOutputStream();
            ImageIO.write(image, "png", out);
            return out.toByteArray();
        } catch (com.google.zxing.WriterException | IOException e) {
            throw new RuntimeException("Failed to generate QR code", e);
        }
    }

    public EventResponse reviewEvent(UUID eventId, boolean approve, UserPrincipal principal) {
        return reviewEvent(eventId, approve, null, principal);
    }

    public EventResponse reviewEvent(UUID eventId, boolean approve, String reason, UserPrincipal principal) {
        Event event = eventRepository.findById(eventId)
                .orElseThrow(() -> ApiException.notFound("Event not found"));

        if (event.getApprovalStatus() != EventApprovalStatus.PENDING) {
            throw ApiException.badRequest("Only pending events can be approved or rejected");
        }
        if (event.isCancelled()) {
            throw ApiException.badRequest("This event has been cancelled");
        }

        String cleanReason = reason == null || reason.isBlank() ? null : reason.trim();
        if (cleanReason != null && cleanReason.length() > 500) {
            cleanReason = cleanReason.substring(0, 500);
        }

        event.setApprovalStatus(approve ? EventApprovalStatus.APPROVED : EventApprovalStatus.REJECTED);
        event.setRejectionReason(approve ? null : cleanReason);
        event = eventRepository.save(event);

        User actor = userRepository.findById(principal.getId())
                .orElseThrow(() -> ApiException.notFound("User not found"));
        auditLogService.log(actor, approve ? "APPROVE_EVENT" : "REJECT_EVENT", "EVENT", event.getId(), event.getTitle());

        String eventTitle = event.getTitle();
        String why = !approve && cleanReason != null ? " Reason: " + cleanReason : "";
        membershipRepository.findByClubIdAndPosition(event.getClub().getId(), MembershipPosition.PRESIDENT)
                .ifPresent(president -> notificationService.notify(president.getUser(), approve
                        ? "Your event \"" + eventTitle + "\" was approved and is now live."
                        : "Your event \"" + eventTitle + "\" was rejected by the Faculty Advisor." + why));

        return EventResponse.from(event);
    }
}
