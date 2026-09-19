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
import com.club.backend.dto.ClubResourceResponse;
import com.club.backend.dto.CreateClubResourceRequest;
import com.club.backend.entity.Club;
import com.club.backend.entity.ClubResource;
import com.club.backend.entity.Membership;
import com.club.backend.entity.MembershipPosition;
import com.club.backend.entity.MembershipStatus;
import com.club.backend.entity.Role;
import com.club.backend.entity.User;
import com.club.backend.repository.ClubRepository;
import com.club.backend.repository.ClubResourceRepository;
import com.club.backend.repository.MembershipRepository;
import com.club.backend.repository.UserRepository;
import com.club.backend.security.UserPrincipal;

@ExtendWith(MockitoExtension.class)
class ClubResourceServiceTest {

    @Mock
    private ClubResourceRepository resourceRepository;
    @Mock
    private ClubRepository clubRepository;
    @Mock
    private MembershipRepository membershipRepository;
    @Mock
    private UserRepository userRepository;

    @InjectMocks
    private ClubResourceService resourceService;

    private User officer;
    private User president;
    private Club club;
    private UserPrincipal officerPrincipal;

    @BeforeEach
    void setUp() {
        officer = User.builder().id(UUID.randomUUID()).name("Sec").email("sec@example.com").role(Role.STUDENT).build();
        president = User.builder().id(UUID.randomUUID()).name("Pres").email("pres@example.com").role(Role.STUDENT).build();
        club = Club.builder().id(UUID.randomUUID()).name("Chess Club").build();
        officerPrincipal = new UserPrincipal(officer);
    }

    @Test
    void uploadResource_nonOfficer_throws() {
        when(clubRepository.findById(club.getId())).thenReturn(Optional.of(club));
        when(userRepository.findById(officer.getId())).thenReturn(Optional.of(officer));
        when(membershipRepository.findByUserIdAndClubId(officer.getId(), club.getId())).thenReturn(Optional.empty());

        assertThatThrownBy(() -> resourceService.uploadResource(club.getId(),
                new CreateClubResourceRequest("Constitution", "c.pdf", "application/pdf", "data:application/pdf;base64,AAAA"),
                officerPrincipal))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("officers");
    }

    @Test
    void uploadResource_officer_succeeds() {
        Membership secretary = Membership.builder().position(MembershipPosition.SECRETARY)
                .status(MembershipStatus.APPROVED).build();
        when(clubRepository.findById(club.getId())).thenReturn(Optional.of(club));
        when(userRepository.findById(officer.getId())).thenReturn(Optional.of(officer));
        when(membershipRepository.findByUserIdAndClubId(officer.getId(), club.getId())).thenReturn(Optional.of(secretary));
        when(resourceRepository.save(org.mockito.ArgumentMatchers.any(ClubResource.class)))
                .thenAnswer(inv -> inv.getArgument(0));

        ClubResourceResponse response = resourceService.uploadResource(club.getId(),
                new CreateClubResourceRequest("Constitution", "c.pdf", "application/pdf", "data:application/pdf;base64,AAAA"),
                officerPrincipal);

        assertThat(response.title()).isEqualTo("Constitution");
        assertThat(response.fileName()).isEqualTo("c.pdf");
    }

    @Test
    void decodeFileBytes_stripsDataUriPrefix() {
        ClubResource resource = ClubResource.builder().fileB64("data:application/pdf;base64,SGVsbG8=").build();

        byte[] bytes = resourceService.decodeFileBytes(resource);

        assertThat(new String(bytes)).isEqualTo("Hello");
    }

    @Test
    void deleteResource_uploader_succeeds() {
        ClubResource resource = ClubResource.builder().id(UUID.randomUUID()).club(club).uploadedBy(officer).build();
        when(resourceRepository.findById(resource.getId())).thenReturn(Optional.of(resource));

        resourceService.deleteResource(club.getId(), resource.getId(), officerPrincipal);

        verify(resourceRepository).delete(resource);
    }

    @Test
    void deleteResource_otherMember_throwsForbidden() {
        ClubResource resource = ClubResource.builder().id(UUID.randomUUID()).club(club).uploadedBy(officer).build();
        User otherMember = User.builder().id(UUID.randomUUID()).name("Other").role(Role.STUDENT).build();
        when(resourceRepository.findById(resource.getId())).thenReturn(Optional.of(resource));
        when(membershipRepository.findByUserIdAndClubId(otherMember.getId(), club.getId())).thenReturn(Optional.empty());

        assertThatThrownBy(() -> resourceService.deleteResource(club.getId(), resource.getId(), new UserPrincipal(otherMember)))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("uploader or the Club Admin");
    }

    @Test
    void deleteResource_wrongClubInPath_notFound() {
        Club otherClub = Club.builder().id(UUID.randomUUID()).name("Other").build();
        ClubResource resource = ClubResource.builder().id(UUID.randomUUID()).club(otherClub).uploadedBy(officer).build();
        when(resourceRepository.findById(resource.getId())).thenReturn(Optional.of(resource));

        assertThatThrownBy(() -> resourceService.deleteResource(club.getId(), resource.getId(), new UserPrincipal(president)))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("not found");
    }
}
