package com.club.backend.service;

import java.time.Year;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Isolation;
import org.springframework.transaction.annotation.Transactional;

import com.club.backend.config.ApiException;
import com.club.backend.dto.ImportMembersRequest;
import com.club.backend.dto.ImportMembersResponse;
import com.club.backend.dto.MembershipResponse;
import com.club.backend.entity.Club;
import com.club.backend.entity.JoinPolicy;
import com.club.backend.entity.Membership;
import com.club.backend.entity.MembershipPosition;
import com.club.backend.entity.MembershipStatus;
import com.club.backend.entity.PaymentType;
import com.club.backend.entity.User;
import com.club.backend.repository.ClubRepository;
import com.club.backend.repository.MembershipRepository;
import com.club.backend.repository.UserRepository;
import com.club.backend.security.UserPrincipal;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
@Transactional
public class MembershipService {

    private final MembershipRepository membershipRepository;
    private final ClubRepository clubRepository;
    private final UserRepository userRepository;
    private final NotificationService notificationService;
    private final PaymentService paymentService;
    private final AuditLogService auditLogService;
    private final EmailVerificationPolicy emailVerificationPolicy;

    public MembershipResponse joinClub(UUID clubId, UserPrincipal principal) {
        Club club = clubRepository.findById(clubId)
                .orElseThrow(() -> ApiException.notFound("Club not found"));

        if (!EventRules.isClubActive(club)) {
            throw ApiException.badRequest("This club is not accepting members right now");
        }

        User user = userRepository.findById(principal.getId())
                .orElseThrow(() -> ApiException.notFound("User not found"));
        emailVerificationPolicy.requireVerified(user);

        Optional<Membership> existing = membershipRepository.findByUserIdAndClubId(user.getId(), clubId);
        // A rejected request can be re-submitted; anything else (pending / approved) is a duplicate.
        if (existing.isPresent() && existing.get().getStatus() != MembershipStatus.REJECTED) {
            throw ApiException.conflict("You have already requested to join or are a member of this club");
        }

        if (club.getMembershipFee() != null && club.getMembershipFee().signum() > 0
                && !paymentService.hasLivePayment(user.getId(), PaymentType.MEMBERSHIP, clubId)) {
            throw ApiException.badRequest("Pay the club's membership fee before joining");
        }

        MembershipStatus status = club.getJoinPolicy() == JoinPolicy.OPEN
                ? MembershipStatus.APPROVED : MembershipStatus.PENDING;

        Membership membership = existing.orElseGet(() -> Membership.builder().user(user).club(club).build());
        membership.setPosition(MembershipPosition.MEMBER);
        membership.setStatus(status);
        membership = membershipRepository.save(membership);

        if (status == MembershipStatus.PENDING) {
            membershipRepository.findByClubIdAndPosition(clubId, MembershipPosition.PRESIDENT)
                    .ifPresent(president -> notificationService.notify(president.getUser(),
                            user.getName() + " asked to join " + club.getName() + " — review the request."));
        }

        return MembershipResponse.from(membership);
    }

    public MembershipResponse reviewJoinRequest(UUID membershipId, boolean approve, UserPrincipal principal) {
        Membership membership = membershipRepository.findById(membershipId)
                .orElseThrow(() -> ApiException.notFound("Membership request not found"));

        requirePresident(membership.getClub().getId(), principal);

        if (membership.getStatus() != MembershipStatus.PENDING) {
            throw ApiException.badRequest("Only pending join requests can be approved or rejected");
        }

        membership.setStatus(approve ? MembershipStatus.APPROVED : MembershipStatus.REJECTED);
        membership = membershipRepository.save(membership);

        if (!approve) {
            // The fee was collected up front, so a rejected applicant gets it back.
            paymentService.refundMembershipPayment(membership.getUser().getId(), membership.getClub(),
                    "join request rejected");
        }

        notificationService.notify(membership.getUser(), "Your membership request for "
                + membership.getClub().getName() + " was " + (approve ? "approved" : "rejected") + ".");

        return MembershipResponse.from(membership);
    }

