package com.radach.maps.dto;

import java.util.List;

public record ItineraryRequest(
        String title,
        String description,
        String date,
        List<StopRequest> stops
) {}
