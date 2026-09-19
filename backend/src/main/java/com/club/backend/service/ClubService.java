package com.club.backend.service;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

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
import com.club.backend.repository.EventRepository;
import com.club.backend.repository.MembershipRepository;
import com.club.backend.repository.UserRepository;
import com.club.backend.security.UserPrincipal;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
@Transactional
public class ClubService {

    private static final BigDecimal MAX_MEMBERSHIP_FEE = new BigDecimal("100000");
    private static final int DEFAULT_CERTIFICATE_THRESHOLD = 3;
    private static final int MAX_CERTIFICATE_THRESHOLD = 100;

    private final ClubRepository clubRepository;
    private final MembershipRepository membershipRepository;
    private final UserRepository userRepository;
    private final EventRepository eventRepository;
    private final AuditLogService auditLogService;
    private final NotificationService notificationService;
    private final EventService eventService;
    private final EmailVerificationPolicy emailVerificationPolicy;

    public ClubResponse createClub(CreateClubRequest request, UserPrincipal principal) {
        if (isBlank(request.name())) {
            throw ApiException.badRequest("Club name is required");
        }
        if (isBlank(request.category())) {
            throw ApiException.badRequest("Club category is required");
        }
        BigDecimal fee = validatedFee(request.membershipFee(), BigDecimal.ZERO);
        Integer threshold = validatedThreshold(request.certificateThreshold(), DEFAULT_CERTIFICATE_THRESHOLD);
        InputLimits.requireImageSize(request.logoB64(), "club logo");

        User creator = userRepository.findById(principal.getId())
                .orElseThrow(() -> ApiException.notFound("User not found"));
        emailVerificationPolicy.requireVerified(creator);

        if (clubRepository.existsByNameIgnoreCase(request.name().trim())) {
            throw ApiException.conflict("A club with this name already exists");
        }

        boolean isSuperAdmin = creator.getRole() == Role.SUPER_ADMIN;

        Club club = Club.builder()
                .name(request.name().trim())
                .description(request.description())
                .category(request.category().trim())
                .status(isSuperAdmin ? ClubStatus.APPROVED : ClubStatus.PENDING)
                .joinPolicy(request.joinPolicy() != null ? request.joinPolicy() : JoinPolicy.OPEN)
                .membershipFee(fee)
                .certificateThreshold(threshold)
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

        if (!isSuperAdmin) {
            notifySuperAdmins("New club proposal awaiting review: \"" + club.getName() + "\".");
        }

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

        InputLimits.requireImageSize(request.logoB64(), "club logo");
        BigDecimal fee = validatedFee(request.membershipFee(), club.getMembershipFee());
        Integer threshold = validatedThreshold(request.certificateThreshold(), club.getCertificateThreshold());

        String newName = request.name().trim();
        String newCategory = request.category().trim();
        boolean nameChanged = !club.getName().equals(newName);
        if (nameChanged && clubRepository.existsByNameIgnoreCase(newName)) {
            throw ApiException.conflict("A club with this name already exists");
        }
        // Renaming or recategorizing an already-approved club is an identity change,
        // so it goes back to Super Admin for re-review rather than taking effect silently.
        boolean identityChanged = club.getStatus() == ClubStatus.APPROVED
                && (nameChanged || !club.getCategory().equals(newCategory));

        club.setName(newName);
        club.setDescription(request.description());
        club.setCategory(newCategory);
        club.setMembershipFee(fee);
        club.setCertificateThreshold(threshold);
        if (request.joinPolicy() != null) {
            club.setJoinPolicy(request.joinPolicy());
        }
        if (request.logoB64() != null) {
            club.setLogoB64(request.logoB64());
        }
        if (identityChanged) {
            club.setStatus(ClubStatus.PENDING);
        }
        club = clubRepository.save(club);

        if (identityChanged) {
            notificationService.notify(membership.getUser(),
                    "Your changes to \"" + club.getName() + "\" need Super Admin re-approval before going live again.");
            notifySuperAdmins("\"" + club.getName() + "\" changed its name or category and needs re-approval.");
        }

        return ClubResponse.from(club);
    }

    public ClubResponse approveClub(UUID clubId, boolean approve, UserPrincipal principal) {
        return approveClub(clubId, approve, null, principal);
    }

    public ClubResponse approveClub(UUID clubId, boolean approve, String reason, UserPrincipal principal) {
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

        String why = !approve && !isBlank(reason) ? " Reason: " + reason.trim() : "";
        notificationService.notify(club.getCreatedBy(), approve
                ? "Your club \"" + club.getName() + "\" was approved and is now live."
                : "Your club \"" + club.getName() + "\" request was rejected." + why);

        return ClubResponse.from(club);
    }

