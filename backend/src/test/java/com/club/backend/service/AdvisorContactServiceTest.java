package com.club.backend.service;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.web.server.ResponseStatusException;

import com.club.backend.dto.AdvisorContactResponse;
import com.club.backend.dto.AdvisorSummaryResponse;
import com.club.backend.dto.ContactAdvisorRequest;
import com.club.backend.entity.Club;
import com.club.backend.entity.Role;
import com.club.backend.entity.User;
import com.club.backend.repository.ClubRepository;
import com.club.backend.repository.UserRepository;
import com.club.backend.security.UserPrincipal;

@ExtendWith(MockitoExtension.class)
class AdvisorContactServiceTest {

    @Mock
    private UserRepository userRepository;

    @Mock
    private ClubRepository clubRepository;

    @Mock
    private NotificationService notificationService;

    @Mock
    private MailService mailService;

    @Mock
    private AuditLogService auditLogService;

    @InjectMocks
    private AdvisorContactService advisorContactService;

    private User student;
    private User advisor1;
    private User advisor2;
    private UserPrincipal principal;

    @BeforeEach
    void setUp() {
        student = User.builder()
                .id(UUID.randomUUID())
                .name("Alex Student")
                .email("alex@example.com")
                .role(Role.STUDENT)
                .active(true)
                .build();

        advisor1 = User.builder()
                .id(UUID.randomUUID())
                .name("Dr. Smith")
                .email("smith@example.com")
                .role(Role.FACULTY_ADVISOR)
                .active(true)
                .build();

        advisor2 = User.builder()
                .id(UUID.randomUUID())
                .name("Prof. Johnson")
                .email("johnson@example.com")
                .role(Role.FACULTY_ADVISOR)
                .active(true)
                .build();

        principal = new UserPrincipal(student);
    }

    @Test
    void getActiveAdvisors_returnsMappedSummaries() {
        when(userRepository.findByRoleAndActiveTrue(Role.FACULTY_ADVISOR))
                .thenReturn(List.of(advisor1, advisor2));

        List<AdvisorSummaryResponse> result = advisorContactService.getActiveAdvisors();

        assertThat(result).hasSize(2);
        assertThat(result.get(0).name()).isEqualTo("Dr. Smith");
        assertThat(result.get(1).name()).isEqualTo("Prof. Johnson");
    }

    @Test
    void contactAdvisor_specificAdvisor_sendsNotificationAndEmail() {
        when(userRepository.findById(student.getId())).thenReturn(Optional.of(student));
        when(userRepository.findById(advisor1.getId())).thenReturn(Optional.of(advisor1));

        ContactAdvisorRequest req = new ContactAdvisorRequest(
                advisor1.getId(),
                null,
                "Budget query",
                "Can you review our proposed budget?"
        );

        AdvisorContactResponse response = advisorContactService.contactAdvisor(principal, req);

        assertThat(response.success()).isTrue();
        assertThat(response.advisorsNotified()).containsExactly("Dr. Smith");

        // Verify advisor notification and email
        verify(notificationService).notifyUsers(eq(List.of(advisor1.getId())), anyString());
        verify(mailService).sendAdvisorContactEmail(
                eq("smith@example.com"),
                eq("Dr. Smith"),
                eq("Alex Student"),
                eq("alex@example.com"),
                eq("Budget query"),
                eq("Can you review our proposed budget?"),
                eq(null)
        );

        // Verify student confirmation notification
        verify(notificationService).notifyUsers(eq(List.of(student.getId())), anyString());

        // Verify audit log
        verify(auditLogService).log(eq(student), eq("CONTACT_ADVISOR"), eq("USER"), eq(advisor1.getId()), anyString());
    }

