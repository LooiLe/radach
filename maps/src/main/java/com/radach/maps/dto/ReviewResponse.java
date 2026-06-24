package com.radach.maps.dto;

import java.time.Instant;
import java.util.List;

import com.radach.maps.model.Review;

public record ReviewResponse(
        Long id,
        Long spotId,
        Long authorId,
        String authorName,
        String authorEmail,
        long authorApprovedCount,
        boolean authorIsExpert,
        boolean authorIsAdmin,
        String authorProfilePicture,
        String reviewType,
        String body,
        Double rating,
        String status,
        Instant createdAt,
        List<String> mediaUrls
) {
    /** Convenience constructor from entity + resolved author info. */
    public ReviewResponse(Review review, String authorName, String authorEmail, long authorApprovedCount, boolean authorIsExpert, boolean authorIsAdmin, String authorProfilePicture) {
        this(
                review.getId(),
                review.getSpotId(),
                review.getAuthorId(),
                authorName,
                authorEmail,
                authorApprovedCount,
                authorIsExpert,
                authorIsAdmin,
                authorProfilePicture,
                review.getReviewType().name(),
                review.getBody(),
                review.getRating(),
                review.getStatus().name(),
                review.getCreatedAt(),
                review.getMediaUrls()
        );
    }
}