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
    Double globalRating,
    Double expertRating,
    Double friendsRating,
        @com.fasterxml.jackson.annotation.JsonProperty("isLiked") boolean isLiked,
        @com.fasterxml.jackson.annotation.JsonProperty("isSaved") boolean isSaved,
        Long submitterId,
        String submitterName,
        boolean submitterIsExpert,
        List<VibeTagDTO> vibeTags,
        @com.fasterxml.jackson.annotation.JsonProperty("friendLikeCount") int friendLikeCount,
        String activeRatingMode
) {
    /** Convenience constructor from entity + computed average rating (assumes no interactions). */
    public SpotResponse(Spot spot, Double averageRating) {
        this(spot, averageRating, averageRating, averageRating, averageRating, false, false, null, null, false, List.of(), 0, "global");
    }
    
    /** Convenience constructor from entity + computed average rating + user interactions. */
    public SpotResponse(Spot spot, Double averageRating, boolean isLiked, boolean isSaved) {
        this(spot, averageRating, averageRating, averageRating, averageRating, isLiked, isSaved, null, null, false, List.of(), 0, "global");
    }

    /** Full constructor with submitter info. */
    public SpotResponse(Spot spot, Double averageRating, boolean isLiked, boolean isSaved, Long submitterId, String submitterName, boolean submitterIsExpert) {
        this(spot, averageRating, averageRating, averageRating, averageRating, isLiked, isSaved, submitterId, submitterName, submitterIsExpert, List.of(), 0, "global");
    }

    /** Full constructor with all fields including vibe tags. */
    public SpotResponse(Spot spot, Double averageRating, boolean isLiked, boolean isSaved, Long submitterId, String submitterName, boolean submitterIsExpert, List<VibeTagDTO> vibeTags) {
        this(spot, averageRating, averageRating, averageRating, averageRating, isLiked, isSaved, submitterId, submitterName, submitterIsExpert, vibeTags, 0, "global");
    }

    /** Full constructor with all fields including vibe tags and friend like count. */
    public SpotResponse(Spot spot, Double averageRating, boolean isLiked, boolean isSaved, Long submitterId, String submitterName, boolean submitterIsExpert, List<VibeTagDTO> vibeTags, int friendLikeCount) {
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
                averageRating,
                averageRating,
                averageRating,
                isLiked,
                isSaved,
                submitterId,
                submitterName,
                submitterIsExpert,
                vibeTags,
                friendLikeCount,
                "global"
        );
    }

    /** Full constructor with all fields including rating mode. */
    public SpotResponse(Spot spot, Double averageRating, boolean isLiked, boolean isSaved, Long submitterId, String submitterName, boolean submitterIsExpert, List<VibeTagDTO> vibeTags, int friendLikeCount, String activeRatingMode) {
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
                averageRating,
                averageRating,
                averageRating,
                isLiked,
                isSaved,
                submitterId,
                submitterName,
                submitterIsExpert,
                vibeTags,
                friendLikeCount,
                activeRatingMode
        );
    }

    /** Full constructor with all 3 rating values. */
    public SpotResponse(Spot spot, Double averageRating, Double globalRating, Double expertRating, Double friendsRating, boolean isLiked, boolean isSaved, Long submitterId, String submitterName, boolean submitterIsExpert, List<VibeTagDTO> vibeTags, int friendLikeCount, String activeRatingMode) {
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
                globalRating,
                expertRating,
                friendsRating,
                isLiked,
                isSaved,
                submitterId,
                submitterName,
                submitterIsExpert,
                vibeTags,
                friendLikeCount,
                activeRatingMode
        );
    }
}
