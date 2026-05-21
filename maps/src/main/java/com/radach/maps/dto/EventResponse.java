package com.radach.maps.dto;

import java.time.Instant;

public record EventResponse(
        Long id,
        Long spotId,
        String spotName,
        String spotAddress,
        String title,
        String description,
        Instant startTime,
        Instant endTime,
        String recurrenceRule,
        String imageUrl,
        String status,
        Long submittedBy,
        String submitterName,
        int likeCount,
        boolean likedByCurrentUser,
        boolean addedToCalendar,
        Instant createdAt
) {}
