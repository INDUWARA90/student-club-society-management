package com.club.backend.service;

import java.util.List;
import java.util.UUID;

import org.springframework.stereotype.Service;

import com.club.backend.config.ApiException;
import com.club.backend.dto.MembershipResponse;
import com.club.backend.entity.Club;
import com.club.backend.entity.JoinPolicy;
import com.club.backend.entity.Membership;
import com.club.backend.entity.MembershipPosition;
import com.club.backend.entity.MembershipStatus;
import com.club.backend.entity.User;
import com.club.backend.repository.ClubRepository;
import com.club.backend.repository.MembershipRepository;
import com.club.backend.repository.UserRepository;
import com.club.backend.security.UserPrincipal;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class MembershipService {

    private final MembershipRepository membershipRepository;
    private final ClubRepository clubRepository;
    private final UserRepository userRepository;
    private final NotificationService notificationService;

    public MembershipResponse joinClub(UUID clubId, UserPrincipal principal) {
        Club club = clubRepository.findById(clubId)
                .orElseThrow(() -> ApiException.notFound("Club not found"));

        User user = userRepository.findById(principal.getId())
                .orElseThrow(() -> ApiException.notFound("User not found"));

        if (membershipRepository.findByUserIdAndClubId(user.getId(), clubId).isPresent()) {
            throw ApiException.conflict("You have already requested to join or are a member of this club");
        }

        Membership membership = Membership.builder()
                .user(user)
                .club(club)
                .position(MembershipPosition.MEMBER)
                .status(club.getJoinPolicy() == JoinPolicy.OPEN ? MembershipStatus.APPROVED : MembershipStatus.PENDING)
                .build();
        membership = membershipRepository.save(membership);

        return MembershipResponse.from(membership);
    }

    public MembershipResponse reviewJoinRequest(UUID membershipId, boolean approve) {
        Membership membership = membershipRepository.findById(membershipId)
                .orElseThrow(() -> ApiException.notFound("Membership request not found"));

        if (membership.getStatus() != MembershipStatus.PENDING) {
            throw ApiException.badRequest("Only pending join requests can be approved or rejected");
        }

        membership.setStatus(approve ? MembershipStatus.APPROVED : MembershipStatus.REJECTED);
        membership = membershipRepository.save(membership);

        notificationService.notify(membership.getUser(), "Your membership request for "
                + membership.getClub().getName() + " was " + (approve ? "approved" : "rejected") + ".");

        return MembershipResponse.from(membership);
    }

    /** A student can leave a club they belong to. The President must hand off the role first. */
    public void leaveClub(UUID clubId, UserPrincipal principal) {
        Membership membership = membershipRepository.findByUserIdAndClubId(principal.getId(), clubId)
                .orElseThrow(() -> ApiException.notFound("You are not a member of this club"));

        if (membership.getStatus() == MembershipStatus.APPROVED && membership.getPosition() == MembershipPosition.PRESIDENT) {
            throw ApiException.badRequest("Transfer the President position to another member before leaving");
        }

        membershipRepository.delete(membership);
    }

    public List<MembershipResponse> listMembers(UUID clubId) {
        return membershipRepository.findByClubIdAndStatus(clubId, MembershipStatus.APPROVED)
                .stream().map(MembershipResponse::from).toList();
    }

    public String listMembersCsv(UUID clubId) {
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

    private String escapeCsv(String value) {
        if (value == null) {
            return "";
        }
        return value.contains(",") ? "\"" + value.replace("\"", "\"\"") + "\"" : value;
    }

    public List<MembershipResponse> listPendingRequests(UUID clubId) {
        return membershipRepository.findByClubIdAndStatus(clubId, MembershipStatus.PENDING)
                .stream().map(MembershipResponse::from).toList();
    }

    public List<MembershipResponse> listMyMemberships(UserPrincipal principal) {
        return membershipRepository.findByUserId(principal.getId())
                .stream().map(MembershipResponse::from).toList();
    }

    /** Assigning PRESIDENT demotes the club's current President to MEMBER, keeping exactly one President. */
    public MembershipResponse assignPosition(UUID membershipId, MembershipPosition position) {
        Membership membership = membershipRepository.findById(membershipId)
                .orElseThrow(() -> ApiException.notFound("Membership not found"));

        if (membership.getStatus() != MembershipStatus.APPROVED) {
            throw ApiException.badRequest("Only approved members can be assigned a position");
        }

        if (position == MembershipPosition.PRESIDENT) {
            UUID targetId = membership.getId();
            membershipRepository.findByClubIdAndPosition(membership.getClub().getId(), MembershipPosition.PRESIDENT)
                    .filter(current -> !current.getId().equals(targetId))
                    .ifPresent(current -> {
                        current.setPosition(MembershipPosition.MEMBER);
                        membershipRepository.save(current);
                    });
        }

        membership.setPosition(position);
        membership = membershipRepository.save(membership);
        return MembershipResponse.from(membership);
    }
}
