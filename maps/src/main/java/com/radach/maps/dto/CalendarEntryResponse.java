package com.radach.maps.dto;

import java.time.Instant;

public record CalendarEntryResponse(
        Long id,
        Long userId,
        Long eventId,
        String title,
        String description,
        Instant startTime,
        Instant endTime,
        String recurrenceRule,
        String color,
        Instant createdAt
) {}
