package com.club.backend.dto;

/** Simple error body — no fixed envelope/format beyond a message string, per project convention. */
public record ErrorResponse(String message) {
}
