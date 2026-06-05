package com.radach.maps.dto;

public record MapSpotResponse(
        Long id,
        String name,
        String type,
        Double latitude,
        Double longitude,
        int rankScore
) {
}
