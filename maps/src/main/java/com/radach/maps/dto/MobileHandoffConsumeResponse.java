package com.radach.maps.dto;

public record MobileHandoffConsumeResponse(
        AuthResponse auth,
        String targetPath
) {}
