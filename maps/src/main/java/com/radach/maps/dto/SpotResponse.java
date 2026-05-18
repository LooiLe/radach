package com.radach.maps.dto;

import java.time.Instant;
import java.util.List;

import com.radach.maps.model.Spot;

public record SpotResponse(
        Long id,
        String name,
        String type,
        String address,
        Double latitude,
        Double longitude,
        List<String> tags,
        List<String> photos,
        String websiteUrl,
        String status,
        int rankScore,
        Instant createdAt,
        Double averageRating,
        @com.fasterxml.jackson.annotation.JsonProperty("isLiked") boolean isLiked,
        @com.fasterxml.jackson.annotation.JsonProperty("isSaved") boolean isSaved
) {
    /** Convenience constructor from entity + computed average rating (assumes no interactions). */
    public SpotResponse(Spot spot, Double averageRating) {
        this(
                spot.getId(),
                spot.getName(),
                spot.getType(),
                spot.getAddress(),
                spot.getLatitude(),
                spot.getLongitude(),
                spot.getTags(),
                spot.getPhotos(),
                spot.getWebsiteUrl(),
                spot.getStatus().name(),
                spot.getRankScore(),
                spot.getCreatedAt(),
                averageRating,
                false,
                false
        );
    }
    
    /** Convenience constructor from entity + computed average rating + user interactions. */
    public SpotResponse(Spot spot, Double averageRating, boolean isLiked, boolean isSaved) {
        this(
                spot.getId(),
                spot.getName(),
                spot.getType(),
                spot.getAddress(),
                spot.getLatitude(),
                spot.getLongitude(),
                spot.getTags(),
                spot.getPhotos(),
                spot.getWebsiteUrl(),
                spot.getStatus().name(),
                spot.getRankScore(),
                spot.getCreatedAt(),
                averageRating,
                isLiked,
                isSaved
        );
    }
}
