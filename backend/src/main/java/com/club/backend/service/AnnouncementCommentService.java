package com.club.backend.service;

import java.util.List;
import java.util.UUID;

import org.springframework.stereotype.Service;

import com.club.backend.config.ApiException;
import com.club.backend.dto.AnnouncementCommentResponse;
import com.club.backend.dto.CreateCommentRequest;
import com.club.backend.entity.AnnouncementComment;
import com.club.backend.entity.ClubAnnouncement;
import com.club.backend.entity.MembershipPosition;
import com.club.backend.entity.MembershipStatus;
import com.club.backend.entity.User;
import com.club.backend.repository.AnnouncementCommentRepository;
import com.club.backend.repository.ClubAnnouncementRepository;
import com.club.backend.repository.MembershipRepository;
import com.club.backend.repository.UserRepository;
import com.club.backend.security.UserPrincipal;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class AnnouncementCommentService {

    private final AnnouncementCommentRepository commentRepository;
    private final ClubAnnouncementRepository announcementRepository;
    private final MembershipRepository membershipRepository;
    private final UserRepository userRepository;

    public AnnouncementCommentResponse postComment(UUID clubId, UUID announcementId, CreateCommentRequest request,
            UserPrincipal principal) {
        if (request.content() == null || request.content().trim().isEmpty()) {
            throw ApiException.badRequest("Comment content is required");
        }

        ClubAnnouncement announcement = announcementRepository.findById(announcementId)
                .orElseThrow(() -> ApiException.notFound("Announcement not found"));

        if (!announcement.getClub().getId().equals(clubId)) {
            throw ApiException.notFound("Announcement not found");
        }

        User author = userRepository.findById(principal.getId())
                .orElseThrow(() -> ApiException.notFound("User not found"));

        membershipRepository.findByUserIdAndClubId(author.getId(), clubId)
                .filter(m -> m.getStatus() == MembershipStatus.APPROVED)
                .orElseThrow(() -> ApiException.forbidden("Only club members can comment"));

        AnnouncementComment comment = AnnouncementComment.builder()
                .announcement(announcement)
                .author(author)
                .content(request.content().trim())
                .build();
        comment = commentRepository.save(comment);

        return AnnouncementCommentResponse.from(comment);
    }

    public List<AnnouncementCommentResponse> listComments(UUID announcementId) {
        return commentRepository.findByAnnouncementIdOrderByCreatedAtAsc(announcementId)
                .stream().map(AnnouncementCommentResponse::from).toList();
    }

    public void deleteComment(UUID clubId, UUID commentId, UserPrincipal principal) {
        AnnouncementComment comment = commentRepository.findById(commentId)
                .orElseThrow(() -> ApiException.notFound("Comment not found"));

        boolean isAuthor = comment.getAuthor().getId().equals(principal.getId());
        boolean isPresident = membershipRepository.findByUserIdAndClubId(principal.getId(), clubId)
                .filter(m -> m.getStatus() == MembershipStatus.APPROVED)
                .map(m -> m.getPosition() == MembershipPosition.PRESIDENT)
                .orElse(false);

        if (!isAuthor && !isPresident) {
            throw ApiException.forbidden("Only the author or the Club Admin can delete this comment");
        }

        commentRepository.delete(comment);
    }
}
