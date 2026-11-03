package com.club.backend.service;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Set;
import java.util.UUID;

import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDPage;
import org.apache.pdfbox.pdmodel.PDPageContentStream;
import org.apache.pdfbox.pdmodel.common.PDRectangle;
import org.apache.pdfbox.pdmodel.font.PDType1Font;
import org.apache.pdfbox.pdmodel.font.Standard14Fonts;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.club.backend.config.ApiException;
import com.club.backend.dto.BulkCertificateIssueResponse;
import com.club.backend.dto.CertificateResponse;
import com.club.backend.dto.CertificateVerificationResponse;
import com.club.backend.entity.Attendance;
import com.club.backend.entity.Certificate;
import com.club.backend.entity.Club;
import com.club.backend.entity.Event;
import com.club.backend.entity.Membership;
import com.club.backend.entity.MembershipPosition;
import com.club.backend.entity.MembershipStatus;
import com.club.backend.entity.User;
import com.club.backend.repository.AttendanceRepository;
import com.club.backend.repository.CertificateRepository;
import com.club.backend.repository.EventRepository;
import com.club.backend.repository.MembershipRepository;
import com.club.backend.security.UserPrincipal;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
@Transactional
public class CertificateService {

    private static final Set<MembershipPosition> BULK_ISSUE_POSITIONS = Set.of(
            MembershipPosition.PRESIDENT, MembershipPosition.VP,
            MembershipPosition.SECRETARY, MembershipPosition.TREASURER);

    private final CertificateRepository certificateRepository;
    private final AttendanceRepository attendanceRepository;
    private final EventRepository eventRepository;
    private final MembershipRepository membershipRepository;
    private final NotificationService notificationService;

    @Value("${app.frontend-url:}")
    private String frontendUrl;

    public enum IssuanceOutcome {
        ISSUED, ALREADY_ISSUED, NOT_YET_ELIGIBLE
    }

    record ClubTheme(
            float pr, float pg, float pb,
            float sr, float sg, float sb,
            String ribbonTitle) {}

    static ClubTheme themeForClub(Club club) {
        String cat = (club != null && club.getCategory() != null) ? club.getCategory().toLowerCase() : "";
        if (cat.contains("tech") || cat.contains("coding") || cat.contains("robot") || cat.contains("stem") || cat.contains("comput")) {
            return new ClubTheme(0.10f, 0.22f, 0.48f, 0.85f, 0.65f, 0.12f, "TECHNOLOGY & INNOVATION DIVISION");
        } else if (cat.contains("art") || cat.contains("cultur") || cat.contains("music") || cat.contains("drama") || cat.contains("design")) {
            return new ClubTheme(0.52f, 0.10f, 0.22f, 0.82f, 0.62f, 0.15f, "CREATIVE ARTS & CULTURAL DIVISION");
        } else if (cat.contains("sport") || cat.contains("athlet") || cat.contains("fitness") || cat.contains("recreat")) {
            return new ClubTheme(0.06f, 0.38f, 0.24f, 0.85f, 0.68f, 0.14f, "ATHLETICS & RECREATION DIVISION");
        } else if (cat.contains("acad") || cat.contains("scienc") || cat.contains("debat") || cat.contains("business") || cat.contains("financ")) {
            return new ClubTheme(0.08f, 0.18f, 0.35f, 0.80f, 0.60f, 0.12f, "ACADEMIC SOCIETIES COUNCIL");
        } else if (cat.contains("commun") || cat.contains("volunt") || cat.contains("social") || cat.contains("environ")) {
            return new ClubTheme(0.06f, 0.35f, 0.38f, 0.84f, 0.65f, 0.15f, "COMMUNITY & SOCIAL OUTREACH");
        } else {
            return new ClubTheme(0.12f, 0.18f, 0.32f, 0.80f, 0.62f, 0.14f, "STUDENT CLUBS & SOCIETIES ASSOCIATION");
        }
    }

    /** Awards one certificate for this event to every person whose attendance is recorded. */
    public IssuanceOutcome checkAndIssueCertificate(User user, Event event) {
        if (certificateRepository.findByUserIdAndEventId(user.getId(), event.getId()).isPresent()) {
            return IssuanceOutcome.ALREADY_ISSUED;
        }
        Certificate certificate = Certificate.builder()
                .user(user)
                .club(event.getClub())
                .event(event)
                .verificationCode(UUID.randomUUID().toString())
                .build();
        certificateRepository.save(certificate);
        notificationService.notify(user,
                "You earned a certificate for " + event.getTitle() + "! Download it from your certificates page.");
        return IssuanceOutcome.ISSUED;
    }

