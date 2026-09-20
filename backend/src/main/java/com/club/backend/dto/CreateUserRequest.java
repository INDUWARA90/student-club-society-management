package com.club.backend.dto;

import com.club.backend.entity.Role;

public record CreateUserRequest(String name, String email, String password, Role role) {
}
