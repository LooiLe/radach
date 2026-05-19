package com.radach.maps.dto;

public record AuthResponse(String token, Long userId, String role, String refreshToken, boolean isExpert) {

    /** Backwards-compatible constructor for code that doesn't issue refresh tokens. */
    public AuthResponse(String token, Long userId, String role) {
        this(token, userId, role, null, false);
    }

    /** Constructor without expert flag (defaults to false). */
    public AuthResponse(String token, Long userId, String role, String refreshToken) {
        this(token, userId, role, refreshToken, false);
    }
}
