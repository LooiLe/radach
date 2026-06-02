package com.radach.maps.dto;

import java.time.Instant;

public record CalendarEntryResponse(
        Long id,
        Long userId,
        Long eventId,
        Long spotId,
        String title,
        String description,
        String location,
        Instant startTime,
        Instant endTime,
        String recurrenceRule,
        String color,
        Instant createdAt
) {}
