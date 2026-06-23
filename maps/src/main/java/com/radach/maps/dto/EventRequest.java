package com.radach.maps.dto;

import java.time.Instant;
import java.util.List;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public record EventRequest(
        @NotNull Long spotId,
        @NotBlank String title,
        String description,
        @NotNull Instant startTime,
        Instant endTime,
        String recurrenceRule,
        List<String> imageUrls,
        String category
) {}
