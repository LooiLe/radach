package com.radach.maps.dto;

import java.util.List;

public record ItineraryRequest(
        String title,
        String description,
        String date,
        String endDate,
        String currency,
        List<StopRequest> stops
) {
    public ItineraryRequest(
            String title,
            String description,
            String date,
            List<StopRequest> stops
    ) {
        this(title, description, date, null, "USD", stops);
    }
}
