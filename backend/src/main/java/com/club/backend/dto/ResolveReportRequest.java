package com.club.backend.dto;

/** {@code action} is DISMISS (leave the comment) or DELETE_COMMENT (remove it). */
public record ResolveReportRequest(String action) {
}
