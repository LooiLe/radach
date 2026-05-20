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
        @com.fasterxml.jackson.annotation.JsonProperty("isSaved") boolean isSaved,
        Long submitterId,
        String submitterName,
        boolean submitterIsExpert,
        List<VibeTagDTO> vibeTags
) {
    /** Convenience constructor from entity + computed average rating (assumes no interactions). */
    public SpotResponse(Spot spot, Double averageRating) {
        this(spot, averageRating, false, false, null, null, false, List.of());
    }
    
    /** Convenience constructor from entity + computed average rating + user interactions. */
    public SpotResponse(Spot spot, Double averageRating, boolean isLiked, boolean isSaved) {
        this(spot, averageRating, isLiked, isSaved, null, null, false, List.of());
    }

    /** Full constructor with submitter info. */
    public SpotResponse(Spot spot, Double averageRating, boolean isLiked, boolean isSaved, Long submitterId, String submitterName, boolean submitterIsExpert) {
        this(spot, averageRating, isLiked, isSaved, submitterId, submitterName, submitterIsExpert, List.of());
    }

    /** Full constructor with all fields including vibe tags. */
    public SpotResponse(Spot spot, Double averageRating, boolean isLiked, boolean isSaved, Long submitterId, String submitterName, boolean submitterIsExpert, List<VibeTagDTO> vibeTags) {
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
                isSaved,
                submitterId,
                submitterName,
                submitterIsExpert,
                vibeTags
        );
    }
}
