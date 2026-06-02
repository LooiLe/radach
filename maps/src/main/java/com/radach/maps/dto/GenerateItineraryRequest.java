package com.radach.maps.dto;

import java.util.List;

public record GenerateItineraryRequest(
        List<String> preferredCategories,
        String reviewSource,
        String date,
        Integer numberOfStops,
        Double centerLatitude,
        Double centerLongitude,
        Double radiusKm,
        String paymentMethod,
        String cancelUrl
) {
    public GenerateItineraryRequest(
            List<String> preferredCategories,
            String reviewSource,
            String date,
            Integer numberOfStops,
            Double centerLatitude,
            Double centerLongitude,
            Double radiusKm,
            String paymentMethod
    ) {
        this(preferredCategories, reviewSource, date, numberOfStops, centerLatitude, centerLongitude, radiusKm, paymentMethod, null);
    }
}
