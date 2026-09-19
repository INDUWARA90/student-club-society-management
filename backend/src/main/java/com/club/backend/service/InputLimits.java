package com.club.backend.service;

import com.club.backend.config.ApiException;

/** Server-side size caps for user-supplied text and base64 payloads, so the database column size is never the only guard. */
final class InputLimits {

    /** ~2.2 MB of image once decoded (base64 is ~4/3 larger than the bytes). */
    static final int MAX_IMAGE_CHARS = 3_000_000;
    /** ~10 MB of file once decoded. */
    static final int MAX_FILE_CHARS = 14_000_000;
    static final int MAX_ANNOUNCEMENT_CHARS = 5_000;
    static final int MAX_COMMENT_CHARS = 2_000;
    static final int MAX_NOTIFICATION_CHARS = 2_000;

    private InputLimits() {
    }

    static void requireImageSize(String base64, String what) {
        if (base64 != null && base64.length() > MAX_IMAGE_CHARS) {
            throw ApiException.badRequest("The " + what + " is too large — please use an image under 2 MB");
        }
    }

    static void requireMaxChars(String text, int max, String what) {
        if (text != null && text.length() > max) {
            throw ApiException.badRequest(what + " must be " + max + " characters or fewer");
        }
    }

    static String clip(String text, int max) {
        return text != null && text.length() > max ? text.substring(0, max - 1) + "…" : text;
    }
}
