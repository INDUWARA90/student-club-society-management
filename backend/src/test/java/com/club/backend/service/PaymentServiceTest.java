package com.club.backend.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
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
import com.club.backend.dto.CreatePaymentRequest;
import com.club.backend.dto.PaymentResponse;
import com.club.backend.entity.Club;
import com.club.backend.entity.ClubStatus;
import com.club.backend.entity.Event;
import com.club.backend.entity.EventApprovalStatus;
import com.club.backend.entity.Payment;
import com.club.backend.entity.PaymentStatus;
import com.club.backend.entity.PaymentType;
import com.club.backend.entity.Role;
import com.club.backend.entity.User;
import com.club.backend.repository.ClubRepository;
import com.club.backend.repository.EventRepository;
import com.club.backend.repository.PaymentRepository;
import com.club.backend.repository.UserRepository;
import com.club.backend.security.UserPrincipal;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class PaymentServiceTest {

    @Mock
    private PaymentRepository paymentRepository;
    @Mock
    private EventRepository eventRepository;
    @Mock
    private ClubRepository clubRepository;
    @Mock
    private UserRepository userRepository;
    @Mock
    private NotificationService notificationService;
    @Mock
    private EmailVerificationPolicy emailVerificationPolicy;

    @InjectMocks
    private PaymentService paymentService;

    private User user;
    private UserPrincipal principal;
    private Club club;
    private Event event;

    @BeforeEach
    void setUp() {
        user = User.builder().id(UUID.randomUUID()).name("Stu").email("stu@example.com").role(Role.STUDENT).build();
        principal = new UserPrincipal(user);
        club = Club.builder().id(UUID.randomUUID()).name("Chess Club").status(ClubStatus.APPROVED)
                .membershipFee(new BigDecimal("200")).build();
        event = Event.builder().id(UUID.randomUUID()).club(club).title("Hack Night")
                .eventDate(Instant.now().plusSeconds(86_400))
                .fee(new BigDecimal("50")).approvalStatus(EventApprovalStatus.NOT_REQUIRED).build();

        when(userRepository.findById(user.getId())).thenReturn(Optional.of(user));
        when(eventRepository.findById(event.getId())).thenReturn(Optional.of(event));
        when(clubRepository.findById(club.getId())).thenReturn(Optional.of(club));
        when(paymentRepository.save(any(Payment.class))).thenAnswer(inv -> inv.getArgument(0));
    }

    private CreatePaymentRequest eventRequest(BigDecimal clientAmount) {
        return new CreatePaymentRequest(PaymentType.EVENT, event.getId(), clientAmount);
    }

    private CreatePaymentRequest membershipRequest(BigDecimal clientAmount) {
        return new CreatePaymentRequest(PaymentType.MEMBERSHIP, club.getId(), clientAmount);
    }

    private void alreadyPaid(PaymentType type, UUID referenceId) {
        when(paymentRepository.findFirstByUserIdAndTypeAndReferenceIdAndStatusAndRefundedAtIsNull(
                user.getId(), type, referenceId, PaymentStatus.SUCCESS))
                .thenReturn(Optional.of(Payment.builder().user(user).amount(BigDecimal.TEN).build()));
    }

    @Test
    void pay_missingReference_throws() {
        assertThatThrownBy(() -> paymentService.pay(new CreatePaymentRequest(PaymentType.EVENT, null, BigDecimal.TEN), principal))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("required");
    }

    @Test
    void pay_unverifiedEmail_isBlocked() {
        doThrow(ApiException.forbidden("Please verify your email address first"))
                .when(emailVerificationPolicy).requireVerified(user);

        assertThatThrownBy(() -> paymentService.pay(eventRequest(null), principal))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("verify your email");
        verify(paymentRepository, never()).save(any());
    }

    @Test
    void pay_event_notApproved_throws() {
        event.setApprovalStatus(EventApprovalStatus.PENDING);

        assertThatThrownBy(() -> paymentService.pay(eventRequest(null), principal))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("not open for payment");
    }

    @Test
    void pay_event_cancelled_throws() {
        event.setCancelled(true);

        assertThatThrownBy(() -> paymentService.pay(eventRequest(null), principal))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("cancelled");
    }

    @Test
    void pay_event_alreadyStarted_throws() {
        event.setEventDate(Instant.now().minusSeconds(60));

        assertThatThrownBy(() -> paymentService.pay(eventRequest(null), principal))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("already started");
    }

    @Test
    void pay_event_noFee_throws() {
        event.setFee(BigDecimal.ZERO);

        assertThatThrownBy(() -> paymentService.pay(eventRequest(null), principal))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("no fee");
    }

    @Test
    void pay_event_alreadyPaid_throws() {
        alreadyPaid(PaymentType.EVENT, event.getId());

        assertThatThrownBy(() -> paymentService.pay(eventRequest(null), principal))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("already paid");
    }

    @Test
    void pay_event_ignoresClientAmount_usesEventFee() {
        // A client-supplied amount far below the real fee must not be trusted.
        PaymentResponse response = paymentService.pay(eventRequest(new BigDecimal("0.01")), principal);

        assertThat(response.amount()).isEqualByComparingTo(event.getFee());
        assertThat(response.status()).isEqualTo(PaymentStatus.SUCCESS);
        // Regression: the confirmation used to say "Payment of null" because it read the (absent) client amount.
        verify(notificationService).notify(eq(user), eq("Payment of 50 confirmed for \"Hack Night\"."));
    }

    @Test
    void pay_membership_clubNotActive_throws() {
        club.setArchived(true);

        assertThatThrownBy(() -> paymentService.pay(membershipRequest(BigDecimal.TEN), principal))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("not found");
    }

    @Test
    void pay_membership_clubWithoutFee_throws() {
        club.setMembershipFee(BigDecimal.ZERO);

        assertThatThrownBy(() -> paymentService.pay(membershipRequest(BigDecimal.TEN), principal))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("no membership fee");
    }

    @Test
    void pay_membership_alreadyPaid_throws() {
        alreadyPaid(PaymentType.MEMBERSHIP, club.getId());

        assertThatThrownBy(() -> paymentService.pay(membershipRequest(null), principal))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("already paid");
    }

    @Test
    void pay_membership_ignoresClientAmount_usesClubFee() {
        PaymentResponse response = paymentService.pay(membershipRequest(new BigDecimal("1")), principal);

        assertThat(response.amount()).isEqualByComparingTo("200");
        assertThat(response.status()).isEqualTo(PaymentStatus.SUCCESS);
    }

    @Test
    void refundEventPayment_marksRefundedAndNotifies() {
        Payment payment = Payment.builder().user(user).type(PaymentType.EVENT).referenceId(event.getId())
                .amount(new BigDecimal("50")).status(PaymentStatus.SUCCESS).build();
        when(paymentRepository.findFirstByUserIdAndTypeAndReferenceIdAndStatusAndRefundedAtIsNull(
                user.getId(), PaymentType.EVENT, event.getId(), PaymentStatus.SUCCESS)).thenReturn(Optional.of(payment));

        boolean refunded = paymentService.refundEventPayment(user.getId(), event, "RSVP cancelled");

        assertThat(refunded).isTrue();
        assertThat(payment.isRefunded()).isTrue();
        verify(notificationService).notify(eq(user), any(String.class));
    }

    @Test
    void refundEventPayment_nothingPaid_returnsFalse() {
        when(paymentRepository.findFirstByUserIdAndTypeAndReferenceIdAndStatusAndRefundedAtIsNull(
                user.getId(), PaymentType.EVENT, event.getId(), PaymentStatus.SUCCESS)).thenReturn(Optional.empty());

        assertThat(paymentService.refundEventPayment(user.getId(), event, "x")).isFalse();
        verify(notificationService, never()).notify(any(User.class), any(String.class));
    }

    @Test
    void refundAllForEvent_refundsEveryLivePayment() {
        Payment first = Payment.builder().user(user).amount(BigDecimal.TEN).status(PaymentStatus.SUCCESS).build();
        Payment second = Payment.builder().user(user).amount(BigDecimal.ONE).status(PaymentStatus.SUCCESS).build();
        when(paymentRepository.findByTypeAndReferenceIdAndStatusAndRefundedAtIsNull(
                PaymentType.EVENT, event.getId(), PaymentStatus.SUCCESS)).thenReturn(List.of(first, second));

        int count = paymentService.refundAllForEvent(event, "event cancelled");

        assertThat(count).isEqualTo(2);
        assertThat(first.isRefunded()).isTrue();
        assertThat(second.isRefunded()).isTrue();
    }
}
