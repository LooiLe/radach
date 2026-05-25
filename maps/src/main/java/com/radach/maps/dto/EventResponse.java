package com.radach.maps.dto;

import java.time.Instant;
import java.util.List;

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
        List<String> imageUrls,
        String status,
        Long submittedBy,
        String submitterName,
        int likeCount,
        boolean likedByCurrentUser,
        boolean addedToCalendar,
        Instant createdAt
) {}
