package com.radach.maps.dto;

public record TopVibeTagDTO(
    Long id,
    String name,
    String emoji,
    String category,
    long count
) {}
