package com.radach.maps.dto;

/**
 * Lightweight DTO for vibe tags returned in spot API responses.
 */
public record VibeTagDTO(
    Long id,
    String name,
    String emoji,
    String category,
    float confidence,
    String source
) {}