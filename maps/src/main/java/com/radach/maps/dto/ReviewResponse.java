package com.radach.maps.dto;

import java.time.Instant;

import com.radach.maps.model.Review;

public record ReviewResponse(
        Long id,
        Long spotId,
        Long authorId,
        String authorName,
        String authorEmail,
        long authorApprovedCount,
        boolean authorIsExpert,
        String authorProfilePicture,
        String reviewType,
        String body,
        Double rating,
        String status,
        Instant createdAt
) {
    /** Convenience constructor from entity + resolved author info. */
    public ReviewResponse(Review review, String authorName, String authorEmail, long authorApprovedCount, boolean authorIsExpert, String authorProfilePicture) {
        this(
                review.getId(),
                review.getSpotId(),
                review.getAuthorId(),
                authorName,
                authorEmail,
                authorApprovedCount,
                authorIsExpert,
                authorProfilePicture,
                review.getReviewType().name(),
                review.getBody(),
                review.getRating(),
                review.getStatus().name(),
                review.getCreatedAt()
        );
    }
}
