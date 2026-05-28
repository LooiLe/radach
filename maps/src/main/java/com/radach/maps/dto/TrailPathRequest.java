package com.radach.maps.dto;

import java.util.List;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public record TrailPathRequest(
        @NotNull Long spotId,
        @NotBlank String name,
        String description,
        String difficulty,
        Integer estimatedDurationMin,
        Double distanceMeters,
        @NotBlank String geoJson,
        List<String> photos,
        Boolean isPrivate
) {}
