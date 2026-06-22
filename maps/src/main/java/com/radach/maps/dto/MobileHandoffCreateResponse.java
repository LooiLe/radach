package com.radach.maps.dto;

import java.time.Instant;

public record MobileHandoffCreateResponse(
        String token,
        String handoffPath,
        Instant expiresAt
) {}
