package com.radach.maps.dto;

import java.util.List;

public record StopResponse(
        Long id,
        int stopOrder,
        Long spotId,
        String spotName,
        String spotType,
        String spotAddress,
        Double spotLatitude,
        Double spotLongitude,
        List<String> spotPhotos,
        Double spotAverageRating,
        String startTime,
        String endTime,
        Integer durationMinutes,
        String notes,
        int dayNumber,
        Integer estimatedCostCents
) {}
