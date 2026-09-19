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

    /** Used for clubs that haven't set their own threshold: attend at least this many events to earn the certificate. */
    static final int DEFAULT_ATTENDANCE_THRESHOLD = 3;

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

    /** The club's own threshold (set by its President), falling back to the sitewide default. */
    static int thresholdFor(Club club) {
        Integer configured = club.getCertificateThreshold();
        return configured != null && configured >= 1 ? configured : DEFAULT_ATTENDANCE_THRESHOLD;
    }

    /** Issues the club's certificate once an approved member has attended enough of its events. */
    public IssuanceOutcome checkAndIssueCertificate(User user, Club club) {
        if (certificateRepository.findByUserIdAndClubId(user.getId(), club.getId()).isPresent()) {
            return IssuanceOutcome.ALREADY_ISSUED;
        }

        boolean isMember = membershipRepository.findByUserIdAndClubId(user.getId(), club.getId())
                .filter(m -> m.getStatus() == MembershipStatus.APPROVED)
                .isPresent();
        if (!isMember) {
            return IssuanceOutcome.NOT_YET_ELIGIBLE;
        }

        long attended = attendanceRepository.countByUserIdAndEvent_Club_Id(user.getId(), club.getId());
        if (attended >= thresholdFor(club)) {
            Certificate certificate = Certificate.builder()
                    .user(user)
                    .club(club)
                    .verificationCode(UUID.randomUUID().toString())
                    .build();
            certificateRepository.save(certificate);
            notificationService.notify(user,
                    "You earned a certificate from " + club.getName() + "! Download it from your certificates page.");
            return IssuanceOutcome.ISSUED;
        }

        return IssuanceOutcome.NOT_YET_ELIGIBLE;
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

        List<Attendance> attendances = attendanceRepository.findByEventId(eventId);
        int issued = 0;
        int alreadyIssued = 0;
        int notYetEligible = 0;

        for (Attendance attendance : attendances) {
            IssuanceOutcome outcome = checkAndIssueCertificate(attendance.getUser(), event.getClub());
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
                        true, c.getUser().getName(), c.getClub().getName(), c.getIssuedAt()))
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
            PDPage page = new PDPage(PDRectangle.A4);
            document.addPage(page);

            try (PDPageContentStream content = new PDPageContentStream(document, page)) {
                PDType1Font titleFont = new PDType1Font(Standard14Fonts.FontName.HELVETICA_BOLD);
                PDType1Font bodyFont = new PDType1Font(Standard14Fonts.FontName.HELVETICA);

                content.beginText();
                content.setFont(titleFont, 24);
                content.newLineAtOffset(80, 700);
                content.showText("Certificate of Participation");
                content.endText();

                String issuedDate = certificate.getIssuedAt().atZone(ZoneOffset.UTC)
                        .format(DateTimeFormatter.ofPattern("MMMM d, yyyy"));
                content.beginText();
                content.setFont(bodyFont, 14);
                content.newLineAtOffset(80, 640);
                content.showText("This certifies that " + pdfSafe(certificate.getUser().getName()));
                content.newLineAtOffset(0, -24);
                content.showText("has actively participated in " + pdfSafe(certificate.getClub().getName()));
                content.newLineAtOffset(0, -24);
                content.showText("Issued on " + issuedDate);
                content.endText();

                content.beginText();
                content.setFont(bodyFont, 10);
                content.newLineAtOffset(80, 120);
                content.showText("Verification code: " + certificate.getVerificationCode());
                if (frontendUrl != null && !frontendUrl.isBlank()) {
                    content.newLineAtOffset(0, -14);
                    content.showText("Verify at: " + frontendUrl + "/verify-certificate/" + certificate.getVerificationCode());
                }
                content.endText();
            }

            ByteArrayOutputStream out = new ByteArrayOutputStream();
            document.save(out);
            return out.toByteArray();
        } catch (IOException e) {
            throw new RuntimeException("Failed to generate certificate PDF", e);
        }
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
