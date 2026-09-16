package com.club.backend.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import com.club.backend.config.ApiException;
import com.club.backend.dto.CreateEventRequest;
import com.club.backend.dto.EventResponse;
import com.club.backend.entity.Club;
import com.club.backend.entity.Event;
import com.club.backend.entity.EventApprovalStatus;
import com.club.backend.entity.Membership;
import com.club.backend.entity.MembershipPosition;
import com.club.backend.entity.MembershipStatus;
import com.club.backend.entity.Role;
import com.club.backend.entity.User;
import com.club.backend.repository.ClubRepository;
import com.club.backend.repository.EventRepository;
import com.club.backend.repository.MembershipRepository;
import com.club.backend.security.UserPrincipal;

@ExtendWith(MockitoExtension.class)
class EventServiceTest {

    @Mock
    private EventRepository eventRepository;
    @Mock
    private ClubRepository clubRepository;
    @Mock
    private MembershipRepository membershipRepository;
    @Mock
    private com.club.backend.repository.UserRepository userRepository;
    @Mock
    private AuditLogService auditLogService;

    @InjectMocks
    private EventService eventService;

    private User president;
    private Club club;
    private UserPrincipal principal;

    @BeforeEach
    void setUp() {
        president = User.builder().id(UUID.randomUUID()).name("Pres").email("pres@example.com").role(Role.STUDENT).build();
        club = Club.builder().id(UUID.randomUUID()).name("Chess Club").createdBy(president).build();
        principal = new UserPrincipal(president);
    }

    @Test
    void createEvent_blankTitle_throws() {
        CreateEventRequest request = new CreateEventRequest("  ", null, null, Instant.now(), null, null);

        assertThatThrownBy(() -> eventService.createEvent(club.getId(), request, principal))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("title");
    }

    @Test
    void createEvent_nonOfficer_throws() {
        CreateEventRequest request = new CreateEventRequest("Tournament", null, null, Instant.now(), null, null);
        when(clubRepository.findById(club.getId())).thenReturn(Optional.of(club));
        when(membershipRepository.findByUserIdAndClubId(president.getId(), club.getId())).thenReturn(Optional.empty());

        assertThatThrownBy(() -> eventService.createEvent(club.getId(), request, principal))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("officers");
    }

    @Test
    void createEvent_feeAboveThreshold_requiresFaApproval() {
        CreateEventRequest request = new CreateEventRequest(
                "Gala", null, null, Instant.now(), new BigDecimal("10000"), null);
        Membership officerMembership = Membership.builder().position(MembershipPosition.PRESIDENT)
                .status(MembershipStatus.APPROVED).build();
        when(clubRepository.findById(club.getId())).thenReturn(Optional.of(club));
        when(membershipRepository.findByUserIdAndClubId(president.getId(), club.getId()))
                .thenReturn(Optional.of(officerMembership));
        when(eventRepository.save(any(Event.class))).thenAnswer(inv -> inv.getArgument(0));

        EventResponse response = eventService.createEvent(club.getId(), request, principal);

        assertThat(response.requiresFaApproval()).isTrue();
        assertThat(response.approvalStatus()).isEqualTo(EventApprovalStatus.PENDING);
    }

    @Test
    void createEvent_feeBelowThreshold_doesNotRequireApproval() {
        CreateEventRequest request = new CreateEventRequest(
                "Meetup", null, null, Instant.now(), BigDecimal.ZERO, null);
        Membership officerMembership = Membership.builder().position(MembershipPosition.PRESIDENT)
                .status(MembershipStatus.APPROVED).build();
        when(clubRepository.findById(club.getId())).thenReturn(Optional.of(club));
        when(membershipRepository.findByUserIdAndClubId(president.getId(), club.getId()))
                .thenReturn(Optional.of(officerMembership));
        when(eventRepository.save(any(Event.class))).thenAnswer(inv -> inv.getArgument(0));

        EventResponse response = eventService.createEvent(club.getId(), request, principal);

        assertThat(response.requiresFaApproval()).isFalse();
        assertThat(response.approvalStatus()).isEqualTo(EventApprovalStatus.NOT_REQUIRED);
    }

    @Test
    void reviewEvent_notPending_throws() {
        Event event = Event.builder().id(UUID.randomUUID()).club(club)
                .approvalStatus(EventApprovalStatus.APPROVED).build();
        when(eventRepository.findById(event.getId())).thenReturn(Optional.of(event));

        assertThatThrownBy(() -> eventService.reviewEvent(event.getId(), true, principal))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("pending");
    }
}
