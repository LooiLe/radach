package com.radach.maps.dto;

public record SpotClusterResponse(
        Double latitude,
        Double longitude,
        long count,
        String type
) {
}
