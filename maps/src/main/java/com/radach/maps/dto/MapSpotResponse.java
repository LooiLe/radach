package com.radach.maps.dto;

import java.util.List;

public record MapSpotResponse(
        Long id,
        String name,
        String type,
        Double latitude,
        Double longitude,
        int rankScore,
        Double averageRating,
        Boolean hasActiveEvent,
        String activeEventCategories,
        List<Long> vibeTagIds
) {
}
