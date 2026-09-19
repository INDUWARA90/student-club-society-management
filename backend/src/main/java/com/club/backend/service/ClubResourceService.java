package com.club.backend.service;

import java.util.Base64;
import java.util.List;
import java.util.Set;
import java.util.UUID;

import org.springframework.stereotype.Service;

import com.club.backend.config.ApiException;
import com.club.backend.dto.ClubResourceResponse;
import com.club.backend.dto.CreateClubResourceRequest;
import com.club.backend.entity.Club;
import com.club.backend.entity.ClubResource;
import com.club.backend.entity.Membership;
import com.club.backend.entity.MembershipPosition;
import com.club.backend.entity.MembershipStatus;
import com.club.backend.entity.User;
import com.club.backend.repository.ClubRepository;
import com.club.backend.repository.ClubResourceRepository;
import com.club.backend.repository.MembershipRepository;
import com.club.backend.repository.UserRepository;
import com.club.backend.security.UserPrincipal;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class ClubResourceService {

    private static final Set<MembershipPosition> OFFICER_POSITIONS = Set.of(
            MembershipPosition.PRESIDENT, MembershipPosition.VP,
            MembershipPosition.SECRETARY, MembershipPosition.TREASURER);

    private final ClubResourceRepository resourceRepository;
    private final ClubRepository clubRepository;
    private final MembershipRepository membershipRepository;
    private final UserRepository userRepository;

    public ClubResourceResponse uploadResource(UUID clubId, CreateClubResourceRequest request, UserPrincipal principal) {
        if (request.title() == null || request.title().trim().isEmpty()) {
            throw ApiException.badRequest("Resource title is required");
        }
        if (request.fileB64() != null && request.fileB64().length() > InputLimits.MAX_FILE_CHARS) {
            throw com.club.backend.config.ApiException.badRequest("The file is too large — the limit is about 10 MB");
        }
        if (request.fileB64() == null || request.fileB64().isEmpty()) {
            throw ApiException.badRequest("A file is required");
        }

        Club club = clubRepository.findById(clubId)
                .orElseThrow(() -> ApiException.notFound("Club not found"));

        User uploadedBy = userRepository.findById(principal.getId())
                .orElseThrow(() -> ApiException.notFound("User not found"));

        Membership membership = membershipRepository.findByUserIdAndClubId(uploadedBy.getId(), clubId)
                .orElseThrow(() -> ApiException.forbidden("Only club officers can upload resources"));

        if (membership.getStatus() != MembershipStatus.APPROVED || !OFFICER_POSITIONS.contains(membership.getPosition())) {
            throw ApiException.forbidden("Only club officers can upload resources");
        }

        ClubResource resource = ClubResource.builder()
                .club(club)
                .uploadedBy(uploadedBy)
                .title(request.title().trim())
                .fileName(request.fileName())
                .contentType(request.contentType())
                .fileB64(request.fileB64())
                .build();
        resource = resourceRepository.save(resource);

        return ClubResourceResponse.from(resource);
    }

    public List<ClubResourceResponse> listResources(UUID clubId) {
        return resourceRepository.findByClubIdOrderByCreatedAtDesc(clubId)
                .stream().map(ClubResourceResponse::from).toList();
    }

    public ClubResource getResourceForDownload(UUID clubId, UUID resourceId) {
        ClubResource resource = resourceRepository.findById(resourceId)
                .orElseThrow(() -> ApiException.notFound("Resource not found"));

        if (!resource.getClub().getId().equals(clubId)) {
            throw ApiException.notFound("Resource not found");
        }

        return resource;
    }

    public byte[] decodeFileBytes(ClubResource resource) {
        String data = resource.getFileB64();
        int commaIndex = data.indexOf(',');
        String base64Payload = commaIndex >= 0 ? data.substring(commaIndex + 1) : data;
        return Base64.getDecoder().decode(base64Payload);
    }

    /** The uploader or the Club Admin (President) can remove a resource. */
    public void deleteResource(UUID clubId, UUID resourceId, UserPrincipal principal) {
        ClubResource resource = resourceRepository.findById(resourceId)
                .orElseThrow(() -> ApiException.notFound("Resource not found"));

        if (!resource.getClub().getId().equals(clubId)) {
            throw ApiException.notFound("Resource not found");
        }

        boolean isUploader = resource.getUploadedBy().getId().equals(principal.getId());
        boolean isPresident = membershipRepository.findByUserIdAndClubId(principal.getId(), clubId)
                .filter(m -> m.getStatus() == MembershipStatus.APPROVED)
                .map(m -> m.getPosition() == MembershipPosition.PRESIDENT)
                .orElse(false);

        if (!isUploader && !isPresident) {
            throw ApiException.forbidden("Only the uploader or the Club Admin can delete this resource");
        }

        resourceRepository.delete(resource);
    }
}
