package com.club.backend.controller;

import java.util.List;
import java.util.UUID;

import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.club.backend.dto.CertificateResponse;
import com.club.backend.security.UserPrincipal;
import com.club.backend.service.CertificateService;

import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/api/certificates")
@RequiredArgsConstructor
public class CertificateController {

    private final CertificateService certificateService;

    @GetMapping("/me")
    public ResponseEntity<List<CertificateResponse>> myCertificates(@AuthenticationPrincipal UserPrincipal principal) {
        return ResponseEntity.ok(certificateService.listMyCertificates(principal.getId()));
    }

    @GetMapping("/{certificateId}/download")
    public ResponseEntity<byte[]> download(@PathVariable UUID certificateId, @AuthenticationPrincipal UserPrincipal principal) {
        byte[] pdf = certificateService.generateCertificatePdf(certificateId, principal.getId());
        return ResponseEntity.ok()
                .contentType(MediaType.APPLICATION_PDF)
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"certificate.pdf\"")
                .body(pdf);
    }
}