    @Test
    void contactAdvisor_allAdvisors_whenNoAdvisorIdProvided() {
        when(userRepository.findById(student.getId())).thenReturn(Optional.of(student));
        when(userRepository.findByRoleAndActiveTrue(Role.FACULTY_ADVISOR))
                .thenReturn(List.of(advisor1, advisor2));

        ContactAdvisorRequest req = new ContactAdvisorRequest(
                null,
                null,
                "General inquiry",
                "How do we request room booking assistance?"
        );

        AdvisorContactResponse response = advisorContactService.contactAdvisor(principal, req);

        assertThat(response.success()).isTrue();
        assertThat(response.advisorsNotified()).containsExactly("Dr. Smith", "Prof. Johnson");

        verify(notificationService, times(1)).notifyUsers(eq(List.of(advisor1.getId())), anyString());
        verify(notificationService, times(1)).notifyUsers(eq(List.of(advisor2.getId())), anyString());
        verify(mailService, times(2)).sendAdvisorContactEmail(anyString(), anyString(), anyString(), anyString(), anyString(), anyString(), any());
    }

    @Test
    void contactAdvisor_withClubContext_resolvesClubName() {
        UUID clubId = UUID.randomUUID();
        Club club = Club.builder().id(clubId).name("Robotics Club").build();

        when(userRepository.findById(student.getId())).thenReturn(Optional.of(student));
        when(clubRepository.findById(clubId)).thenReturn(Optional.of(club));
        when(userRepository.findById(advisor1.getId())).thenReturn(Optional.of(advisor1));

        ContactAdvisorRequest req = new ContactAdvisorRequest(
                advisor1.getId(),
                clubId,
                "Event approval",
                "Please approve our hackathon event"
        );

        advisorContactService.contactAdvisor(principal, req);

        verify(mailService).sendAdvisorContactEmail(
                eq("smith@example.com"),
                eq("Dr. Smith"),
                eq("Alex Student"),
                eq("alex@example.com"),
                eq("Event approval"),
                eq("Please approve our hackathon event"),
                eq("Robotics Club")
        );
    }

    @Test
    void contactAdvisor_unauthenticated_throwsUnauthorized() {
        ContactAdvisorRequest req = new ContactAdvisorRequest(null, null, "Hello", "World");
        assertThatThrownBy(() -> advisorContactService.contactAdvisor(null, req))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("User must be authenticated");
    }

    @Test
    void contactAdvisor_deactivatedStudent_throwsForbidden() {
        student.setActive(false);
        when(userRepository.findById(student.getId())).thenReturn(Optional.of(student));

        ContactAdvisorRequest req = new ContactAdvisorRequest(null, null, "Hello", "World");
        assertThatThrownBy(() -> advisorContactService.contactAdvisor(principal, req))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("User account is deactivated");
    }

    @Test
    void contactAdvisor_advisorNotFacultyAdvisor_throwsBadRequest() {
        User notAnAdvisor = User.builder()
                .id(UUID.randomUUID())
                .name("Bob")
                .role(Role.STUDENT)
                .active(true)
                .build();

        when(userRepository.findById(student.getId())).thenReturn(Optional.of(student));
        when(userRepository.findById(notAnAdvisor.getId())).thenReturn(Optional.of(notAnAdvisor));

        ContactAdvisorRequest req = new ContactAdvisorRequest(notAnAdvisor.getId(), null, "Hello", "World");
        assertThatThrownBy(() -> advisorContactService.contactAdvisor(principal, req))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("Selected user is not an active faculty advisor");
    }

    @Test
    void contactAdvisor_noAdvisorsAvailable_throwsBadRequest() {
        when(userRepository.findById(student.getId())).thenReturn(Optional.of(student));
        when(userRepository.findByRoleAndActiveTrue(Role.FACULTY_ADVISOR)).thenReturn(List.of());

        ContactAdvisorRequest req = new ContactAdvisorRequest(null, null, "Hello", "World");
        assertThatThrownBy(() -> advisorContactService.contactAdvisor(principal, req))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("No active faculty advisors currently available");
    }
}
