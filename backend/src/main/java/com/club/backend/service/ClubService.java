package com.club.backend.service;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Set;
import java.util.UUID;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;

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
    private static final Set<MembershipPosition> OFFICER_POSITIONS = Set.of(
            MembershipPosition.PRESIDENT,
            MembershipPosition.VP,
            MembershipPosition.SECRETARY,
            MembershipPosition.TREASURER);

    private final ClubRepository clubRepository;
    private final MembershipRepository membershipRepository;
    private final UserRepository userRepository;
    private final EventRepository eventRepository;
    private final AuditLogService auditLogService;
    private final NotificationService notificationService;
    private final EventService eventService;
    private final EmailVerificationPolicy emailVerificationPolicy;

    @PersistenceContext
    private EntityManager entityManager;

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
        if (creator.getRole() != Role.SUPER_ADMIN) {
            throw ApiException.forbidden("Only a Super Admin can create a club");
        }
        emailVerificationPolicy.requireVerified(creator);

        if (clubRepository.existsByNameIgnoreCase(request.name().trim())) {
            throw ApiException.conflict("A club with this name already exists");
        }

        Club club = Club.builder()
                .name(request.name().trim())
                .description(request.description())
                .category(request.category().trim())
                .status(ClubStatus.APPROVED)
                .joinPolicy(request.joinPolicy() != null ? request.joinPolicy() : JoinPolicy.OPEN)
                .membershipFee(fee)
                .certificateThreshold(threshold)
                .logoB64(request.logoB64())
                .createdBy(creator)
                .build();
        club = clubRepository.save(club);

        // The creating Super Admin starts out as the club's President (Club Admin), and hands the
        // role to a student later through the positions endpoint.
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

        boolean isStaff = "SUPER_ADMIN".equals(principal.getRole()) || "FACULTY_ADVISOR".equals(principal.getRole());
        Membership membership = membershipRepository.findByUserIdAndClubId(principal.getId(), clubId).orElse(null);
        if (!isStaff) {
            if (membership == null || membership.getStatus() != MembershipStatus.APPROVED || !OFFICER_POSITIONS.contains(membership.getPosition())) {
                throw ApiException.forbidden("Only club leadership can edit the club");
            }
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
        if (request.showBudgetToMembers() != null && request.showBudgetToMembers() != club.isShowBudgetToMembers()) {
            boolean isPresidentOrSuperAdmin = "SUPER_ADMIN".equals(principal.getRole())
                    || (membership != null && membership.getStatus() == MembershipStatus.APPROVED && membership.getPosition() == MembershipPosition.PRESIDENT);
            if (isPresidentOrSuperAdmin) {
                club.setShowBudgetToMembers(request.showBudgetToMembers());
            }
        }
        if (identityChanged) {
            club.setStatus(ClubStatus.PENDING);
        }
        Club savedClub = clubRepository.save(club);

        if (identityChanged) {
            String updatedName = savedClub.getName();
            User target = membership != null ? membership.getUser() : userRepository.findById(principal.getId()).orElse(null);
            if (target != null) {
                notificationService.notify(target,
                        "Your changes to \"" + updatedName + "\" need Super Admin re-approval before going live again.");
            }
            notifySuperAdmins("\"" + updatedName + "\" changed its name or category and needs re-approval.");
        }

        return ClubResponse.from(savedClub);
    }

    public ClubResponse setBudgetVisibility(UUID clubId, boolean show, UserPrincipal principal) {
        Club club = clubRepository.findById(clubId)
                .orElseThrow(() -> ApiException.notFound("Club not found"));

        if ("FACULTY_ADVISOR".equals(principal.getRole())) {
            throw ApiException.forbidden("Faculty Advisors have view-only access to the club budget and cannot toggle member visibility");
        }

        boolean isSuperAdmin = "SUPER_ADMIN".equals(principal.getRole());
        Membership membership = membershipRepository.findByUserIdAndClubId(principal.getId(), clubId).orElse(null);
        if (!isSuperAdmin) {
            if (membership == null || membership.getStatus() != MembershipStatus.APPROVED
                    || membership.getPosition() != MembershipPosition.PRESIDENT) {
                throw ApiException.forbidden("Only the club president can toggle budget visibility for members");
            }
        }
        club.setShowBudgetToMembers(show);
        return ClubResponse.from(clubRepository.save(club));
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
        if (actor.getRole() != Role.SUPER_ADMIN && actor.getRole() != Role.FACULTY_ADVISOR && !isPresident) {
            throw ApiException.forbidden("Only the Club Admin or a Super Admin (or Faculty Advisor) can archive a club");
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
                .stream().map(this::toClubResponse).toList();
    }

    /** The same filters, one page at a time, done by the database. */
    @Transactional(readOnly = true)
    public Page<ClubResponse> pageApprovedClubs(String category, String query, Pageable pageable) {
        return clubRepository.findAll(ClubSpecifications.active(category, query), pageable).map(this::toClubResponse);
    }

    public List<ClubResponse> listPendingClubs() {
        return clubRepository.findByStatus(ClubStatus.PENDING).stream().map(this::toClubResponse).toList();
    }

    /** University-wide read-only oversight (Super Admin, Faculty Advisor) — every club regardless of status. */
    public List<ClubResponse> listAllClubs() {
        return clubRepository.findAll().stream().map(this::toClubResponse).toList();
    }

    public ClubResponse getClub(UUID clubId) {
        Club club = clubRepository.findById(clubId)
                .orElseThrow(() -> ApiException.notFound("Club not found"));
        return toClubResponse(club);
    }

    private ClubResponse toClubResponse(Club club) {
        long count = membershipRepository.countByClubIdAndStatus(club.getId(), MembershipStatus.APPROVED);
        return ClubResponse.from(club, count);
    }

    /** Permanently removes a club and its foreign-keyed data. Restricted at the controller to Super Admins. */
    public void deleteClub(UUID clubId, UserPrincipal principal) {
        Club club = clubRepository.findById(clubId)
                .orElseThrow(() -> ApiException.notFound("Club not found"));
        User actor = userRepository.findById(principal.getId())
                .orElseThrow(() -> ApiException.notFound("User not found"));

        deleteRelatedClubData(clubId);
        clubRepository.delete(club);
        auditLogService.log(actor, "DELETE_CLUB", "CLUB", clubId, club.getName());
    }

    private void deleteRelatedClubData(UUID clubId) {
        deleteNative("DELETE FROM announcement_comments WHERE announcement_id IN "
                + "(SELECT id FROM club_announcements WHERE club_id = :clubId)", clubId);
        deleteNative("DELETE FROM club_announcements WHERE club_id = :clubId", clubId);
        deleteNative("DELETE FROM attendance WHERE event_id IN "
                + "(SELECT id FROM events WHERE club_id = :clubId)", clubId);
        deleteNative("DELETE FROM event_feedback WHERE event_id IN "
                + "(SELECT id FROM events WHERE club_id = :clubId)", clubId);
        deleteNative("DELETE FROM event_comments WHERE event_id IN "
                + "(SELECT id FROM events WHERE club_id = :clubId)", clubId);
        deleteNative("DELETE FROM rsvps WHERE event_id IN "
                + "(SELECT id FROM events WHERE club_id = :clubId)", clubId);
        deleteNative("DELETE FROM club_expenses WHERE club_id = :clubId", clubId);
        deleteNative("DELETE FROM club_resources WHERE club_id = :clubId", clubId);
        deleteNative("DELETE FROM comment_reports WHERE club_id = :clubId", clubId);
        deleteNative("DELETE FROM certificates WHERE club_id = :clubId", clubId);
        deleteNative("DELETE FROM memberships WHERE club_id = :clubId", clubId);
        deleteNative("DELETE FROM events WHERE club_id = :clubId", clubId);
    }

    private void deleteNative(String sql, UUID clubId) {
        entityManager.createNativeQuery(sql)
                .setParameter("clubId", clubId)
                .executeUpdate();
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
