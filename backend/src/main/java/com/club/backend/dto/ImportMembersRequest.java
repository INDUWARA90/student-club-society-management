package com.club.backend.dto;

import java.util.List;

public record ImportMembersRequest(List<String> emails) {
}
