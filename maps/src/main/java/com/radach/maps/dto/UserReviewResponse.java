package com.radach.maps.dto;

import java.time.Instant;
import java.util.List;

import com.radach.maps.model.Review;

public record UserReviewResponse(
        Long id,
        Long spotId,
        String spotName,
        String spotType,
        String spotAddress,
        String reviewType,
        String body,
        Double rating,
        Instant createdAt,
        List<String> mediaUrls
) {
    public UserReviewResponse(Review review, String spotName, String spotType, String spotAddress) {
        this(
                review.getId(),
                review.getSpotId(),
                spotName,
                spotType,
                spotAddress,
                review.getReviewType().name(),
                review.getBody(),
                review.getRating(),
                review.getCreatedAt(),
                review.getMediaUrls()
        );
    }
}
