package com.club.backend.dto;

import java.util.List;

public record ImportMembersResponse(int imported, List<String> skipped) {
}
