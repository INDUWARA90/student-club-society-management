package com.club.backend.service;

import java.util.List;
import java.util.UUID;

import org.springframework.stereotype.Service;

import com.club.backend.config.ApiException;
import com.club.backend.dto.ClubResponse;
import com.club.backend.dto.CreateClubRequest;
import com.club.backend.entity.Club;
import com.club.backend.entity.ClubStatus;
import com.club.backend.entity.JoinPolicy;
import com.club.backend.entity.Membership;
import com.club.backend.entity.MembershipPosition;
import com.club.backend.entity.MembershipStatus;
import com.club.backend.entity.Role;
import com.club.backend.entity.User;
import com.club.backend.repository.ClubRepository;
import com.club.backend.repository.MembershipRepository;
import com.club.backend.repository.UserRepository;
import com.club.backend.security.UserPrincipal;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class ClubService {

    private final ClubRepository clubRepository;
    private final MembershipRepository membershipRepository;
    private final UserRepository userRepository;
    private final AuditLogService auditLogService;

    public ClubResponse createClub(CreateClubRequest request, UserPrincipal principal) {
        if (isBlank(request.name())) {
            throw ApiException.badRequest("Club name is required");
        }
        if (isBlank(request.category())) {
            throw ApiException.badRequest("Club category is required");
        }

        User creator = userRepository.findById(principal.getId())
                .orElseThrow(() -> ApiException.notFound("User not found"));

        boolean isSuperAdmin = creator.getRole() == Role.SUPER_ADMIN;

        Club club = Club.builder()
                .name(request.name().trim())
                .description(request.description())
                .category(request.category().trim())
                .status(isSuperAdmin ? ClubStatus.APPROVED : ClubStatus.PENDING)
                .joinPolicy(request.joinPolicy() != null ? request.joinPolicy() : JoinPolicy.OPEN)
                .logoB64(request.logoB64())
                .createdBy(creator)
                .build();
        club = clubRepository.save(club);

        // Whoever creates the club starts out as its President (Club Admin), once approved.
        Membership presidentMembership = Membership.builder()
                .user(creator)
                .club(club)
                .position(MembershipPosition.PRESIDENT)
                .status(MembershipStatus.APPROVED)
                .build();
        membershipRepository.save(presidentMembership);

        return ClubResponse.from(club);
    }

    public ClubResponse updateClub(UUID clubId, CreateClubRequest request, UserPrincipal principal) {
        if (isBlank(request.name())) {
            throw ApiException.badRequest("Club name is required");
        }
        if (isBlank(request.category())) {
            throw ApiException.badRequest("Club category is required");
        }

        Club club = clubRepository.findById(clubId)
                .orElseThrow(() -> ApiException.notFound("Club not found"));

        Membership membership = membershipRepository.findByUserIdAndClubId(principal.getId(), clubId)
                .orElseThrow(() -> ApiException.forbidden("Only the Club Admin can edit the club"));

        if (membership.getStatus() != MembershipStatus.APPROVED || membership.getPosition() != MembershipPosition.PRESIDENT) {
            throw ApiException.forbidden("Only the Club Admin can edit the club");
        }

        club.setName(request.name().trim());
        club.setDescription(request.description());
        club.setCategory(request.category().trim());
        if (request.joinPolicy() != null) {
            club.setJoinPolicy(request.joinPolicy());
        }
        if (request.logoB64() != null) {
            club.setLogoB64(request.logoB64());
        }
        club = clubRepository.save(club);

        return ClubResponse.from(club);
    }

    public ClubResponse approveClub(UUID clubId, boolean approve, UserPrincipal principal) {
        Club club = clubRepository.findById(clubId)
                .orElseThrow(() -> ApiException.notFound("Club not found"));

        if (club.getStatus() != ClubStatus.PENDING) {
            throw ApiException.badRequest("Only pending clubs can be approved or rejected");
        }

        club.setStatus(approve ? ClubStatus.APPROVED : ClubStatus.REJECTED);
        club = clubRepository.save(club);

        User actor = userRepository.findById(principal.getId())
                .orElseThrow(() -> ApiException.notFound("User not found"));
        auditLogService.log(actor, approve ? "APPROVE_CLUB" : "REJECT_CLUB", "CLUB", club.getId(), club.getName());

        return ClubResponse.from(club);
    }

    public List<ClubResponse> listApprovedClubs(String category) {
        List<Club> clubs = isBlank(category)
                ? clubRepository.findByStatus(ClubStatus.APPROVED)
                : clubRepository.findByCategory(category.trim()).stream()
                        .filter(c -> c.getStatus() == ClubStatus.APPROVED)
                        .toList();
        return clubs.stream().map(ClubResponse::from).toList();
    }

    public List<ClubResponse> listPendingClubs() {
        return clubRepository.findByStatus(ClubStatus.PENDING).stream().map(ClubResponse::from).toList();
    }

    /** University-wide read-only oversight (Super Admin, Faculty Advisor) — every club regardless of status. */
    public List<ClubResponse> listAllClubs() {
        return clubRepository.findAll().stream().map(ClubResponse::from).toList();
    }

    public ClubResponse getClub(UUID clubId) {
        Club club = clubRepository.findById(clubId)
                .orElseThrow(() -> ApiException.notFound("Club not found"));
        return ClubResponse.from(club);
    }

    private boolean isBlank(String value) {
        return value == null || value.trim().isEmpty();
    }
}
