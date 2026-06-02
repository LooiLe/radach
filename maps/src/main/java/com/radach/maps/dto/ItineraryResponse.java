package com.radach.maps.dto;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

public record ItineraryResponse(
        Long id,
        Long userId,
        String title,
        String description,
        LocalDate date,
        String status,
        String source,
        List<StopResponse> stops,
        int stopCount,
        Instant createdAt,
        Instant updatedAt
) {}
