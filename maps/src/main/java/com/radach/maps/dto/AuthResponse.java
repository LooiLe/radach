package com.radach.maps.dto;

public record AuthResponse(String token, Long userId, String role, String refreshToken) {

    /** Backwards-compatible constructor for code that doesn't issue refresh tokens. */
    public AuthResponse(String token, Long userId, String role) {
        this(token, userId, role, null);
    }
}
