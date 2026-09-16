package com.club.backend.service;

import java.util.List;
import java.util.Set;
import java.util.UUID;

import org.springframework.stereotype.Service;

import com.club.backend.config.ApiException;
import com.club.backend.dto.ClubAnnouncementResponse;
import com.club.backend.dto.CreateAnnouncementRequest;
import com.club.backend.entity.Club;
import com.club.backend.entity.ClubAnnouncement;
import com.club.backend.entity.Membership;
import com.club.backend.entity.MembershipPosition;
import com.club.backend.entity.MembershipStatus;
import com.club.backend.entity.User;
import com.club.backend.repository.ClubAnnouncementRepository;
import com.club.backend.repository.ClubRepository;
import com.club.backend.repository.MembershipRepository;
import com.club.backend.repository.UserRepository;
import com.club.backend.security.UserPrincipal;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class ClubAnnouncementService {

    private static final Set<MembershipPosition> OFFICER_POSITIONS = Set.of(
            MembershipPosition.PRESIDENT, MembershipPosition.VP,
            MembershipPosition.SECRETARY, MembershipPosition.TREASURER);

    private final ClubAnnouncementRepository announcementRepository;
    private final ClubRepository clubRepository;
    private final MembershipRepository membershipRepository;
    private final UserRepository userRepository;
    private final NotificationService notificationService;

    public ClubAnnouncementResponse postAnnouncement(UUID clubId, CreateAnnouncementRequest request,
            UserPrincipal principal) {
        if (request.content() == null || request.content().trim().isEmpty()) {
            throw ApiException.badRequest("Announcement content is required");
        }

        Club club = clubRepository.findById(clubId)
                .orElseThrow(() -> ApiException.notFound("Club not found"));

        User author = userRepository.findById(principal.getId())
                .orElseThrow(() -> ApiException.notFound("User not found"));

        Membership membership = membershipRepository.findByUserIdAndClubId(author.getId(), clubId)
                .orElseThrow(() -> ApiException.forbidden("Only club officers can post announcements"));

        if (membership.getStatus() != MembershipStatus.APPROVED || !OFFICER_POSITIONS.contains(membership.getPosition())) {
            throw ApiException.forbidden("Only club officers can post announcements");
        }

        ClubAnnouncement announcement = ClubAnnouncement.builder()
                .club(club)
                .author(author)
                .content(request.content().trim())
                .build();
        announcement = announcementRepository.save(announcement);

        String notifyMessage = "New announcement in " + club.getName() + ": " + announcement.getContent();
        membershipRepository.findByClubIdAndStatus(clubId, MembershipStatus.APPROVED)
                .forEach(m -> notificationService.notify(m.getUser(), notifyMessage));

        return ClubAnnouncementResponse.from(announcement);
    }

    public List<ClubAnnouncementResponse> listAnnouncements(UUID clubId) {
        return announcementRepository.findByClubIdOrderByCreatedAtDesc(clubId)
                .stream().map(ClubAnnouncementResponse::from).toList();
    }

    /** The original author or the Club Admin (President) can remove an announcement. */
    public void deleteAnnouncement(UUID clubId, UUID announcementId, UserPrincipal principal) {
        ClubAnnouncement announcement = announcementRepository.findById(announcementId)
                .orElseThrow(() -> ApiException.notFound("Announcement not found"));

        if (!announcement.getClub().getId().equals(clubId)) {
            throw ApiException.notFound("Announcement not found");
        }

        boolean isAuthor = announcement.getAuthor().getId().equals(principal.getId());
        boolean isPresident = membershipRepository.findByUserIdAndClubId(principal.getId(), clubId)
                .filter(m -> m.getStatus() == MembershipStatus.APPROVED)
                .map(m -> m.getPosition() == MembershipPosition.PRESIDENT)
                .orElse(false);

        if (!isAuthor && !isPresident) {
            throw ApiException.forbidden("Only the author or the Club Admin can delete this announcement");
        }

        announcementRepository.delete(announcement);
    }
}
