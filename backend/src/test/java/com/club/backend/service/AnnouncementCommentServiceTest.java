package com.club.backend.service;

import static org.assertj.core.api.Assertions.assertThat;
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
import com.club.backend.dto.AnnouncementCommentResponse;
import com.club.backend.dto.CreateCommentRequest;
import com.club.backend.entity.AnnouncementComment;
import com.club.backend.entity.Club;
import com.club.backend.entity.ClubAnnouncement;
import com.club.backend.entity.Membership;
import com.club.backend.entity.MembershipPosition;
import com.club.backend.entity.MembershipStatus;
import com.club.backend.entity.Role;
import com.club.backend.entity.User;
import com.club.backend.repository.AnnouncementCommentRepository;
import com.club.backend.repository.ClubAnnouncementRepository;
import com.club.backend.repository.MembershipRepository;
import com.club.backend.repository.UserRepository;
import com.club.backend.security.UserPrincipal;

@ExtendWith(MockitoExtension.class)
class AnnouncementCommentServiceTest {

    @Mock
    private AnnouncementCommentRepository commentRepository;
    @Mock
    private ClubAnnouncementRepository announcementRepository;
    @Mock
    private MembershipRepository membershipRepository;
    @Mock
    private UserRepository userRepository;

    @InjectMocks
    private AnnouncementCommentService commentService;

    private User author;
    private User president;
    private Club club;
    private ClubAnnouncement announcement;
    private UserPrincipal authorPrincipal;

    @BeforeEach
    void setUp() {
        author = User.builder().id(UUID.randomUUID()).name("Author").email("author@example.com").role(Role.STUDENT).build();
        president = User.builder().id(UUID.randomUUID()).name("Pres").email("pres@example.com").role(Role.STUDENT).build();
        club = Club.builder().id(UUID.randomUUID()).name("Chess Club").build();
        announcement = ClubAnnouncement.builder().id(UUID.randomUUID()).club(club).build();
        authorPrincipal = new UserPrincipal(author);
    }

    @Test
    void postComment_nonMember_throws() {
        when(announcementRepository.findById(announcement.getId())).thenReturn(Optional.of(announcement));
        when(userRepository.findById(author.getId())).thenReturn(Optional.of(author));
        when(membershipRepository.findByUserIdAndClubId(author.getId(), club.getId())).thenReturn(Optional.empty());

        assertThatThrownBy(() -> commentService.postComment(club.getId(), announcement.getId(),
                new CreateCommentRequest("Nice!"), authorPrincipal))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("members");
    }

    @Test
    void postComment_wrongClubInPath_notFound() {
        UUID otherClubId = UUID.randomUUID();
        when(announcementRepository.findById(announcement.getId())).thenReturn(Optional.of(announcement));

        assertThatThrownBy(() -> commentService.postComment(otherClubId, announcement.getId(),
                new CreateCommentRequest("Nice!"), authorPrincipal))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("not found");
    }

    @Test
    void deleteComment_author_succeeds() {
        AnnouncementComment comment = AnnouncementComment.builder().id(UUID.randomUUID())
                .announcement(announcement).author(author).content("Nice!").build();
        when(commentRepository.findById(comment.getId())).thenReturn(Optional.of(comment));

        commentService.deleteComment(club.getId(), comment.getId(), authorPrincipal);

        verify(commentRepository).delete(comment);
    }

    @Test
    void deleteComment_president_succeeds() {
        AnnouncementComment comment = AnnouncementComment.builder().id(UUID.randomUUID())
                .announcement(announcement).author(author).content("Nice!").build();
        Membership presidentMembership = Membership.builder().position(MembershipPosition.PRESIDENT)
                .status(MembershipStatus.APPROVED).build();
        when(commentRepository.findById(comment.getId())).thenReturn(Optional.of(comment));
        when(membershipRepository.findByUserIdAndClubId(president.getId(), club.getId()))
                .thenReturn(Optional.of(presidentMembership));

        commentService.deleteComment(club.getId(), comment.getId(), new UserPrincipal(president));

        verify(commentRepository).delete(comment);
    }

    @Test
    void deleteComment_otherMember_throwsForbidden() {
        AnnouncementComment comment = AnnouncementComment.builder().id(UUID.randomUUID())
                .announcement(announcement).author(author).content("Nice!").build();
        User otherMember = User.builder().id(UUID.randomUUID()).name("Other").email("other@example.com").role(Role.STUDENT).build();
        when(commentRepository.findById(comment.getId())).thenReturn(Optional.of(comment));
        when(membershipRepository.findByUserIdAndClubId(otherMember.getId(), club.getId())).thenReturn(Optional.empty());

        assertThatThrownBy(() -> commentService.deleteComment(club.getId(), comment.getId(), new UserPrincipal(otherMember)))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("author or the Club Admin");
    }

    @Test
    void deleteComment_presidentOfDifferentClub_cannotDeleteRegression() {
        // Regression: a president must only be able to delete comments that belong to THEIR club,
        // not any comment in the system by supplying their own clubId in the path.
        Club otherClub = Club.builder().id(UUID.randomUUID()).name("Art Club").build();
        ClubAnnouncement otherAnnouncement = ClubAnnouncement.builder().id(UUID.randomUUID()).club(otherClub).build();
        AnnouncementComment comment = AnnouncementComment.builder().id(UUID.randomUUID())
                .announcement(otherAnnouncement).author(author).content("Nice!").build();
        when(commentRepository.findById(comment.getId())).thenReturn(Optional.of(comment));

        assertThatThrownBy(() -> commentService.deleteComment(club.getId(), comment.getId(), new UserPrincipal(president)))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("not found");
    }
}
