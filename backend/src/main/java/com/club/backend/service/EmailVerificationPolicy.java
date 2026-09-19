package com.club.backend.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import com.club.backend.config.ApiException;
import com.club.backend.entity.User;

/**
 * Gates participation (joining clubs, RSVPs, payments, proposing clubs) behind a verified email address.
 * Controlled by {@code app.require-email-verification} so local dev without SMTP isn't locked out.
 */
@Component
public class EmailVerificationPolicy {

    private final boolean required;

    public EmailVerificationPolicy(@Value("${app.require-email-verification:false}") boolean required) {
        this.required = required;
    }

    public boolean isRequired() {
        return required;
    }

    public void requireVerified(User user) {
        if (required && !user.isEmailVerified()) {
            throw ApiException.forbidden("Please verify your email address first — check your inbox for the link");
        }
    }
}