    /**
     * A student can leave a club they belong to (or withdraw a pending request, which refunds any fee paid).
     * The President must hand off the role first.
     */
    public void leaveClub(UUID clubId, UserPrincipal principal) {
        Membership membership = membershipRepository.findByUserIdAndClubId(principal.getId(), clubId)
                .orElseThrow(() -> ApiException.notFound("You are not a member of this club"));

        if (membership.getStatus() == MembershipStatus.APPROVED && membership.getPosition() == MembershipPosition.PRESIDENT) {
            throw ApiException.badRequest("Transfer the President position to another member before leaving");
        }

        if (membership.getStatus() == MembershipStatus.PENDING) {
            paymentService.refundMembershipPayment(principal.getId(), membership.getClub(), "join request withdrawn");
        }

        membershipRepository.delete(membership);
    }

    /** The President can remove a member (or turn away an applicant). The President themselves can't be removed. */
    public void removeMember(UUID membershipId, UserPrincipal principal) {
        Membership membership = membershipRepository.findById(membershipId)
                .orElseThrow(() -> ApiException.notFound("Membership not found"));
        Club club = membership.getClub();

        requirePresident(club.getId(), principal);

        if (membership.getPosition() == MembershipPosition.PRESIDENT) {
            throw ApiException.badRequest("The President can't be removed — transfer the role to another member first");
        }

        User target = membership.getUser();
        if (membership.getStatus() == MembershipStatus.PENDING) {
            paymentService.refundMembershipPayment(target.getId(), club, "join request declined");
        }
        membershipRepository.delete(membership);

        notificationService.notify(target, "You have been removed from " + club.getName() + ".");
        audit(principal, "REMOVE_MEMBER", membership.getId(), target.getName() + " removed from " + club.getName());
    }

    /** Throws forbidden unless the given user is the approved PRESIDENT of the given club. */
    private void requirePresident(UUID clubId, UserPrincipal principal) {
        Membership requester = membershipRepository.findByUserIdAndClubId(principal.getId(), clubId)
                .orElseThrow(() -> ApiException.forbidden("Only the Club Admin can perform this action"));

        if (requester.getStatus() != MembershipStatus.APPROVED || requester.getPosition() != MembershipPosition.PRESIDENT) {
            throw ApiException.forbidden("Only the Club Admin can perform this action");
        }
    }

    /**
     * Throws forbidden unless the given user is the approved PRESIDENT or SECRETARY of the club.
     * The Secretary owns membership recordkeeping (rosters/imports) but not governance (approvals/positions).
     */
    private void requirePresidentOrSecretary(UUID clubId, UserPrincipal principal) {
        Membership requester = membershipRepository.findByUserIdAndClubId(principal.getId(), clubId)
                .orElseThrow(() -> ApiException.forbidden("Only the Club Admin or Secretary can perform this action"));

        boolean allowed = requester.getStatus() == MembershipStatus.APPROVED
                && (requester.getPosition() == MembershipPosition.PRESIDENT
                        || requester.getPosition() == MembershipPosition.SECRETARY);
        if (!allowed) {
            throw ApiException.forbidden("Only the Club Admin or Secretary can perform this action");
        }
    }

    /** President or Secretary bulk import: adds each existing user by email as an approved MEMBER. */
    public ImportMembersResponse importMembers(UUID clubId, ImportMembersRequest request, UserPrincipal principal) {
        Club club = clubRepository.findById(clubId)
                .orElseThrow(() -> ApiException.notFound("Club not found"));

        requirePresidentOrSecretary(clubId, principal);

        int imported = 0;
        List<String> skipped = new ArrayList<>();

        for (String rawEmail : request.emails()) {
            String email = rawEmail == null ? "" : rawEmail.trim().toLowerCase();
            if (email.isEmpty()) {
                continue;
            }

            User user = userRepository.findByEmail(email).orElse(null);
            if (user == null) {
                skipped.add(email + " (no account)");
                continue;
            }
            if (membershipRepository.findByUserIdAndClubId(user.getId(), clubId).isPresent()) {
                skipped.add(email + " (already a member)");
                continue;
            }

            Membership membership = Membership.builder()
                    .user(user)
                    .club(club)
                    .position(MembershipPosition.MEMBER)
                    .status(MembershipStatus.APPROVED)
                    .build();
            membershipRepository.save(membership);
            imported++;
        }

        if (imported > 0) {
            audit(principal, "IMPORT_MEMBERS", clubId, imported + " member(s) imported into " + club.getName());
        }

        return new ImportMembersResponse(imported, skipped);
    }

