package com.club.backend.dto;

import com.club.backend.entity.Role;

/** Any field left null is left unchanged. */
public record UpdateUserRequest(String name, String email, Role role) {
}
