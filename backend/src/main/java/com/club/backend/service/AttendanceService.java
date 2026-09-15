package com.club.backend.service;

import java.util.List;
import java.util.Set;
import java.util.UUID;

import org.springframework.stereotype.Service;

import com.club.backend.config.ApiException;
import com.club.backend.dto.AttendanceResponse;
import com.club.backend.entity.Attendance;
import com.club.backend.entity.AttendanceMethod;
import com.club.backend.entity.Event;
import com.club.backend.entity.Membership;
import com.club.backend.entity.MembershipPosition;
import com.club.backend.entity.MembershipStatus;
import com.club.backend.entity.User;
import com.club.backend.repository.AttendanceRepository;
import com.club.backend.repository.EventRepository;
import com.club.backend.repository.MembershipRepository;
import com.club.backend.repository.UserRepository;
import com.club.backend.security.UserPrincipal;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class AttendanceService {

    private static final Set<MembershipPosition> ATTENDANCE_MARKER_POSITIONS = Set.of(
            MembershipPosition.PRESIDENT, MembershipPosition.VP,
            MembershipPosition.SECRETARY, MembershipPosition.TREASURER);

    private final AttendanceRepository attendanceRepository;
    private final EventRepository eventRepository;
    private final MembershipRepository membershipRepository;
    private final UserRepository userRepository;
    private final CertificateService certificateService;

    /** Manual marking by a club officer, on behalf of any user. */
    public AttendanceResponse markManual(UUID eventId, UUID targetUserId, UserPrincipal principal) {
        Event event = eventRepository.findById(eventId)
                .orElseThrow(() -> ApiException.notFound("Event not found"));

        Membership marker = membershipRepository.findByUserIdAndClubId(principal.getId(), event.getClub().getId())
                .orElseThrow(() -> ApiException.forbidden("Only club officers can mark attendance"));

        if (marker.getStatus() != MembershipStatus.APPROVED
                || !ATTENDANCE_MARKER_POSITIONS.contains(marker.getPosition())) {
            throw ApiException.forbidden("Only club officers can mark attendance");
        }

        return recordAttendance(event, targetUserId, AttendanceMethod.MANUAL);
    }

    /** QR self check-in: the logged-in user checks themselves in. */
    public AttendanceResponse checkInViaQr(UUID eventId, UserPrincipal principal) {
        Event event = eventRepository.findById(eventId)
                .orElseThrow(() -> ApiException.notFound("Event not found"));

        return recordAttendance(event, principal.getId(), AttendanceMethod.QR);
    }

    private AttendanceResponse recordAttendance(Event event, UUID userId, AttendanceMethod method) {
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

    public List<AttendanceResponse> listAttendance(UUID eventId) {
        return attendanceRepository.findByEventId(eventId).stream().map(AttendanceResponse::from).toList();
    }
}