    /** Officer-triggered sweep: run the same eligibility check for every attendee of one event. */
    public BulkCertificateIssueResponse bulkIssueForEvent(UUID clubId, UUID eventId, UserPrincipal principal) {
        Membership membership = membershipRepository.findByUserIdAndClubId(principal.getId(), clubId)
                .orElseThrow(() -> ApiException.forbidden("Only club officers can issue certificates"));

        if (membership.getStatus() != MembershipStatus.APPROVED
                || !BULK_ISSUE_POSITIONS.contains(membership.getPosition())) {
            throw ApiException.forbidden("Only club officers can issue certificates");
        }

        Event event = eventRepository.findById(eventId)
                .orElseThrow(() -> ApiException.notFound("Event not found"));
        if (!event.getClub().getId().equals(clubId)) {
            throw ApiException.notFound("Event not found");
        }
        if (event.isCancelled()) {
            throw ApiException.badRequest("Certificates can't be issued for a cancelled event");
        }
        if (event.getEventDate().isAfter(java.time.Instant.now())) {
            throw ApiException.badRequest("Certificates can be issued once the event has started");
        }

        List<Attendance> attendances = attendanceRepository.findByEventId(eventId);
        int issued = 0;
        int alreadyIssued = 0;
        int notYetEligible = 0;

        for (Attendance attendance : attendances) {
            IssuanceOutcome outcome = checkAndIssueCertificate(attendance.getUser(), event);
            switch (outcome) {
                case ISSUED -> issued++;
                case ALREADY_ISSUED -> alreadyIssued++;
                case NOT_YET_ELIGIBLE -> notYetEligible++;
            }
        }

        return new BulkCertificateIssueResponse(attendances.size(), issued, alreadyIssued, notYetEligible);
    }

    public List<CertificateResponse> listMyCertificates(UUID userId) {
        return certificateRepository.findByUserId(userId).stream().map(CertificateResponse::from).toList();
    }

    /** Public check that a code on a certificate is genuine; reveals only the holder's name, club and date. */
    @Transactional(readOnly = true)
    public CertificateVerificationResponse verify(String code) {
        return certificateRepository.findByVerificationCode(code == null ? "" : code.trim())
                .map(c -> new CertificateVerificationResponse(
                        true,
                        c.getUser().getName(),
                        c.getClub().getName(),
                        c.getClub().getCategory(),
                        c.getClub().getLogoB64(),
                        c.getIssuedAt()))
                .orElse(new CertificateVerificationResponse(false, null, null, null));
    }

