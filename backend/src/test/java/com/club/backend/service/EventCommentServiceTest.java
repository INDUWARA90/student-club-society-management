package com.club.backend.service;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.Optional;
import java.util.UUID;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import com.club.backend.config.ApiException;
import com.club.backend.dto.CreateCommentRequest;
import com.club.backend.entity.Club;
import com.club.backend.entity.Event;
import com.club.backend.entity.EventComment;
import com.club.backend.entity.Membership;
import com.club.backend.entity.MembershipPosition;
import com.club.backend.entity.MembershipStatus;
import com.club.backend.entity.Role;
import com.club.backend.entity.User;
import com.club.backend.repository.EventCommentRepository;
import com.club.backend.repository.EventRepository;
import com.club.backend.repository.MembershipRepository;
import com.club.backend.repository.UserRepository;
import com.club.backend.security.UserPrincipal;

@ExtendWith(MockitoExtension.class)
class EventCommentServiceTest {

    @Mock
    private EventCommentRepository commentRepository;
    @Mock
    private EventRepository eventRepository;
    @Mock
    private MembershipRepository membershipRepository;
    @Mock
    private UserRepository userRepository;

    @InjectMocks
    private EventCommentService commentService;

    private User author;
    private User president;
    private Club club;
    private Event event;
    private UserPrincipal authorPrincipal;

    @BeforeEach
    void setUp() {
        author = User.builder().id(UUID.randomUUID()).name("Author").email("author@example.com").role(Role.STUDENT).build();
        president = User.builder().id(UUID.randomUUID()).name("Pres").email("pres@example.com").role(Role.STUDENT).build();
        club = Club.builder().id(UUID.randomUUID()).name("Chess Club").build();
        event = Event.builder().id(UUID.randomUUID()).club(club).title("Hack Night").build();
        authorPrincipal = new UserPrincipal(author);
    }

    @Test
    void postComment_nonMember_throws() {
        when(eventRepository.findById(event.getId())).thenReturn(Optional.of(event));
        when(userRepository.findById(author.getId())).thenReturn(Optional.of(author));
        when(membershipRepository.findByUserIdAndClubId(author.getId(), club.getId())).thenReturn(Optional.empty());

        assertThatThrownBy(() -> commentService.postComment(event.getId(), new CreateCommentRequest("Nice!"), authorPrincipal))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("members");
    }

    @Test
    void postComment_eventNotFound_throws() {
        UUID missingEventId = UUID.randomUUID();
        when(eventRepository.findById(missingEventId)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> commentService.postComment(missingEventId, new CreateCommentRequest("Nice!"), authorPrincipal))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("not found");
    }

    @Test
    void deleteComment_author_succeeds() {
        EventComment comment = EventComment.builder().id(UUID.randomUUID()).event(event).author(author).content("Nice!").build();
        when(commentRepository.findById(comment.getId())).thenReturn(Optional.of(comment));

        commentService.deleteComment(event.getId(), comment.getId(), authorPrincipal);

        verify(commentRepository).delete(comment);
    }

    @Test
    void deleteComment_president_succeeds() {
        EventComment comment = EventComment.builder().id(UUID.randomUUID()).event(event).author(author).content("Nice!").build();
        Membership presidentMembership = Membership.builder().position(MembershipPosition.PRESIDENT)
                .status(MembershipStatus.APPROVED).build();
        when(commentRepository.findById(comment.getId())).thenReturn(Optional.of(comment));
        when(membershipRepository.findByUserIdAndClubId(president.getId(), club.getId()))
                .thenReturn(Optional.of(presidentMembership));

        commentService.deleteComment(event.getId(), comment.getId(), new UserPrincipal(president));

        verify(commentRepository).delete(comment);
    }

    @Test
    void deleteComment_otherMember_throwsForbidden() {
        EventComment comment = EventComment.builder().id(UUID.randomUUID()).event(event).author(author).content("Nice!").build();
        User otherMember = User.builder().id(UUID.randomUUID()).name("Other").email("other@example.com").role(Role.STUDENT).build();
        when(commentRepository.findById(comment.getId())).thenReturn(Optional.of(comment));
        when(membershipRepository.findByUserIdAndClubId(otherMember.getId(), club.getId())).thenReturn(Optional.empty());

        assertThatThrownBy(() -> commentService.deleteComment(event.getId(), comment.getId(), new UserPrincipal(otherMember)))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("author or the Club Admin");
    }

    @Test
    void deleteComment_wrongEventInPath_notFound() {
        EventComment comment = EventComment.builder().id(UUID.randomUUID()).event(event).author(author).content("Nice!").build();
        UUID otherEventId = UUID.randomUUID();
        when(commentRepository.findById(comment.getId())).thenReturn(Optional.of(comment));

        assertThatThrownBy(() -> commentService.deleteComment(otherEventId, comment.getId(), authorPrincipal))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("not found");
    }
}
