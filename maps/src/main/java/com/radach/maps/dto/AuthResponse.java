package com.radach.maps.dto;

public record AuthResponse(String token, Long userId, String role, String refreshToken, boolean isExpert, boolean onboardingCompleted) {

    /** Backwards-compatible constructor for code that doesn't issue refresh tokens. */
    public AuthResponse(String token, Long userId, String role) {
        this(token, userId, role, null, false, false);
    }

    /** Constructor without expert flag (defaults to false). */
    public AuthResponse(String token, Long userId, String role, String refreshToken) {
        this(token, userId, role, refreshToken, false, false);
    }

    /** Constructor without onboarding flag (defaults to false). */
    public AuthResponse(String token, Long userId, String role, String refreshToken, boolean isExpert) {
        this(token, userId, role, refreshToken, isExpert, false);
    }
}
