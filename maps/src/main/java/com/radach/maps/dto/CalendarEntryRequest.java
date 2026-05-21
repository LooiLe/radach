package com.radach.maps.dto;

import java.time.Instant;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public record CalendarEntryRequest(
        @NotBlank String title,
        String description,
        @NotNull Instant startTime,
        Instant endTime,
        String recurrenceRule,
        String color
) {}
