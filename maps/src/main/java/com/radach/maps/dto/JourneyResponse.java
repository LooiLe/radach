package com.radach.maps.dto;

import java.time.Instant;
import java.util.List;

public record JourneyResponse(
        Long id,
        Long spotId,
        String spotName,
        Long submittedBy,
        String submitterName,
        String name,
        String description,
        String difficulty,
        Integer estimatedDurationMin,
        Double distanceMeters,
        String geoJson,
        List<String> photos,
        String status,
        boolean isPrivate,
        int upvoteCount,
        boolean isUpvoted,
        Instant createdAt,
        Long journeyCategoryId,
        String journeyCategoryName
) {}
