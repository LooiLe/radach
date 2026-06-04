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
        Boolean strictCategories,
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
        this(preferredCategories, reviewSource, date, numberOfStops, centerLatitude, centerLongitude, radiusKm, paymentMethod, false, null);
    }

    public GenerateItineraryRequest(
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
        this(preferredCategories, reviewSource, date, numberOfStops, centerLatitude, centerLongitude, radiusKm, paymentMethod, false, cancelUrl);
    }

    public boolean strictCategoryMode() {
        return Boolean.TRUE.equals(strictCategories);
    }
}
