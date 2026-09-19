package com.club.backend.service;

import java.util.List;
import java.util.UUID;

import org.springframework.stereotype.Service;

import com.club.backend.config.ApiException;
import com.club.backend.dto.CreateCommentRequest;
import com.club.backend.dto.EventCommentResponse;
import com.club.backend.entity.Event;
import com.club.backend.entity.EventComment;
import com.club.backend.entity.MembershipPosition;
import com.club.backend.entity.MembershipStatus;
import com.club.backend.entity.User;
import com.club.backend.repository.EventCommentRepository;
import com.club.backend.repository.EventRepository;
import com.club.backend.repository.MembershipRepository;
import com.club.backend.repository.UserRepository;
import com.club.backend.security.UserPrincipal;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class EventCommentService {

    private final EventCommentRepository commentRepository;
    private final EventRepository eventRepository;
    private final MembershipRepository membershipRepository;
    private final UserRepository userRepository;

    public EventCommentResponse postComment(UUID eventId, CreateCommentRequest request, UserPrincipal principal) {
        if (request.content() == null || request.content().trim().isEmpty()) {
            throw ApiException.badRequest("Comment content is required");
        }

        InputLimits.requireMaxChars(request.content(), InputLimits.MAX_COMMENT_CHARS, "A comment");

        Event event = eventRepository.findById(eventId)
                .orElseThrow(() -> ApiException.notFound("Event not found"));

        User author = userRepository.findById(principal.getId())
                .orElseThrow(() -> ApiException.notFound("User not found"));

        membershipRepository.findByUserIdAndClubId(author.getId(), event.getClub().getId())
                .filter(m -> m.getStatus() == MembershipStatus.APPROVED)
                .orElseThrow(() -> ApiException.forbidden("Only club members can comment"));

        EventComment comment = EventComment.builder()
                .event(event)
                .author(author)
                .content(request.content().trim())
                .build();
        comment = commentRepository.save(comment);

        return EventCommentResponse.from(comment);
    }

    public List<EventCommentResponse> listComments(UUID eventId) {
        return commentRepository.findByEventIdOrderByCreatedAtAsc(eventId)
                .stream().map(EventCommentResponse::from).toList();
    }

    public void deleteComment(UUID eventId, UUID commentId, UserPrincipal principal) {
        EventComment comment = commentRepository.findById(commentId)
                .orElseThrow(() -> ApiException.notFound("Comment not found"));

        if (!comment.getEvent().getId().equals(eventId)) {
            throw ApiException.notFound("Comment not found");
        }

        boolean isAuthor = comment.getAuthor().getId().equals(principal.getId());
        boolean isPresident = membershipRepository
                .findByUserIdAndClubId(principal.getId(), comment.getEvent().getClub().getId())
                .filter(m -> m.getStatus() == MembershipStatus.APPROVED)
                .map(m -> m.getPosition() == MembershipPosition.PRESIDENT)
                .orElse(false);

        if (!isAuthor && !isPresident) {
            throw ApiException.forbidden("Only the author or the Club Admin can delete this comment");
        }

        commentRepository.delete(comment);
    }
}
