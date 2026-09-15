package com.club.backend.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.math.BigDecimal;
import java.util.Optional;
import java.util.UUID;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import com.club.backend.config.ApiException;
import com.club.backend.dto.CreatePaymentRequest;
import com.club.backend.dto.PaymentResponse;
import com.club.backend.entity.Payment;
import com.club.backend.entity.PaymentStatus;
import com.club.backend.entity.PaymentType;
import com.club.backend.entity.Role;
import com.club.backend.entity.User;
import com.club.backend.repository.PaymentRepository;
import com.club.backend.repository.UserRepository;
import com.club.backend.security.UserPrincipal;

@ExtendWith(MockitoExtension.class)
class PaymentServiceTest {

    @Mock
    private PaymentRepository paymentRepository;
    @Mock
    private UserRepository userRepository;
    @Mock
    private NotificationService notificationService;

    @InjectMocks
    private PaymentService paymentService;

    private User user;
    private UserPrincipal principal;

    @BeforeEach
    void setUp() {
        user = User.builder().id(UUID.randomUUID()).name("Stu").email("stu@example.com").role(Role.STUDENT).build();
        principal = new UserPrincipal(user);
    }

    @Test
    void pay_negativeAmount_throws() {
        CreatePaymentRequest request = new CreatePaymentRequest(PaymentType.EVENT, UUID.randomUUID(), new BigDecimal("-5"));

        assertThatThrownBy(() -> paymentService.pay(request, principal))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("zero or greater");
    }

    @Test
    void pay_missingReference_throws() {
        CreatePaymentRequest request = new CreatePaymentRequest(PaymentType.EVENT, null, BigDecimal.TEN);

        assertThatThrownBy(() -> paymentService.pay(request, principal))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("required");
    }

    @Test
    void pay_success_savesAsSucceededAndNotifiesUser() {
        CreatePaymentRequest request = new CreatePaymentRequest(PaymentType.EVENT, UUID.randomUUID(), BigDecimal.TEN);
        when(userRepository.findById(user.getId())).thenReturn(Optional.of(user));
        when(paymentRepository.save(any(Payment.class))).thenAnswer(inv -> inv.getArgument(0));

        PaymentResponse response = paymentService.pay(request, principal);

        assertThat(response.status()).isEqualTo(PaymentStatus.SUCCESS);
        verify(notificationService).notify(any(User.class), any(String.class));
    }
}