    public byte[] generateCertificatePdf(UUID certificateId, UUID requestingUserId) {
        Certificate certificate = certificateRepository.findById(certificateId)
                .orElseThrow(() -> ApiException.notFound("Certificate not found"));

        if (!certificate.getUser().getId().equals(requestingUserId)) {
            throw ApiException.forbidden("You can only download your own certificates");
        }

        // Certificates issued before verification codes existed get one the first time they're downloaded.
        if (certificate.getVerificationCode() == null) {
            certificate.setVerificationCode(UUID.randomUUID().toString());
            certificateRepository.save(certificate);
        }

        try (PDDocument document = new PDDocument()) {
            float pageWidth = PDRectangle.A4.getHeight(); // 841.89f (Landscape)
            float pageHeight = PDRectangle.A4.getWidth(); // 595.28f
            PDPage page = new PDPage(new PDRectangle(pageWidth, pageHeight));
            document.addPage(page);

            ClubTheme theme = themeForClub(certificate.getClub());

            try (PDPageContentStream content = new PDPageContentStream(document, page)) {
                PDType1Font titleFont = new PDType1Font(Standard14Fonts.FontName.HELVETICA_BOLD);
                PDType1Font bodyFont = new PDType1Font(Standard14Fonts.FontName.HELVETICA);
                PDType1Font italicFont = new PDType1Font(Standard14Fonts.FontName.HELVETICA_OBLIQUE);
                PDType1Font serifBold = new PDType1Font(Standard14Fonts.FontName.TIMES_BOLD);
                PDType1Font signatureFont = new PDType1Font(Standard14Fonts.FontName.TIMES_ITALIC);

                // Outer border (Club Theme Primary)
                content.setStrokingColor(theme.pr(), theme.pg(), theme.pb());
                content.setLineWidth(3.0f);
                content.addRect(24, 24, pageWidth - 48, pageHeight - 48);
                content.stroke();

                // Inner border (Theme Secondary Gold)
                content.setStrokingColor(theme.sr(), theme.sg(), theme.sb());
                content.setLineWidth(1.0f);
                content.addRect(30, 30, pageWidth - 60, pageHeight - 60);
                content.stroke();

                // Corner flourishes
                content.setNonStrokingColor(theme.sr(), theme.sg(), theme.sb());
                content.addRect(30, 30, 6, 6);
                content.addRect(pageWidth - 36, 30, 6, 6);
                content.addRect(30, pageHeight - 36, 6, 6);
                content.addRect(pageWidth - 36, pageHeight - 36, 6, 6);
                content.fill();

                // 1. Top Ribbon Division Header
                drawCenteredText(content, titleFont, 8.5f, "[ " + theme.ribbonTitle() + " ]", 528, pageWidth, theme.sr(), theme.sg(), theme.sb());

                // 2. University / Association Title
                drawCenteredText(content, titleFont, 12f, "STUDENT CLUBS & SOCIETIES ASSOCIATION", 504, pageWidth, theme.pr(), theme.pg(), theme.pb());

                // 3. Main Certificate Heading
                drawCenteredText(content, titleFont, 24f, "CERTIFICATE OF MERIT & PARTICIPATION", 460, pageWidth, theme.pr(), theme.pg(), theme.pb());

                // Decorative horizontal divider
                content.setStrokingColor(theme.sr(), theme.sg(), theme.sb());
                content.setLineWidth(1.2f);
                content.moveTo(240, 448);
                content.lineTo(pageWidth - 240, 448);
                content.stroke();

                // 4. Conferred subtitle
                drawCenteredText(content, italicFont, 11f, "This certificate is proudly conferred upon", 422, pageWidth, 0.42f, 0.42f, 0.45f);

                // 5. Recipient Name
                String recipientName = certificate.getUser() != null ? certificate.getUser().getName() : "Student";
                String safeRecipient = pdfSafe(recipientName);
                float nameFontSize = 26f;
                float nameWidth = serifBold.getStringWidth(safeRecipient) / 1000f * nameFontSize;
                while (nameWidth > (pageWidth - 160) && nameFontSize > 16f) {
                    nameFontSize -= 1f;
                    nameWidth = serifBold.getStringWidth(safeRecipient) / 1000f * nameFontSize;
                }
                drawCenteredText(content, serifBold, nameFontSize, safeRecipient, 382, pageWidth, theme.pr(), theme.pg(), theme.pb());

                // Underline recipient name
                float nameStartX = Math.max(80f, (pageWidth - nameWidth) / 2f);
                content.setStrokingColor(theme.sr(), theme.sg(), theme.sb());
                content.setLineWidth(1.2f);
                content.moveTo(nameStartX - 15, 372);
                content.lineTo(nameStartX + nameWidth + 15, 372);
                content.stroke();

                // 6. Event attendance citation
                drawCenteredText(content, bodyFont, 11f, "for verified attendance and active participation in", 340, pageWidth, 0.35f, 0.35f, 0.38f);

                // 7. Event title (legacy certificates fall back to the club name)
                String clubName = certificate.getClub() != null ? certificate.getClub().getName() : "Student Society";
                String eventTitle = certificate.getEvent() != null ? certificate.getEvent().getTitle() : clubName;
                drawFittedCenteredText(content, titleFont, 18f, 13f, pageWidth - 140, eventTitle, 310, pageWidth, theme.pr(), theme.pg(), theme.pb());

                // 8. Organizing club
                String clubCategory = (certificate.getClub() != null && certificate.getClub().getCategory() != null)
                        ? certificate.getClub().getCategory() : "General";
                drawCenteredText(content, italicFont, 10f, "Organized by " + clubName + "  -  " + clubCategory, 286, pageWidth, 0.45f, 0.45f, 0.48f);

                // 9. Issued Date
                String issuedDate = certificate.getIssuedAt() != null
                        ? certificate.getIssuedAt().atZone(ZoneOffset.UTC).format(DateTimeFormatter.ofPattern("MMMM d, yyyy"))
                        : "Recent";
                drawCenteredText(content, bodyFont, 9.5f, "Officially conferred on " + issuedDate, 262, pageWidth, 0.45f, 0.45f, 0.48f);

                // 10. Dual Signatures & Gold Center Seal
                // Left: Club administrator (clearly marked demonstration signature).
                content.setStrokingColor(0.55f, 0.55f, 0.60f);
                content.setLineWidth(1.0f);
                content.moveTo(90f, 160f);
                content.lineTo(260f, 160f);
                content.stroke();

                content.beginText();
                content.setFont(signatureFont, 16f);
                content.setNonStrokingColor(theme.pr(), theme.pg(), theme.pb());
                content.newLineAtOffset(108f, 169f);
                content.showText("Club Admin (Demo)");
                content.endText();

                content.beginText();
                content.setFont(titleFont, 9f);
                content.setNonStrokingColor(theme.pr(), theme.pg(), theme.pb());
                content.newLineAtOffset(90f, 146f);
                content.showText("Club Administrator");
                content.endText();

                content.beginText();
                content.setFont(italicFont, 8f);
                content.setNonStrokingColor(0.40f, 0.40f, 0.45f);
                content.newLineAtOffset(90f, 134f);
                String safeClubShort = pdfSafe(clubName.length() > 28 ? clubName.substring(0, 28) + "..." : clubName);
                content.showText(safeClubShort);
                content.endText();

                // Right: Faculty Advisor
                content.moveTo(pageWidth - 260f, 160f);
                content.lineTo(pageWidth - 90f, 160f);
                content.stroke();

                content.beginText();
                content.setFont(signatureFont, 16f);
                content.setNonStrokingColor(theme.pr(), theme.pg(), theme.pb());
                content.newLineAtOffset(pageWidth - 244f, 169f);
                content.showText("Faculty Advisor (Demo)");
                content.endText();

                content.beginText();
                content.setFont(titleFont, 9f);
                content.setNonStrokingColor(theme.pr(), theme.pg(), theme.pb());
                content.newLineAtOffset(pageWidth - 260f, 146f);
                content.showText("Faculty Advisor");
                content.endText();

                content.beginText();
                content.setFont(italicFont, 8f);
                content.setNonStrokingColor(0.40f, 0.40f, 0.45f);
                content.newLineAtOffset(pageWidth - 260f, 134f);
                content.showText("Office of Student Affairs");
                content.endText();

                // Center Seal
                float sealW = 140f;
                float sealH = 44f;
                float sealX = (pageWidth - sealW) / 2f;
                float sealY = 130f;

                content.setNonStrokingColor(0.98f, 0.96f, 0.90f);
                content.addRect(sealX, sealY, sealW, sealH);
                content.fill();

                content.setStrokingColor(theme.sr(), theme.sg(), theme.sb());
                content.setLineWidth(1.4f);
                content.addRect(sealX, sealY, sealW, sealH);
                content.stroke();

                content.setLineWidth(0.6f);
                content.addRect(sealX + 2.5f, sealY + 2.5f, sealW - 5f, sealH - 5f);
                content.stroke();

                drawCenteredText(content, titleFont, 7.5f, "* OFFICIAL SEAL *", sealY + 26f, pageWidth, theme.sr(), theme.sg(), theme.sb());
                drawCenteredText(content, titleFont, 7f, "VERIFIED CREDENTIAL", sealY + 12f, pageWidth, theme.pr(), theme.pg(), theme.pb());

                // 11. Security Footer
                content.setStrokingColor(0.82f, 0.82f, 0.85f);
                content.setLineWidth(0.75f);
                content.moveTo(50f, 65f);
                content.lineTo(pageWidth - 50f, 65f);
                content.stroke();

                drawCenteredText(content, bodyFont, 8.5f, "Verification Code: " + certificate.getVerificationCode(), 48f, pageWidth, 0.35f, 0.35f, 0.40f);
                if (frontendUrl != null && !frontendUrl.isBlank()) {
                    drawCenteredText(content, italicFont, 7.5f, "Verify authenticity at: " + frontendUrl + "/verify-certificate/" + certificate.getVerificationCode(), 36f, pageWidth, theme.pr(), theme.pg(), theme.pb());
                }
            }

            ByteArrayOutputStream out = new ByteArrayOutputStream();
            document.save(out);
            return out.toByteArray();
        } catch (IOException e) {
            throw new RuntimeException("Failed to generate certificate PDF", e);
        }
    }

