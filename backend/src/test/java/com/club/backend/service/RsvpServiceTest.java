package com.club.backend.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import com.club.backend.config.ApiException;
import com.club.backend.dto.RsvpResponse;
import com.club.backend.entity.Club;
import com.club.backend.entity.Event;
import com.club.backend.entity.Role;
import com.club.backend.entity.Rsvp;
import com.club.backend.entity.RsvpStatus;
import com.club.backend.entity.User;
import com.club.backend.repository.EventRepository;
import com.club.backend.repository.RsvpRepository;
import com.club.backend.repository.UserRepository;
import com.club.backend.security.UserPrincipal;

@ExtendWith(MockitoExtension.class)
class RsvpServiceTest {

    @Mock
    private RsvpRepository rsvpRepository;
    @Mock
    private EventRepository eventRepository;
    @Mock
    private UserRepository userRepository;
    @Mock
    private NotificationService notificationService;

    @InjectMocks
    private RsvpService rsvpService;

    private User user;
    private Event event;
    private UserPrincipal principal;

    @BeforeEach
    void setUp() {
        user = User.builder().id(UUID.randomUUID()).name("Stu").email("stu@example.com").role(Role.STUDENT).build();
        Club club = Club.builder().id(UUID.randomUUID()).name("Chess Club").build();
        event = Event.builder().id(UUID.randomUUID()).club(club).title("Tournament").capacity(1).build();
        principal = new UserPrincipal(user);
    }

    @Test
    void rsvp_alreadyRsvpd_throws() {
        when(eventRepository.findById(event.getId())).thenReturn(Optional.of(event));
        when(userRepository.findById(user.getId())).thenReturn(Optional.of(user));
        when(rsvpRepository.findByEventIdAndUserId(event.getId(), user.getId()))
                .thenReturn(Optional.of(Rsvp.builder().build()));

        assertThatThrownBy(() -> rsvpService.rsvp(event.getId(), principal))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("already");
    }

    @Test
    void rsvp_underCapacity_marksGoing() {
        when(eventRepository.findById(event.getId())).thenReturn(Optional.of(event));
        when(userRepository.findById(user.getId())).thenReturn(Optional.of(user));
        when(rsvpRepository.findByEventIdAndUserId(event.getId(), user.getId())).thenReturn(Optional.empty());
        when(rsvpRepository.countByEventIdAndStatus(event.getId(), RsvpStatus.GOING)).thenReturn(0L);
        when(rsvpRepository.save(any(Rsvp.class))).thenAnswer(inv -> inv.getArgument(0));

        RsvpResponse response = rsvpService.rsvp(event.getId(), principal);

        assertThat(response.status()).isEqualTo(RsvpStatus.GOING);
    }

    @Test
    void rsvp_atCapacity_marksWaitlisted() {
        when(eventRepository.findById(event.getId())).thenReturn(Optional.of(event));
        when(userRepository.findById(user.getId())).thenReturn(Optional.of(user));
        when(rsvpRepository.findByEventIdAndUserId(event.getId(), user.getId())).thenReturn(Optional.empty());
        when(rsvpRepository.countByEventIdAndStatus(event.getId(), RsvpStatus.GOING)).thenReturn(1L);
        when(rsvpRepository.findByEventIdAndStatus(event.getId(), RsvpStatus.WAITLISTED)).thenReturn(List.of());
        when(rsvpRepository.save(any(Rsvp.class))).thenAnswer(inv -> inv.getArgument(0));

        RsvpResponse response = rsvpService.rsvp(event.getId(), principal);

        assertThat(response.status()).isEqualTo(RsvpStatus.WAITLISTED);
        assertThat(response.waitlistOrder()).isEqualTo(1);
    }

    @Test
    void cancelRsvp_notFound_throws() {
        when(rsvpRepository.findByEventIdAndUserId(event.getId(), user.getId())).thenReturn(Optional.empty());

        assertThatThrownBy(() -> rsvpService.cancelRsvp(event.getId(), principal))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("not RSVP");
    }

    @Test
    void cancelRsvp_promotesNextWaitlistedRsvp() {
        Rsvp goingRsvp = Rsvp.builder().id(UUID.randomUUID()).event(event).user(user).status(RsvpStatus.GOING).build();
        User otherUser = User.builder().id(UUID.randomUUID()).name("Other").email("other@example.com").role(Role.STUDENT).build();
        Rsvp waitlisted = Rsvp.builder().id(UUID.randomUUID()).event(event).user(otherUser)
                .status(RsvpStatus.WAITLISTED).waitlistOrder(1).build();

        when(rsvpRepository.findByEventIdAndUserId(event.getId(), user.getId())).thenReturn(Optional.of(goingRsvp));
        when(rsvpRepository.save(any(Rsvp.class))).thenAnswer(inv -> inv.getArgument(0));
        when(rsvpRepository.findByEventIdAndStatusOrderByWaitlistOrderAsc(event.getId(), RsvpStatus.WAITLISTED))
                .thenReturn(List.of(waitlisted));

        rsvpService.cancelRsvp(event.getId(), principal);

        assertThat(goingRsvp.getStatus()).isEqualTo(RsvpStatus.CANCELLED);
        assertThat(waitlisted.getStatus()).isEqualTo(RsvpStatus.GOING);
        assertThat(waitlisted.getWaitlistOrder()).isNull();
        verify(notificationService).notify(any(User.class), any(String.class));
    }
}
