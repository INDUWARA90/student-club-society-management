package com.club.backend.service;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.math.BigDecimal;
import java.util.LinkedHashMap;
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

    public String getClubStatsCsv(UUID clubId) {
        ClubStatsResponse stats = getClubStats(clubId);
        return "Metric,Value\n"
                + "Members," + stats.memberCount() + "\n"
                + "Events," + stats.eventCount() + "\n"
                + "RSVPs," + stats.totalRsvps() + "\n"
                + "Attendance," + stats.totalAttendance() + "\n";
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

    public byte[] getClubStatsPdf(UUID clubId) {
        ClubStatsResponse stats = getClubStats(clubId);
        Map<String, String> rows = new LinkedHashMap<>();
        rows.put("Members", String.valueOf(stats.memberCount()));
        rows.put("Events", String.valueOf(stats.eventCount()));
        rows.put("RSVPs", String.valueOf(stats.totalRsvps()));
        rows.put("Attendance", String.valueOf(stats.totalAttendance()));
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
