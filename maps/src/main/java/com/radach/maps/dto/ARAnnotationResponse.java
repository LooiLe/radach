package com.radach.maps.dto;

import java.time.Instant;

/**
 * Response DTO for AR annotations — used in the AR view and admin dashboard.
 */
public record ARAnnotationResponse(
        Long id,
        Double latitude,
        Double longitude,
        Double radiusMeters,
        Double bearing,
        String title,
        String description,
        String photoUrl,
        Long authorId,
        String authorName,
        boolean authorIsExpert,
        String status,
        Instant createdAt,
        Instant approvedAt
) {}
