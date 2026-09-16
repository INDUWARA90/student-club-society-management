package com.club.backend.service;

import java.math.BigDecimal;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Set;
import java.util.UUID;

import java.io.ByteArrayOutputStream;
import java.io.IOException;

import javax.imageio.ImageIO;

import org.springframework.beans.factory.annotation.Value;
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
import com.club.backend.entity.User;
import com.club.backend.repository.ClubRepository;
import com.club.backend.repository.EventRepository;
import com.club.backend.repository.MembershipRepository;
import com.club.backend.repository.UserRepository;
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
    private final UserRepository userRepository;
    private final AuditLogService auditLogService;

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
                .location(request.location())
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

    public EventResponse updateEvent(UUID eventId, CreateEventRequest request, UserPrincipal principal) {
        if (request.title() == null || request.title().trim().isEmpty()) {
            throw ApiException.badRequest("Event title is required");
        }
        if (request.eventDate() == null) {
            throw ApiException.badRequest("Event date is required");
        }

        Event event = eventRepository.findById(eventId)
                .orElseThrow(() -> ApiException.notFound("Event not found"));

        Membership membership = membershipRepository.findByUserIdAndClubId(principal.getId(), event.getClub().getId())
                .orElseThrow(() -> ApiException.forbidden("Only club officers can edit events"));

        if (membership.getStatus() != MembershipStatus.APPROVED
                || !EVENT_CREATOR_POSITIONS.contains(membership.getPosition())) {
            throw ApiException.forbidden("Only club officers can edit events");
        }

        BigDecimal fee = request.fee() != null ? request.fee() : BigDecimal.ZERO;
        boolean requiresFaApproval = fee.compareTo(FA_APPROVAL_FEE_THRESHOLD) > 0;

        event.setTitle(request.title().trim());
        event.setDescription(request.description());
        event.setLocation(request.location());
        if (request.bannerB64() != null) {
            event.setBannerB64(request.bannerB64());
        }
        event.setEventDate(request.eventDate());
        event.setFee(fee);
        event.setCapacity(request.capacity());
        event.setRequiresFaApproval(requiresFaApproval);
        // Fee crossing the threshold in either direction resets approval, requiring a fresh FA sign-off.
        event.setApprovalStatus(requiresFaApproval ? EventApprovalStatus.PENDING : EventApprovalStatus.NOT_REQUIRED);
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

    private static final DateTimeFormatter ICS_DATE_FORMAT = DateTimeFormatter.ofPattern("yyyyMMdd'T'HHmmss'Z'")
            .withZone(ZoneOffset.UTC);

    /** A minimal RFC 5545 .ics file for the event, for adding to Google/Outlook calendars. */
    public String generateIcs(UUID eventId) {
        Event event = eventRepository.findById(eventId)
                .orElseThrow(() -> ApiException.notFound("Event not found"));

        String start = ICS_DATE_FORMAT.format(event.getEventDate());
        String end = ICS_DATE_FORMAT.format(event.getEventDate().plusSeconds(3600));
        String now = ICS_DATE_FORMAT.format(java.time.Instant.now());
        String description = event.getDescription() != null ? event.getDescription().replace("\n", "\\n") : "";

        return "BEGIN:VCALENDAR\r\n"
                + "VERSION:2.0\r\n"
                + "PRODID:-//Club and Society Management//EN\r\n"
                + "BEGIN:VEVENT\r\n"
                + "UID:" + event.getId() + "@club-society-management\r\n"
                + "DTSTAMP:" + now + "\r\n"
                + "DTSTART:" + start + "\r\n"
                + "DTEND:" + end + "\r\n"
                + "SUMMARY:" + event.getTitle() + "\r\n"
                + "DESCRIPTION:" + description + "\r\n"
                + "LOCATION:" + (event.getLocation() != null ? event.getLocation() : event.getClub().getName()) + "\r\n"
                + "END:VEVENT\r\n"
                + "END:VCALENDAR\r\n";
    }

    /** A scannable QR code (PNG) encoding a link that self-check-ins whoever scans it. */
    public byte[] generateQrCode(UUID eventId) {
        if (!eventRepository.existsById(eventId)) {
            throw ApiException.notFound("Event not found");
        }

        String checkInUrl = frontendUrl + "/checkin/" + eventId;
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
        Event event = eventRepository.findById(eventId)
                .orElseThrow(() -> ApiException.notFound("Event not found"));

        if (event.getApprovalStatus() != EventApprovalStatus.PENDING) {
            throw ApiException.badRequest("Only pending events can be approved or rejected");
        }

        event.setApprovalStatus(approve ? EventApprovalStatus.APPROVED : EventApprovalStatus.REJECTED);
        event = eventRepository.save(event);

        User actor = userRepository.findById(principal.getId())
                .orElseThrow(() -> ApiException.notFound("User not found"));
        auditLogService.log(actor, approve ? "APPROVE_EVENT" : "REJECT_EVENT", "EVENT", event.getId(), event.getTitle());

        return EventResponse.from(event);
    }
}
