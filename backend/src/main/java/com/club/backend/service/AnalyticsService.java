package com.club.backend.service;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;

import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDPage;
import org.apache.pdfbox.pdmodel.PDPageContentStream;
import org.apache.pdfbox.pdmodel.common.PDRectangle;
import org.apache.pdfbox.pdmodel.font.PDType1Font;
import org.apache.pdfbox.pdmodel.font.Standard14Fonts;
import org.springframework.stereotype.Service;

import com.club.backend.config.ApiException;
import com.club.backend.dto.ClubStatsResponse;
import com.club.backend.dto.UniversityStatsResponse;
import com.club.backend.entity.Club;
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

    // ---------------------------------------------------------------------------------------------------------
    // Exportable reports (CSV / PDF). Both formats render the same Report, so they always agree with each other.
    // ---------------------------------------------------------------------------------------------------------

    /** A titled table inside a report. */
    private record ReportSection(String title, List<String> header, List<List<String>> rows) {
    }

    /** Headline metrics followed by detail tables (club information, activities, members, per-club rows...). */
    private record Report(String title, Map<String, String> summary, List<ReportSection> sections) {
    }

    public String getUniversityStatsCsv() {
        return toCsv(buildUniversityReport());
    }

    public String getClubStatsCsv(UUID clubId, UserPrincipal principal) {
        return toCsv(buildClubReport(clubId, principal));
    }

    public byte[] getUniversityStatsPdf() {
        return toPdf(buildUniversityReport());
    }

    public byte[] getClubStatsPdf(UUID clubId, UserPrincipal principal) {
        return toPdf(buildClubReport(clubId, principal));
    }

    private Report buildUniversityReport() {
        UniversityStatsResponse stats = getUniversityStats();
        Map<String, String> summary = new LinkedHashMap<>();
        summary.put("Approved Clubs", String.valueOf(stats.totalClubs()));
        summary.put("Students", String.valueOf(stats.totalStudents()));
        summary.put("Published Events", String.valueOf(stats.totalEvents()));
        summary.put("Payments Collected", String.valueOf(stats.totalPaymentsCollected()));
        summary.put("Pending Club Proposals", String.valueOf(stats.pendingClubProposals()));
        summary.put("Pending Event Approvals", String.valueOf(stats.pendingEventApprovals()));

        List<List<String>> clubRows = new ArrayList<>();
        clubRepository.findByStatus(ClubStatus.APPROVED).stream()
                .filter(club -> !club.isArchived())
                .sorted(Comparator.comparing(club -> club.getName().toLowerCase()))
                .forEach(club -> clubRows.add(List.of(
                        club.getName(),
                        nullToEmpty(club.getCategory()),
                        String.valueOf(membershipRepository.findByClubIdAndStatus(club.getId(), MembershipStatus.APPROVED).size()),
                        String.valueOf(eventRepository.findByClubId(club.getId()).size()))));

        List<ReportSection> sections = new ArrayList<>();
        sections.add(new ReportSection("Clubs", List.of("Club", "Category", "Members", "Events"), clubRows));
        return new Report("University-Wide Report", summary, sections);
    }

    private Report buildClubReport(UUID clubId, UserPrincipal principal) {
        Club club = clubRepository.findById(clubId).orElseThrow(() -> ApiException.notFound("Club not found"));
        ClubStatsResponse stats = getClubStats(clubId, principal);

        Map<String, String> summary = new LinkedHashMap<>();
        summary.put("Members", String.valueOf(stats.memberCount()));
        summary.put("Events", String.valueOf(stats.eventCount()));
        summary.put("RSVPs", String.valueOf(stats.totalRsvps()));
        summary.put("Attendance", String.valueOf(stats.totalAttendance()));
        summary.put("Attendance Rate (%)", String.format(Locale.ROOT, "%.1f", stats.attendanceRatePercent()));
        summary.put("Average Event Rating", String.format(Locale.ROOT, "%.2f", stats.averageEventRating()));
        summary.put("Total Income", String.valueOf(stats.totalIncome()));
        summary.put("Total Expenses", String.valueOf(stats.totalExpenses()));
        summary.put("Balance", String.valueOf(stats.balance()));

        List<ReportSection> sections = new ArrayList<>();

        // Club information report
        List<List<String>> info = new ArrayList<>();
        info.add(List.of("Name", club.getName()));
        info.add(List.of("Category", nullToEmpty(club.getCategory())));
        info.add(List.of("Status", club.isArchived() ? "ARCHIVED" : String.valueOf(club.getStatus())));
        info.add(List.of("Join policy", String.valueOf(club.getJoinPolicy())));
        info.add(List.of("Membership fee", String.valueOf(club.getMembershipFee())));
        info.add(List.of("Created", String.valueOf(club.getCreatedAt())));
        sections.add(new ReportSection("Club information", List.of("Field", "Value"), info));

        // Activity + participation report: one row per event
        Map<UUID, ClubStatsResponse.EventEngagement> engagement = new HashMap<>();
        stats.events().forEach(e -> engagement.put(e.eventId(), e));
        Instant now = Instant.now();
        List<List<String>> activities = new ArrayList<>();
        eventRepository.findByClubId(clubId).stream()
                .sorted(Comparator.comparing(Event::getEventDate, Comparator.nullsLast(Comparator.naturalOrder())))
                .forEach(event -> {
                    ClubStatsResponse.EventEngagement e = engagement.get(event.getId());
                    long going = e != null ? e.going()
                            : rsvpRepository.countByEventIdAndStatus(event.getId(), RsvpStatus.GOING);
                    activities.add(List.of(
                            event.getTitle(),
                            event.getEventDate() == null ? "" : String.valueOf(event.getEventDate()),
                            eventStatus(event, now),
                            String.valueOf(going),
                            e != null ? String.valueOf(e.attended()) : "",
                            e != null ? String.valueOf(e.noShows()) : "",
                            e != null && e.averageRating() > 0
                                    ? String.format(Locale.ROOT, "%.2f", e.averageRating()) : ""));
                });
        sections.add(new ReportSection("Activities and participation",
                List.of("Event", "Date", "Status", "Going", "Attended", "No-shows", "Avg rating"), activities));

        // Membership report: officers and university staff only (the summary above is visible to everyone)
        if (isOfficerOrStaff(clubId, principal)) {
            List<List<String>> members = new ArrayList<>();
            membershipRepository.findByClubIdAndStatus(clubId, MembershipStatus.APPROVED).stream()
                    .sorted(Comparator.comparing(m -> m.getUser().getName().toLowerCase()))
                    .forEach(m -> members.add(List.of(
                            m.getUser().getName(), String.valueOf(m.getPosition()), String.valueOf(m.getJoinedAt()))));
            sections.add(new ReportSection("Members", List.of("Name", "Position", "Joined"), members));
        }
        return new Report("Club Report - " + club.getName(), summary, sections);
    }

    private String eventStatus(Event event, Instant now) {
        if (event.isCancelled()) {
            return "Cancelled";
        }
        if (event.getApprovalStatus() == EventApprovalStatus.PENDING) {
            return "Pending approval";
        }
        if (event.getApprovalStatus() == EventApprovalStatus.REJECTED) {
            return "Rejected";
        }
        return event.getEventDate() != null && event.getEventDate().isAfter(now) ? "Upcoming" : "Held";
    }

    private boolean isOfficerOrStaff(UUID clubId, UserPrincipal principal) {
        return canViewFinances(clubId, principal);
    }

    private String nullToEmpty(String value) {
        return value == null ? "" : value;
    }

    private String toCsv(Report report) {
        StringBuilder csv = new StringBuilder("Metric,Value\n");
        report.summary().forEach((key, value) -> csv.append(CsvSupport.escape(key)).append(',')
                .append(CsvSupport.escape(value)).append('\n'));
        for (ReportSection section : report.sections()) {
            csv.append('\n').append(CsvSupport.escape(section.title())).append('\n');
            csv.append(String.join(",", section.header().stream().map(CsvSupport::escape).toList())).append('\n');
            for (List<String> row : section.rows()) {
                csv.append(String.join(",", row.stream().map(CsvSupport::escape).toList())).append('\n');
            }
        }
        return csv.toString();
    }

    private byte[] toPdf(Report report) {
        try (PDDocument document = new PDDocument()) {
            PDType1Font bold = new PDType1Font(Standard14Fonts.FontName.HELVETICA_BOLD);
            PDType1Font regular = new PDType1Font(Standard14Fonts.FontName.HELVETICA);
            PdfCursor pdf = new PdfCursor(document);

            pdf.line(report.title(), bold, 18, 26);
            pdf.line("Generated " + Instant.now().truncatedTo(ChronoUnit.SECONDS), regular, 9, 24);
            for (Map.Entry<String, String> metric : report.summary().entrySet()) {
                pdf.line(metric.getKey() + ": " + metric.getValue(), regular, 12, 20);
            }
            for (ReportSection section : report.sections()) {
                pdf.skip(12);
                pdf.line(section.title(), bold, 13, 20);
                pdf.row(section.header(), bold);
                if (section.rows().isEmpty()) {
                    pdf.line("(none)", regular, 10, 16);
                }
                for (List<String> row : section.rows()) {
                    pdf.row(row, regular);
                }
            }
            pdf.close();

            ByteArrayOutputStream out = new ByteArrayOutputStream();
            document.save(out);
            return out.toByteArray();
        } catch (IOException e) {
            throw new RuntimeException("Failed to generate report PDF", e);
        }
    }

    /** Streams text top-down over as many A4 pages as needed; tables are simple equal-width columns. */
    private static final class PdfCursor {
        private static final float MARGIN = 50;
        private static final float ROW_HEIGHT = 16;
        private static final float TOP = PDRectangle.A4.getHeight() - MARGIN;
        private static final float TEXT_WIDTH = PDRectangle.A4.getWidth() - 2 * MARGIN;

        private final PDDocument document;
        private PDPageContentStream stream;
        private float y;

        PdfCursor(PDDocument document) throws IOException {
            this.document = document;
            newPage();
        }

        private void newPage() throws IOException {
            if (stream != null) {
                stream.close();
            }
            PDPage page = new PDPage(PDRectangle.A4);
            document.addPage(page);
            stream = new PDPageContentStream(document, page);
            y = TOP;
        }

        private void ensureSpace(float height) throws IOException {
            if (y - height < MARGIN) {
                newPage();
            }
        }

        void skip(float height) {
            y -= height;
        }

        void line(String text, PDType1Font font, float size, float advance) throws IOException {
            ensureSpace(advance);
            stream.beginText();
            stream.setFont(font, size);
            stream.newLineAtOffset(MARGIN, y);
            stream.showText(fit(text, font, size, TEXT_WIDTH));
            stream.endText();
            y -= advance;
        }

        void row(List<String> cells, PDType1Font font) throws IOException {
            ensureSpace(ROW_HEIGHT);
            float columnWidth = TEXT_WIDTH / cells.size();
            for (int i = 0; i < cells.size(); i++) {
                stream.beginText();
                stream.setFont(font, 10);
                stream.newLineAtOffset(MARGIN + i * columnWidth, y);
                stream.showText(fit(cells.get(i), font, 10, columnWidth - 6));
                stream.endText();
            }
            y -= ROW_HEIGHT;
        }

        void close() throws IOException {
            stream.close();
        }

        /** Standard PDF fonts only cover Latin-1, so other characters become '?'; long text is cut to fit its column. */
        private static String fit(String text, PDType1Font font, float size, float maxWidth) throws IOException {
            StringBuilder safe = new StringBuilder();
            (text == null ? "" : text).codePoints().forEach(cp ->
                    safe.append(cp >= 32 && cp <= 126 || cp >= 160 && cp <= 255 ? (char) cp : '?'));
            String result = safe.toString();
            if (font.getStringWidth(result) / 1000 * size <= maxWidth) {
                return result;
            }
            while (result.length() > 1 && font.getStringWidth(result + "...") / 1000 * size > maxWidth) {
                result = result.substring(0, result.length() - 1);
            }
            return result + "...";
        }
    }
}
