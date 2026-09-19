package com.club.backend.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import com.club.backend.config.ApiException;
import com.club.backend.dto.RsvpResponse;
import com.club.backend.entity.Club;
import com.club.backend.entity.ClubStatus;
import com.club.backend.entity.Event;
import com.club.backend.entity.PaymentType;
import com.club.backend.entity.Role;
import com.club.backend.entity.Rsvp;
import com.club.backend.entity.RsvpStatus;
import com.club.backend.entity.User;
import com.club.backend.repository.EventRepository;
import com.club.backend.repository.RsvpRepository;
import com.club.backend.repository.UserRepository;
import com.club.backend.security.UserPrincipal;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class RsvpServiceTest {

    @Mock
    private RsvpRepository rsvpRepository;
    @Mock
    private EventRepository eventRepository;
    @Mock
    private UserRepository userRepository;
    @Mock
    private NotificationService notificationService;
    @Mock
    private org.springframework.messaging.simp.SimpMessagingTemplate messagingTemplate;
    @Mock
    private PaymentService paymentService;
    @Mock
    private EmailVerificationPolicy emailVerificationPolicy;

    @InjectMocks
    private RsvpService rsvpService;

    private User user;
    private Event event;
    private UserPrincipal principal;

    @BeforeEach
    void setUp() {
        user = User.builder().id(UUID.randomUUID()).name("Stu").email("stu@example.com").role(Role.STUDENT).build();
        Club club = Club.builder().id(UUID.randomUUID()).name("Chess Club").status(ClubStatus.APPROVED).build();
        event = Event.builder().id(UUID.randomUUID()).club(club).title("Tournament").capacity(1)
                .eventDate(Instant.now().plusSeconds(86_400)).build();
        principal = new UserPrincipal(user);

        when(eventRepository.findByIdForUpdate(event.getId())).thenReturn(Optional.of(event));
        when(userRepository.findById(user.getId())).thenReturn(Optional.of(user));
        when(rsvpRepository.save(any(Rsvp.class))).thenAnswer(inv -> inv.getArgument(0));
    }

    private User otherUser() {
        return User.builder().id(UUID.randomUUID()).name("Other").email("other@example.com").role(Role.STUDENT).build();
    }

    private Rsvp waitlisted(User who, Integer order) {
        return Rsvp.builder().id(UUID.randomUUID()).event(event).user(who)
                .status(RsvpStatus.WAITLISTED).waitlistOrder(order).build();
    }

    @Test
    void rsvp_alreadyRsvpd_throws() {
        when(rsvpRepository.findByEventIdAndUserId(event.getId(), user.getId()))
                .thenReturn(Optional.of(Rsvp.builder().status(RsvpStatus.GOING).build()));

        assertThatThrownBy(() -> rsvpService.rsvp(event.getId(), principal))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("already");
    }

    @Test
    void rsvp_eventCancelled_throws() {
        event.setCancelled(true);

        assertThatThrownBy(() -> rsvpService.rsvp(event.getId(), principal))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("cancelled");
    }

    @Test
    void rsvp_eventAlreadyStarted_throws() {
        event.setEventDate(Instant.now().minusSeconds(60));

        assertThatThrownBy(() -> rsvpService.rsvp(event.getId(), principal))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("already started");
    }

    @Test
    void rsvp_clubNotActive_throws() {
        event.getClub().setArchived(true);

        assertThatThrownBy(() -> rsvpService.rsvp(event.getId(), principal))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("not currently active");
    }

    @Test
    void rsvp_paidEventWithoutPayment_throws() {
        event.setFee(new BigDecimal("50"));
        when(paymentService.hasLivePayment(user.getId(), PaymentType.EVENT, event.getId())).thenReturn(false);

        assertThatThrownBy(() -> rsvpService.rsvp(event.getId(), principal))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("Pay the event fee");
        verify(rsvpRepository, never()).save(any());
    }

    @Test
    void rsvp_paidEventWithPayment_succeeds() {
        event.setFee(new BigDecimal("50"));
        when(paymentService.hasLivePayment(user.getId(), PaymentType.EVENT, event.getId())).thenReturn(true);
        when(rsvpRepository.findByEventIdAndUserId(event.getId(), user.getId())).thenReturn(Optional.empty());

        assertThat(rsvpService.rsvp(event.getId(), principal).status()).isEqualTo(RsvpStatus.GOING);
    }

    @Test
    void rsvp_underCapacity_marksGoing() {
        when(rsvpRepository.findByEventIdAndUserId(event.getId(), user.getId())).thenReturn(Optional.empty());
        when(rsvpRepository.countByEventIdAndStatus(event.getId(), RsvpStatus.GOING)).thenReturn(0L);

        RsvpResponse response = rsvpService.rsvp(event.getId(), principal);

        assertThat(response.status()).isEqualTo(RsvpStatus.GOING);
    }

    @Test
    void rsvp_afterCancelling_reusesTheCancelledRow() {
        Rsvp cancelled = Rsvp.builder().id(UUID.randomUUID()).event(event).user(user).status(RsvpStatus.CANCELLED).build();
        when(rsvpRepository.findByEventIdAndUserId(event.getId(), user.getId())).thenReturn(Optional.of(cancelled));
        when(rsvpRepository.countByEventIdAndStatus(event.getId(), RsvpStatus.GOING)).thenReturn(0L);

        RsvpResponse response = rsvpService.rsvp(event.getId(), principal);

        assertThat(response.status()).isEqualTo(RsvpStatus.GOING);
        assertThat(cancelled.getStatus()).isEqualTo(RsvpStatus.GOING);
    }

    @Test
    void rsvp_atCapacity_marksWaitlisted() {
        when(rsvpRepository.findByEventIdAndUserId(event.getId(), user.getId())).thenReturn(Optional.empty());
        when(rsvpRepository.countByEventIdAndStatus(event.getId(), RsvpStatus.GOING)).thenReturn(1L);
        when(rsvpRepository.findByEventIdAndStatus(event.getId(), RsvpStatus.WAITLISTED)).thenReturn(List.of());

        RsvpResponse response = rsvpService.rsvp(event.getId(), principal);

        assertThat(response.status()).isEqualTo(RsvpStatus.WAITLISTED);
        assertThat(response.waitlistOrder()).isEqualTo(1);
    }

    @Test
    void rsvp_atCapacity_takesNextOrderAfterTheHighestExisting() {
        // Orders 1 and 3 remain (2 dropped out): the newcomer must get 4, not size()+1 = 3 (a duplicate).
        when(rsvpRepository.findByEventIdAndUserId(event.getId(), user.getId())).thenReturn(Optional.empty());
        when(rsvpRepository.countByEventIdAndStatus(event.getId(), RsvpStatus.GOING)).thenReturn(1L);
        when(rsvpRepository.findByEventIdAndStatus(event.getId(), RsvpStatus.WAITLISTED))
                .thenReturn(List.of(waitlisted(otherUser(), 1), waitlisted(otherUser(), 3)));

        RsvpResponse response = rsvpService.rsvp(event.getId(), principal);

        assertThat(response.waitlistOrder()).isEqualTo(4);
    }

    @Test
    void cancelRsvp_notFound_throws() {
        when(rsvpRepository.findByEventIdAndUserId(event.getId(), user.getId())).thenReturn(Optional.empty());

        assertThatThrownBy(() -> rsvpService.cancelRsvp(event.getId(), principal))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("not RSVP");
    }

    @Test
    void cancelRsvp_promotesNextWaitlistedRsvpAndRefunds() {
        Rsvp goingRsvp = Rsvp.builder().id(UUID.randomUUID()).event(event).user(user).status(RsvpStatus.GOING).build();
        Rsvp next = waitlisted(otherUser(), 1);
        Rsvp after = waitlisted(otherUser(), 2);

        when(rsvpRepository.findByEventIdAndUserId(event.getId(), user.getId())).thenReturn(Optional.of(goingRsvp));
        when(rsvpRepository.findByEventIdAndStatusOrderByWaitlistOrderAsc(event.getId(), RsvpStatus.WAITLISTED))
                .thenReturn(List.of(next, after));
        when(rsvpRepository.countByEventIdAndStatus(event.getId(), RsvpStatus.GOING)).thenReturn(0L);

        rsvpService.cancelRsvp(event.getId(), principal);

        assertThat(goingRsvp.getStatus()).isEqualTo(RsvpStatus.CANCELLED);
        assertThat(next.getStatus()).isEqualTo(RsvpStatus.GOING);
        assertThat(next.getWaitlistOrder()).isNull();
        // Whoever is still waiting moves up to position 1.
        assertThat(after.getStatus()).isEqualTo(RsvpStatus.WAITLISTED);
        assertThat(after.getWaitlistOrder()).isEqualTo(1);
        verify(notificationService).notify(next.getUser(), "A spot opened up — you're now going to Tournament!");
        verify(paymentService).refundEventPayment(user.getId(), event, "RSVP cancelled");
    }

    @Test
    void cancelRsvp_whileWaitlisted_closesTheGapInTheQueue() {
        Rsvp mine = waitlisted(user, 1);
        Rsvp behindMe = waitlisted(otherUser(), 2);

        when(rsvpRepository.findByEventIdAndUserId(event.getId(), user.getId())).thenReturn(Optional.of(mine));
        when(rsvpRepository.findByEventIdAndStatusOrderByWaitlistOrderAsc(event.getId(), RsvpStatus.WAITLISTED))
                .thenReturn(List.of(behindMe));
        when(rsvpRepository.countByEventIdAndStatus(event.getId(), RsvpStatus.GOING)).thenReturn(1L);

        rsvpService.cancelRsvp(event.getId(), principal);

        assertThat(mine.getStatus()).isEqualTo(RsvpStatus.CANCELLED);
        assertThat(behindMe.getStatus()).isEqualTo(RsvpStatus.WAITLISTED);
        assertThat(behindMe.getWaitlistOrder()).isEqualTo(1);
    }

    @Test
    void cancelRsvp_afterEventStarted_doesNotRefund() {
        event.setEventDate(Instant.now().minusSeconds(60));
        Rsvp goingRsvp = Rsvp.builder().id(UUID.randomUUID()).event(event).user(user).status(RsvpStatus.GOING).build();
        when(rsvpRepository.findByEventIdAndUserId(event.getId(), user.getId())).thenReturn(Optional.of(goingRsvp));

        rsvpService.cancelRsvp(event.getId(), principal);

        verify(paymentService, never()).refundEventPayment(any(), any(), any());
    }

    @Test
    void promoteFromWaitlist_unlimitedCapacity_promotesEveryone() {
        event.setCapacity(null);
        Rsvp a = waitlisted(otherUser(), 1);
        Rsvp b = waitlisted(otherUser(), 2);
        when(rsvpRepository.findByEventIdAndStatusOrderByWaitlistOrderAsc(event.getId(), RsvpStatus.WAITLISTED))
                .thenReturn(List.of(a, b));

        rsvpService.promoteFromWaitlist(event);

        assertThat(a.getStatus()).isEqualTo(RsvpStatus.GOING);
        assertThat(b.getStatus()).isEqualTo(RsvpStatus.GOING);
    }

    @Test
    void promoteFromWaitlist_raisedCapacity_promotesOnlyAsManyAsFit() {
        event.setCapacity(3);
        Rsvp a = waitlisted(otherUser(), 1);
        Rsvp b = waitlisted(otherUser(), 2);
        Rsvp c = waitlisted(otherUser(), 3);
        when(rsvpRepository.findByEventIdAndStatusOrderByWaitlistOrderAsc(event.getId(), RsvpStatus.WAITLISTED))
                .thenReturn(List.of(a, b, c));
        when(rsvpRepository.countByEventIdAndStatus(event.getId(), RsvpStatus.GOING)).thenReturn(1L);

        rsvpService.promoteFromWaitlist(event);

        assertThat(a.getStatus()).isEqualTo(RsvpStatus.GOING);
        assertThat(b.getStatus()).isEqualTo(RsvpStatus.GOING);
        assertThat(c.getStatus()).isEqualTo(RsvpStatus.WAITLISTED);
        assertThat(c.getWaitlistOrder()).isEqualTo(1);
    }
}
