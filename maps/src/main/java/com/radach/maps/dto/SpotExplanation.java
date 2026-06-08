package com.radach.maps.dto;

import java.util.List;

/**
 * Structured explanation for a spot, assembled from reviews, tags, metadata, and optional AI.
 * Used by the AR Explorer feature.
 */
public record SpotExplanation(
        Long spotId,
        String spotName,
        String whatIsThis,
        String whoIsThisFor,
        String quickFact,
        String shouldYouSwitch,
        String friendSays,
        List<String> highlights,
        String visitTip,
        boolean aiEnhanced
) {}