    public List<MembershipResponse> listMembers(UUID clubId) {
        return membershipRepository.findByClubIdAndStatus(clubId, MembershipStatus.APPROVED)
                .stream().map(MembershipResponse::from).toList();
    }

    @Transactional(readOnly = true)
    public Page<MembershipResponse> pageMembers(UUID clubId, Pageable pageable) {
        return membershipRepository.findByClubIdAndStatus(clubId, MembershipStatus.APPROVED, pageable)
                .map(MembershipResponse::from);
    }

    public String listMembersCsv(UUID clubId, UserPrincipal principal) {
        requirePresidentOrSecretary(clubId, principal);

        List<Membership> members = membershipRepository.findByClubIdAndStatus(clubId, MembershipStatus.APPROVED);
        StringBuilder csv = new StringBuilder("Name,Email,Position,Joined At\n");
        for (Membership m : members) {
            csv.append(escapeCsv(m.getUser().getName())).append(',')
                    .append(escapeCsv(m.getUser().getEmail())).append(',')
                    .append(m.getPosition()).append(',')
                    .append(m.getJoinedAt()).append('\n');
        }
        return csv.toString();
    }

    /** Quotes values containing separators and neutralises spreadsheet formulas (=, +, -, @) in user-supplied text. */
    private String escapeCsv(String value) {
        if (value == null) {
            return "";
        }
        String safe = value;
        if (!safe.isEmpty() && "=+-@\t\r".indexOf(safe.charAt(0)) >= 0) {
            safe = "'" + safe;
        }
        return safe.contains(",") || safe.contains("\"") || safe.contains("\n")
                ? "\"" + safe.replace("\"", "\"\"") + "\"" : safe;
    }

    public List<MembershipResponse> listPendingRequests(UUID clubId, UserPrincipal principal) {
        requirePresident(clubId, principal);
        return membershipRepository.findByClubIdAndStatus(clubId, MembershipStatus.PENDING)
                .stream().map(MembershipResponse::from).toList();
    }

    public List<MembershipResponse> listMyMemberships(UserPrincipal principal) {
        return membershipRepository.findByUserId(principal.getId())
                .stream().map(MembershipResponse::from).toList();
    }

    /**
     * Assigning PRESIDENT demotes the club's current President to MEMBER, keeping exactly one President; that's how
     * the role is handed over. The President can't simply drop the role (that would leave the club without an
     * admin) — they must assign it to someone else. The club row is locked so two hand-offs can't interleave.
     * Other officer positions may be held by more than one member (e.g. an assistant Treasurer).
     *
     * <p>Runs at READ_COMMITTED: under MySQL's default REPEATABLE READ, a request that waited on the club lock would
     * still read the pre-wait snapshot (seeing a President who has just been replaced) and then trip the database
     * constraint. READ_COMMITTED makes the reads after the lock see the other hand-off's result.
     */
    @Transactional(isolation = Isolation.READ_COMMITTED)
    public MembershipResponse assignPosition(UUID membershipId, MembershipPosition position, UserPrincipal principal) {
        if (position == null) {
            throw ApiException.badRequest("A position is required");
        }

        Membership membership = membershipRepository.findById(membershipId)
                .orElseThrow(() -> ApiException.notFound("Membership not found"));
        Club club = membership.getClub();

        clubRepository.findByIdForUpdate(club.getId());
        requirePresident(club.getId(), principal);

        if (membership.getStatus() != MembershipStatus.APPROVED) {
            throw ApiException.badRequest("Only approved members can be assigned a position");
        }

        boolean isSelf = membership.getUser().getId().equals(principal.getId());
        if (isSelf && membership.getPosition() == MembershipPosition.PRESIDENT && position != MembershipPosition.PRESIDENT) {
            throw ApiException.badRequest("To step down, assign the President position to another member instead");
        }

        if (position == MembershipPosition.PRESIDENT && membership.getPosition() != MembershipPosition.PRESIDENT) {
            UUID targetId = membership.getId();
            membershipRepository.findByClubIdAndPosition(club.getId(), MembershipPosition.PRESIDENT)
                    .filter(current -> !current.getId().equals(targetId))
                    .ifPresent(current -> {
                        current.setPosition(MembershipPosition.MEMBER);
                        // Flush the demotion before the promotion so the one-President constraint is never violated.
                        membershipRepository.saveAndFlush(current);
                        notificationService.notify(current.getUser(),
                                "You are no longer President of " + club.getName() + ".");
                    });
        }

        membership.setPosition(position);
        membership = membershipRepository.save(membership);

        notificationService.notify(membership.getUser(),
                "Your position in " + club.getName() + " is now " + position.name() + ".");
        audit(principal, "ASSIGN_POSITION", membership.getId(),
                membership.getUser().getName() + " → " + position.name() + " in " + club.getName());
        return MembershipResponse.from(membership);
    }

