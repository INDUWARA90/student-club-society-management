package com.club.backend.dto;

import static org.junit.jupiter.api.Assertions.assertEquals;

import java.util.UUID;

import org.junit.jupiter.api.Test;

import com.club.backend.entity.User;

class AlumniResponseTest {

    @Test
    void fromIncludesEmailAndProfileImage() {
        User user = User.builder()
                .id(UUID.randomUUID())
                .name("Taylor Alumni")
                .email("taylor@example.com")
                .profileImageB64("data:image/png;base64,encoded-image")
                .graduationYear(2024)
                .build();

        AlumniResponse response = AlumniResponse.from(user);

        assertEquals(user.getEmail(), response.email());
        assertEquals(user.getProfileImageB64(), response.profileImageB64());
    }
}