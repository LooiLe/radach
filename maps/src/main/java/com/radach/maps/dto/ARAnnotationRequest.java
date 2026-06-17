package com.radach.maps.dto;

/**
 * Request body for submitting a new AR annotation.
 */
public record ARAnnotationRequest(
        Double latitude,
        Double longitude,
        Double bearing,      // optional: compass direction to look
        String title,
        String description,
        String photoUrl,     // optional: reference photo
        Double radiusMeters  // optional: detection/visibility radius
) {}