    /**
     * Succession when a President has graduated (or otherwise left the club without handing over): the Vice
     * President — or, in a club with no VP, the Secretary/Treasurer — can take the role themselves. Clubs choose their
     * own President, so this stays inside the club: a Super Admin can't reassign it, and a President who is still a
     * student (not marked as graduated) can only be replaced by their own hand-off.
     */
    @Transactional(isolation = Isolation.READ_COMMITTED)
    public MembershipResponse claimPresidency(UUID clubId, UserPrincipal principal) {
        clubRepository.findByIdForUpdate(clubId);
        Club club = clubRepository.findById(clubId)
                .orElseThrow(() -> ApiException.notFound("Club not found"));

        Membership claimant = membershipRepository.findByUserIdAndClubId(principal.getId(), clubId)
                .filter(m -> m.getStatus() == MembershipStatus.APPROVED)
                .orElseThrow(() -> ApiException.forbidden("Only club officers can claim the presidency"));

        Membership current = membershipRepository.findByClubIdAndPosition(clubId, MembershipPosition.PRESIDENT).orElse(null);
        if (current != null) {
            if (current.getId().equals(claimant.getId())) {
                throw ApiException.badRequest("You are already the President");
            }
            if (!hasGraduated(current.getUser())) {
                throw ApiException.badRequest(
                        "The current President hasn't graduated — they need to hand the role over themselves");
            }
        }

        boolean vpExists = !membershipRepository.findByClubIdAndStatus(clubId, MembershipStatus.APPROVED).stream()
                .filter(m -> m.getPosition() == MembershipPosition.VP).toList().isEmpty();
        boolean eligible = claimant.getPosition() == MembershipPosition.VP
                || (!vpExists && (claimant.getPosition() == MembershipPosition.SECRETARY
                        || claimant.getPosition() == MembershipPosition.TREASURER));
        if (!eligible) {
            throw ApiException.forbidden(vpExists
                    ? "Only the Vice President can claim the presidency"
                    : "Only an officer can claim the presidency");
        }

        if (current != null) {
            current.setPosition(MembershipPosition.MEMBER);
            // Flush the demotion first so the one-President-per-club constraint is never violated.
            membershipRepository.saveAndFlush(current);
            notificationService.notify(current.getUser(),
                    "The presidency of " + club.getName() + " passed to " + claimant.getUser().getName() + ".");
        }
        claimant.setPosition(MembershipPosition.PRESIDENT);
        claimant = membershipRepository.save(claimant);

        notificationService.notify(claimant.getUser(), "You are now President of " + club.getName() + ".");
        audit(principal, "CLAIM_PRESIDENCY", claimant.getId(), claimant.getUser().getName() + " claimed the presidency of "
                + club.getName() + (current != null ? " from " + current.getUser().getName() : ""));
        return MembershipResponse.from(claimant);
    }

    private static boolean hasGraduated(User user) {
        return user.getGraduationYear() != null && user.getGraduationYear() < Year.now().getValue();
    }

    private void audit(UserPrincipal principal, String action, UUID targetId, String details) {
        userRepository.findById(principal.getId())
                .ifPresent(actor -> auditLogService.log(actor, action, "MEMBERSHIP", targetId, details));
    }
}
