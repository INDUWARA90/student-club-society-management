package com.club.backend.service;

import java.time.Instant;
import java.util.List;
import java.util.Set;
import java.util.UUID;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.club.backend.config.ApiException;
import com.club.backend.dto.AttendanceResponse;
import com.club.backend.entity.Attendance;
import com.club.backend.entity.AttendanceMethod;
import com.club.backend.entity.Event;
import com.club.backend.entity.Membership;
import com.club.backend.entity.MembershipPosition;
import com.club.backend.entity.MembershipStatus;
import com.club.backend.entity.Role;
import com.club.backend.entity.RsvpStatus;
import com.club.backend.entity.User;
import com.club.backend.repository.AttendanceRepository;
import com.club.backend.repository.EventRepository;
import com.club.backend.repository.MembershipRepository;
import com.club.backend.repository.RsvpRepository;
import com.club.backend.repository.UserRepository;
import com.club.backend.security.UserPrincipal;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
@Transactional
public class AttendanceService {

    private static final Set<MembershipPosition> ATTENDANCE_MARKER_POSITIONS = Set.of(
            MembershipPosition.PRESIDENT, MembershipPosition.VP,
            MembershipPosition.SECRETARY, MembershipPosition.TREASURER);

    /** QR check-in stays open this long after the start when the event has no explicit end time. */
    private static final long DEFAULT_CHECK_IN_WINDOW_SECONDS = 6 * 3600;

    private final AttendanceRepository attendanceRepository;
    private final EventRepository eventRepository;
    private final MembershipRepository membershipRepository;
    private final UserRepository userRepository;
    private final RsvpRepository rsvpRepository;
    private final CertificateService certificateService;
    private final CheckInTokenService checkInTokenService;

    /** Manual marking by a club officer, on behalf of any user. */
    public AttendanceResponse markManual(UUID eventId, UUID targetUserId, UserPrincipal principal) {
        Event event = eventRepository.findById(eventId)
                .orElseThrow(() -> ApiException.notFound("Event not found"));

        if (!isOfficer(principal.getId(), event)) {
            throw ApiException.forbidden("Only club officers can mark attendance");
        }

        return recordAttendance(event, targetUserId, AttendanceMethod.MANUAL);
    }

    /**
     * QR self check-in: the logged-in user checks themselves in. The scanned link must carry a current token, the
     * event must be in its check-in window, and for capacity-limited events the user needs a confirmed RSVP.
     */
    public AttendanceResponse checkInViaQr(UUID eventId, String token, UserPrincipal principal) {
        Event event = eventRepository.findById(eventId)
                .orElseThrow(() -> ApiException.notFound("Event not found"));

        if (!checkInTokenService.isValid(eventId, token)) {
            throw ApiException.forbidden("This QR code is invalid or has expired — ask an organiser to show a fresh one");
        }

        Instant closesAt = event.getEndDate() != null
                ? event.getEndDate()
                : event.getEventDate().plusSeconds(DEFAULT_CHECK_IN_WINDOW_SECONDS);
        if (Instant.now().isAfter(closesAt)) {
            throw ApiException.badRequest("Check-in has closed for this event");
        }

        if (event.getCapacity() != null && rsvpRepository.findByEventIdAndUserId(eventId, principal.getId())
                .filter(r -> r.getStatus() == RsvpStatus.GOING).isEmpty()) {
            throw ApiException.forbidden("This event is RSVP-only — you need a confirmed RSVP to check in");
        }

        return recordAttendance(event, principal.getId(), AttendanceMethod.QR);
    }

    private AttendanceResponse recordAttendance(Event event, UUID userId, AttendanceMethod method) {
        if (!EventRules.isPublished(event)) {
            throw ApiException.badRequest("Attendance can't be recorded for an event that isn't published");
        }

        if (event.isCancelled()) {
            throw ApiException.badRequest("Attendance can't be recorded for a cancelled event");
        }

        if (event.getEventDate().isAfter(Instant.now())) {
            throw ApiException.badRequest("Attendance can't be recorded before the event starts");
        }

        if (attendanceRepository.findByEventIdAndUserId(event.getId(), userId).isPresent()) {
            throw ApiException.conflict("Attendance already recorded for this user");
        }

        User user = userRepository.findById(userId)
                .orElseThrow(() -> ApiException.notFound("User not found"));

        Attendance attendance = Attendance.builder().event(event).user(user).method(method).build();
        attendance = attendanceRepository.save(attendance);

        certificateService.checkAndIssueCertificate(user, event.getClub());

        return AttendanceResponse.from(attendance);
    }

    /** Officers and university staff see everyone; anyone else only sees their own check-in. */
    public List<AttendanceResponse> listAttendance(UUID eventId, UserPrincipal principal) {
        Event event = eventRepository.findById(eventId)
                .orElseThrow(() -> ApiException.notFound("Event not found"));

        User viewer = userRepository.findById(principal.getId())
                .orElseThrow(() -> ApiException.notFound("User not found"));
        boolean staff = viewer.getRole() == Role.SUPER_ADMIN || viewer.getRole() == Role.FACULTY_ADVISOR;

        if (staff || isOfficer(viewer.getId(), event)) {
            return attendanceRepository.findByEventId(eventId).stream().map(AttendanceResponse::from).toList();
        }
        return attendanceRepository.findByEventIdAndUserId(eventId, viewer.getId())
                .map(a -> List.of(AttendanceResponse.from(a)))
                .orElse(List.of());
    }

    private boolean isOfficer(UUID userId, Event event) {
        return membershipRepository.findByUserIdAndClubId(userId, event.getClub().getId())
                .filter(m -> m.getStatus() == MembershipStatus.APPROVED)
                .map(Membership::getPosition)
                .map(ATTENDANCE_MARKER_POSITIONS::contains)
                .orElse(false);
    }
}