    /**
     * Closes a club: it disappears from browsing, stops accepting members and events, and its upcoming events are
     * cancelled (with refunds). History — members, ledger, certificates — is kept. The President or a Super Admin
     * can do it.
     */
    public ClubResponse archiveClub(UUID clubId, UserPrincipal principal) {
        Club club = clubRepository.findById(clubId)
                .orElseThrow(() -> ApiException.notFound("Club not found"));
        User actor = userRepository.findById(principal.getId())
                .orElseThrow(() -> ApiException.notFound("User not found"));

        boolean isPresident = membershipRepository.findByUserIdAndClubId(actor.getId(), clubId)
                .filter(m -> m.getStatus() == MembershipStatus.APPROVED)
                .map(m -> m.getPosition() == MembershipPosition.PRESIDENT)
                .orElse(false);
        if (actor.getRole() != Role.SUPER_ADMIN && !isPresident) {
            throw ApiException.forbidden("Only the Club Admin or a Super Admin can archive a club");
        }
        if (club.isArchived()) {
            throw ApiException.badRequest("This club is already archived");
        }

        club.setArchived(true);
        club = clubRepository.save(club);

        eventRepository.findByClubIdAndCancelledFalseAndEventDateAfter(clubId, Instant.now())
                .forEach(event -> eventService.cancelInternal(event, "the club was closed"));

        List<UUID> memberIds = membershipRepository.findByClubIdAndStatus(clubId, MembershipStatus.APPROVED)
                .stream().map(m -> m.getUser().getId()).toList();
        notificationService.notifyUsers(memberIds, "\"" + club.getName() + "\" has been closed and archived.");

        auditLogService.log(actor, "ARCHIVE_CLUB", "CLUB", club.getId(), club.getName());
        return ClubResponse.from(club);
    }

    public ClubResponse unarchiveClub(UUID clubId, UserPrincipal principal) {
        Club club = clubRepository.findById(clubId)
                .orElseThrow(() -> ApiException.notFound("Club not found"));
        User actor = userRepository.findById(principal.getId())
                .orElseThrow(() -> ApiException.notFound("User not found"));
        if (!club.isArchived()) {
            throw ApiException.badRequest("This club is not archived");
        }

        club.setArchived(false);
        club = clubRepository.save(club);
        auditLogService.log(actor, "UNARCHIVE_CLUB", "CLUB", club.getId(), club.getName());
        return ClubResponse.from(club);
    }

    public List<ClubResponse> listApprovedClubs(String category) {
        return listApprovedClubs(category, null);
    }

    /** Active (approved, not archived) clubs, optionally narrowed by category and a free-text name/description match. */
    public List<ClubResponse> listApprovedClubs(String category, String query) {
        return clubRepository.findAll(ClubSpecifications.active(category, query), Sort.by("name"))
                .stream().map(ClubResponse::from).toList();
    }

    /** The same filters, one page at a time, done by the database. */
    @Transactional(readOnly = true)
    public Page<ClubResponse> pageApprovedClubs(String category, String query, Pageable pageable) {
        return clubRepository.findAll(ClubSpecifications.active(category, query), pageable).map(ClubResponse::from);
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

    private void notifySuperAdmins(String message) {
        List<UUID> adminIds = userRepository.findByRole(Role.SUPER_ADMIN).stream().map(User::getId).toList();
        if (!adminIds.isEmpty()) {
            notificationService.notifyUsers(adminIds, message);
        }
    }

    private BigDecimal validatedFee(BigDecimal requested, BigDecimal fallback) {
        BigDecimal fee = requested != null ? requested : (fallback != null ? fallback : BigDecimal.ZERO);
        if (fee.signum() < 0 || fee.compareTo(MAX_MEMBERSHIP_FEE) > 0) {
            throw ApiException.badRequest("Membership fee must be between 0 and " + MAX_MEMBERSHIP_FEE.toPlainString());
        }
        return fee;
    }

    private Integer validatedThreshold(Integer requested, Integer fallback) {
        int threshold = requested != null ? requested : (fallback != null ? fallback : DEFAULT_CERTIFICATE_THRESHOLD);
        if (threshold < 1 || threshold > MAX_CERTIFICATE_THRESHOLD) {
            throw ApiException.badRequest("Certificate threshold must be between 1 and " + MAX_CERTIFICATE_THRESHOLD);
        }
        return threshold;
    }

    private boolean isBlank(String value) {
        return value == null || value.trim().isEmpty();
    }
}
