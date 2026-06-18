package com.radach.maps.dto;

import java.time.Instant;
import java.util.List;

public record NearbyFeedPostResponse(
    Long id,
    Long authorId,
    String authorName,
    String authorProfilePicture,
    String content,
    List<String> mediaUrls,
    Long spotId,
    String spotName,
    double latitude,
    double longitude,
    Instant createdAt
) {}
