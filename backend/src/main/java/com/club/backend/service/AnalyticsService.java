package com.club.backend.service;

import java.math.BigDecimal;
import java.util.UUID;

import org.springframework.stereotype.Service;

import com.club.backend.dto.ClubStatsResponse;
import com.club.backend.dto.UniversityStatsResponse;
import com.club.backend.entity.ClubStatus;
import com.club.backend.entity.EventApprovalStatus;
import com.club.backend.entity.MembershipStatus;
import com.club.backend.entity.PaymentStatus;
import com.club.backend.entity.Role;
import com.club.backend.entity.RsvpStatus;
import com.club.backend.repository.AttendanceRepository;
import com.club.backend.repository.ClubRepository;
import com.club.backend.repository.EventRepository;
import com.club.backend.repository.MembershipRepository;
import com.club.backend.repository.PaymentRepository;
import com.club.backend.repository.RsvpRepository;
import com.club.backend.repository.UserRepository;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class AnalyticsService {

    private final MembershipRepository membershipRepository;
    private final EventRepository eventRepository;
    private final RsvpRepository rsvpRepository;
    private final AttendanceRepository attendanceRepository;
    private final ClubRepository clubRepository;
    private final UserRepository userRepository;
    private final PaymentRepository paymentRepository;

    public ClubStatsResponse getClubStats(UUID clubId) {
        long memberCount = membershipRepository.findByClubIdAndStatus(clubId, MembershipStatus.APPROVED).size();
        long eventCount = eventRepository.findByClubId(clubId).size();
        long totalRsvps = rsvpRepository.countByEvent_Club_IdAndStatus(clubId, RsvpStatus.GOING);
        long totalAttendance = attendanceRepository.countByEvent_Club_Id(clubId);
        return new ClubStatsResponse(memberCount, eventCount, totalRsvps, totalAttendance);
    }

    public UniversityStatsResponse getUniversityStats() {
        long totalClubs = clubRepository.findByStatus(ClubStatus.APPROVED).size();
        long totalStudents = userRepository.countByRole(Role.STUDENT);
        long totalEvents = eventRepository.findAll().stream()
                .filter(e -> e.getApprovalStatus() == EventApprovalStatus.NOT_REQUIRED
                        || e.getApprovalStatus() == EventApprovalStatus.APPROVED)
                .count();
        BigDecimal totalPaymentsCollected = paymentRepository.findAll().stream()
                .filter(p -> p.getStatus() == PaymentStatus.SUCCESS)
                .map(p -> p.getAmount())
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        long pendingClubProposals = clubRepository.findByStatus(ClubStatus.PENDING).size();
        long pendingEventApprovals = eventRepository.findByApprovalStatus(EventApprovalStatus.PENDING).size();

        return new UniversityStatsResponse(
                totalClubs, totalStudents, totalEvents, totalPaymentsCollected,
                pendingClubProposals, pendingEventApprovals);
    }
}