    private static void drawCenteredText(PDPageContentStream content, PDType1Font font, float fontSize,
                                        String text, float y, float pageWidth,
                                        float r, float g, float b) throws IOException {
        String safe = pdfSafe(text);
        float textWidth = font.getStringWidth(safe) / 1000f * fontSize;
        float x = Math.max(30f, (pageWidth - textWidth) / 2f);
        content.setNonStrokingColor(r, g, b);
        content.beginText();
        content.setFont(font, fontSize);
        content.newLineAtOffset(x, y);
        content.showText(safe);
        content.endText();
    }

    private static void drawFittedCenteredText(PDPageContentStream content, PDType1Font font, float maxFontSize,
                                              float minFontSize, float maxWidth,
                                              String text, float y, float pageWidth,
                                              float r, float g, float b) throws IOException {
        String safe = pdfSafe(text);
        float fontSize = maxFontSize;
        while (fontSize > minFontSize && (font.getStringWidth(safe) / 1000f * fontSize) > maxWidth) {
            fontSize -= 0.5f;
        }
        drawCenteredText(content, font, fontSize, safe, y, pageWidth, r, g, b);
    }

    /** The built-in PDF fonts only cover Latin-1; anything else (or a control character) would abort rendering. */
    private static String pdfSafe(String text) {
        if (text == null) {
            return "";
        }
        StringBuilder safe = new StringBuilder(text.length());
        for (char c : text.toCharArray()) {
            safe.append(c >= 32 && c <= 255 && c != 127 ? c : '?');
        }
        return safe.toString();
    }
}
