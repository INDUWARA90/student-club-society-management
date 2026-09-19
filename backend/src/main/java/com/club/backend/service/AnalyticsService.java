package com.club.backend.service;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDPage;
import org.apache.pdfbox.pdmodel.PDPageContentStream;
import org.apache.pdfbox.pdmodel.common.PDRectangle;
import org.apache.pdfbox.pdmodel.font.PDType1Font;
import org.apache.pdfbox.pdmodel.font.Standard14Fonts;
import org.springframework.stereotype.Service;

import com.club.backend.dto.ClubStatsResponse;
import com.club.backend.dto.UniversityStatsResponse;
import com.club.backend.entity.ClubStatus;
import com.club.backend.entity.Event;
import com.club.backend.entity.EventApprovalStatus;
import com.club.backend.entity.EventFeedback;
import com.club.backend.entity.MembershipPosition;
import com.club.backend.entity.MembershipStatus;
import com.club.backend.entity.PaymentStatus;
import com.club.backend.entity.Role;
import com.club.backend.entity.RsvpStatus;
import com.club.backend.entity.User;
import com.club.backend.repository.AttendanceRepository;
import com.club.backend.repository.ClubRepository;
import com.club.backend.repository.EventFeedbackRepository;
import com.club.backend.repository.EventRepository;
import com.club.backend.repository.MembershipRepository;
import com.club.backend.repository.PaymentRepository;
import com.club.backend.repository.RsvpRepository;
import com.club.backend.repository.UserRepository;
import com.club.backend.security.UserPrincipal;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class AnalyticsService {

    private static final java.util.Set<MembershipPosition> FINANCE_VIEWER_POSITIONS = java.util.Set.of(
            MembershipPosition.PRESIDENT, MembershipPosition.VP,
            MembershipPosition.SECRETARY, MembershipPosition.TREASURER);

    private final MembershipRepository membershipRepository;
    private final EventRepository eventRepository;
    private final RsvpRepository rsvpRepository;
    private final AttendanceRepository attendanceRepository;
    private final ClubRepository clubRepository;
    private final UserRepository userRepository;
    private final PaymentRepository paymentRepository;
    private final ClubExpenseService clubExpenseService;
    private final EventFeedbackRepository feedbackRepository;

    /** Member/event/RSVP/attendance counts are visible to anyone; financial figures only to club officers and university staff. */
    public ClubStatsResponse getClubStats(UUID clubId, UserPrincipal principal) {
        long memberCount = membershipRepository.findByClubIdAndStatus(clubId, MembershipStatus.APPROVED).size();
        List<Event> clubEvents = eventRepository.findByClubId(clubId);
        long eventCount = clubEvents.size();
        long totalRsvps = rsvpRepository.countByEvent_Club_IdAndStatus(clubId, RsvpStatus.GOING);
        long totalAttendance = attendanceRepository.countByEvent_Club_Id(clubId);

        // Per-event RSVP vs attendance (no-shows) and ratings, for events that are live and already under way.
        Instant now = Instant.now();
        List<ClubStatsResponse.EventEngagement> engagement = new ArrayList<>();
        long pastGoing = 0;
        long pastAttended = 0;
        double ratingSum = 0;
        long ratingCount = 0;
        for (Event event : clubEvents) {
            boolean live = (event.getApprovalStatus() == EventApprovalStatus.NOT_REQUIRED
                    || event.getApprovalStatus() == EventApprovalStatus.APPROVED) && !event.isCancelled();
            if (!live || event.getEventDate() == null || event.getEventDate().isAfter(now)) {
                continue;
            }
            long going = rsvpRepository.countByEventIdAndStatus(event.getId(), RsvpStatus.GOING);
            long attended = attendanceRepository.countByEventId(event.getId());
            List<EventFeedback> feedback = feedbackRepository.findByEventId(event.getId());
            double average = feedback.stream().mapToInt(EventFeedback::getRating).average().orElse(0);
            engagement.add(new ClubStatsResponse.EventEngagement(
                    event.getId(), event.getTitle(), going, attended, Math.max(0, going - attended), average));
            pastGoing += going;
            pastAttended += attended;
            ratingSum += feedback.stream().mapToInt(EventFeedback::getRating).sum();
            ratingCount += feedback.size();
        }
        double attendanceRate = pastGoing > 0 ? Math.min(100.0, pastAttended * 100.0 / pastGoing) : 0;
        double averageRating = ratingCount > 0 ? ratingSum / ratingCount : 0;

        BigDecimal totalIncome = BigDecimal.ZERO;
        BigDecimal totalExpenses = BigDecimal.ZERO;
        BigDecimal balance = BigDecimal.ZERO;
        if (canViewFinances(clubId, principal)) {
            var ledger = clubExpenseService.computeLedger(clubId);
            totalIncome = ledger.totalIncome();
            totalExpenses = ledger.totalExpenses();
            balance = ledger.balance();
        }

        return new ClubStatsResponse(memberCount, eventCount, totalRsvps, totalAttendance,
                totalIncome, totalExpenses, balance, attendanceRate, averageRating, engagement);
    }

    private boolean canViewFinances(UUID clubId, UserPrincipal principal) {
        if (principal == null) {
            return false;
        }
        User viewer = userRepository.findById(principal.getId()).orElse(null);
        if (viewer == null) {
            return false;
        }
        if (viewer.getRole() == Role.SUPER_ADMIN || viewer.getRole() == Role.FACULTY_ADVISOR) {
            return true;
        }
        return membershipRepository.findByUserIdAndClubId(viewer.getId(), clubId)
                .filter(m -> m.getStatus() == MembershipStatus.APPROVED)
                .map(m -> FINANCE_VIEWER_POSITIONS.contains(m.getPosition()))
                .orElse(false);
    }

    public UniversityStatsResponse getUniversityStats() {
        long totalClubs = clubRepository.countByStatusAndArchivedFalse(ClubStatus.APPROVED);
        long totalStudents = userRepository.countByRole(Role.STUDENT);
        long totalEvents = eventRepository.countByApprovalStatusInAndCancelledFalse(
                List.of(EventApprovalStatus.NOT_REQUIRED, EventApprovalStatus.APPROVED));
        BigDecimal totalPaymentsCollected = paymentRepository.sumLiveAmount();
        long pendingClubProposals = clubRepository.findByStatus(ClubStatus.PENDING).size();
        long pendingEventApprovals = eventRepository.findByApprovalStatus(EventApprovalStatus.PENDING).size();

        return new UniversityStatsResponse(
                totalClubs, totalStudents, totalEvents, totalPaymentsCollected,
                pendingClubProposals, pendingEventApprovals);
    }

    public String getUniversityStatsCsv() {
        UniversityStatsResponse stats = getUniversityStats();
        return "Metric,Value\n"
                + "Approved Clubs," + stats.totalClubs() + "\n"
                + "Students," + stats.totalStudents() + "\n"
                + "Published Events," + stats.totalEvents() + "\n"
                + "Payments Collected," + stats.totalPaymentsCollected() + "\n"
                + "Pending Club Proposals," + stats.pendingClubProposals() + "\n"
                + "Pending Event Approvals," + stats.pendingEventApprovals() + "\n";
    }

    public String getClubStatsCsv(UUID clubId, UserPrincipal principal) {
        ClubStatsResponse stats = getClubStats(clubId, principal);
        return "Metric,Value\n"
                + "Members," + stats.memberCount() + "\n"
                + "Events," + stats.eventCount() + "\n"
                + "RSVPs," + stats.totalRsvps() + "\n"
                + "Attendance," + stats.totalAttendance() + "\n"
                + "Attendance Rate (%)," + String.format(java.util.Locale.ROOT, "%.1f", stats.attendanceRatePercent()) + "\n"
                + "Average Event Rating," + String.format(java.util.Locale.ROOT, "%.2f", stats.averageEventRating()) + "\n"
                + "Total Income," + stats.totalIncome() + "\n"
                + "Total Expenses," + stats.totalExpenses() + "\n"
                + "Balance," + stats.balance() + "\n";
    }

    public byte[] getUniversityStatsPdf() {
        UniversityStatsResponse stats = getUniversityStats();
        Map<String, String> rows = new LinkedHashMap<>();
        rows.put("Approved Clubs", String.valueOf(stats.totalClubs()));
        rows.put("Students", String.valueOf(stats.totalStudents()));
        rows.put("Published Events", String.valueOf(stats.totalEvents()));
        rows.put("Payments Collected", String.valueOf(stats.totalPaymentsCollected()));
        rows.put("Pending Club Proposals", String.valueOf(stats.pendingClubProposals()));
        rows.put("Pending Event Approvals", String.valueOf(stats.pendingEventApprovals()));
        return renderReportPdf("University-Wide Report", rows);
    }

    public byte[] getClubStatsPdf(UUID clubId, UserPrincipal principal) {
        ClubStatsResponse stats = getClubStats(clubId, principal);
        Map<String, String> rows = new LinkedHashMap<>();
        rows.put("Members", String.valueOf(stats.memberCount()));
        rows.put("Events", String.valueOf(stats.eventCount()));
        rows.put("RSVPs", String.valueOf(stats.totalRsvps()));
        rows.put("Attendance", String.valueOf(stats.totalAttendance()));
        rows.put("Attendance Rate (%)", String.format(java.util.Locale.ROOT, "%.1f", stats.attendanceRatePercent()));
        rows.put("Average Event Rating", String.format(java.util.Locale.ROOT, "%.2f", stats.averageEventRating()));
        rows.put("Total Income", String.valueOf(stats.totalIncome()));
        rows.put("Total Expenses", String.valueOf(stats.totalExpenses()));
        rows.put("Balance", String.valueOf(stats.balance()));
        return renderReportPdf("Club Report", rows);
    }

    private byte[] renderReportPdf(String title, Map<String, String> rows) {
        try (PDDocument document = new PDDocument()) {
            PDPage page = new PDPage(PDRectangle.A4);
            document.addPage(page);

            try (PDPageContentStream content = new PDPageContentStream(document, page)) {
                PDType1Font titleFont = new PDType1Font(Standard14Fonts.FontName.HELVETICA_BOLD);
                PDType1Font bodyFont = new PDType1Font(Standard14Fonts.FontName.HELVETICA);

                content.beginText();
                content.setFont(titleFont, 20);
                content.newLineAtOffset(60, 760);
                content.showText(title);
                content.endText();

                float y = 710;
                for (Map.Entry<String, String> row : rows.entrySet()) {
                    content.beginText();
                    content.setFont(bodyFont, 12);
                    content.newLineAtOffset(60, y);
                    content.showText(row.getKey() + ": " + row.getValue());
                    content.endText();
                    y -= 24;
                }
            }

            ByteArrayOutputStream out = new ByteArrayOutputStream();
            document.save(out);
            return out.toByteArray();
        } catch (IOException e) {
            throw new RuntimeException("Failed to generate report PDF", e);
        }
    }
}
