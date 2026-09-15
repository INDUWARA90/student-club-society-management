package com.club.backend.service;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.time.format.DateTimeFormatter;
import java.time.ZoneOffset;
import java.util.List;
import java.util.UUID;

import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDPage;
import org.apache.pdfbox.pdmodel.PDPageContentStream;
import org.apache.pdfbox.pdmodel.common.PDRectangle;
import org.apache.pdfbox.pdmodel.font.Standard14Fonts;
import org.apache.pdfbox.pdmodel.font.PDType1Font;
import org.springframework.stereotype.Service;

import com.club.backend.config.ApiException;
import com.club.backend.dto.CertificateResponse;
import com.club.backend.entity.Certificate;
import com.club.backend.entity.Club;
import com.club.backend.entity.User;
import com.club.backend.repository.AttendanceRepository;
import com.club.backend.repository.CertificateRepository;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class CertificateService {

    /** Sitewide default: attend at least this many events in a club to earn its certificate. */
    private static final long ATTENDANCE_THRESHOLD = 3;

    private final CertificateRepository certificateRepository;
    private final AttendanceRepository attendanceRepository;

    public void checkAndIssueCertificate(User user, Club club) {
        if (certificateRepository.findByUserIdAndClubId(user.getId(), club.getId()).isPresent()) {
            return;
        }

        long attended = attendanceRepository.countByUserIdAndEvent_Club_Id(user.getId(), club.getId());
        if (attended >= ATTENDANCE_THRESHOLD) {
            Certificate certificate = Certificate.builder().user(user).club(club).build();
            certificateRepository.save(certificate);
        }
    }

    public List<CertificateResponse> listMyCertificates(UUID userId) {
        return certificateRepository.findByUserId(userId).stream().map(CertificateResponse::from).toList();
    }

    public byte[] generateCertificatePdf(UUID certificateId, UUID requestingUserId) {
        Certificate certificate = certificateRepository.findById(certificateId)
                .orElseThrow(() -> ApiException.notFound("Certificate not found"));

        if (!certificate.getUser().getId().equals(requestingUserId)) {
            throw ApiException.forbidden("You can only download your own certificates");
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

                content.beginText();
                content.setFont(bodyFont, 14);
                content.newLineAtOffset(80, 640);
                content.showText("This certifies that " + certificate.getUser().getName());
                content.newLineAtOffset(0, -24);
                content.showText("has actively participated in " + certificate.getClub().getName());
                content.newLineAtOffset(0, -24);
                String issuedDate = certificate.getIssuedAt().atZone(ZoneOffset.UTC)
                        .format(DateTimeFormatter.ofPattern("MMMM d, yyyy"));
                content.showText("Issued on " + issuedDate);
                content.endText();
            }

            ByteArrayOutputStream out = new ByteArrayOutputStream();
            document.save(out);
            return out.toByteArray();
        } catch (IOException e) {
            throw new RuntimeException("Failed to generate certificate PDF", e);
        }
    }
}
