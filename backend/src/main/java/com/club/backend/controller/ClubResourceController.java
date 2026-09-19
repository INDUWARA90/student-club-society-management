package com.club.backend.controller;

import java.util.List;
import java.util.UUID;

import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.club.backend.dto.ClubResourceResponse;
import com.club.backend.dto.CreateClubResourceRequest;
import com.club.backend.entity.ClubResource;
import com.club.backend.security.UserPrincipal;
import com.club.backend.service.ClubResourceService;

import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/api/clubs/{clubId}/resources")
@RequiredArgsConstructor
public class ClubResourceController {

    private final ClubResourceService resourceService;

    @PostMapping
    public ResponseEntity<ClubResourceResponse> uploadResource(@PathVariable UUID clubId,
            @RequestBody CreateClubResourceRequest request, @AuthenticationPrincipal UserPrincipal principal) {
        return ResponseEntity.ok(resourceService.uploadResource(clubId, request, principal));
    }

    @GetMapping
    public ResponseEntity<List<ClubResourceResponse>> listResources(@PathVariable UUID clubId) {
        return ResponseEntity.ok(resourceService.listResources(clubId));
    }

    @GetMapping("/{resourceId}/download")
    public ResponseEntity<byte[]> download(@PathVariable UUID clubId, @PathVariable UUID resourceId) {
        ClubResource resource = resourceService.getResourceForDownload(clubId, resourceId);
        byte[] bytes = resourceService.decodeFileBytes(resource);
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(resource.getContentType()))
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + resource.getFileName() + "\"")
                .body(bytes);
    }

    @DeleteMapping("/{resourceId}")
    public ResponseEntity<Void> deleteResource(@PathVariable UUID clubId, @PathVariable UUID resourceId,
            @AuthenticationPrincipal UserPrincipal principal) {
        resourceService.deleteResource(clubId, resourceId, principal);
        return ResponseEntity.ok().build();
    }
}
