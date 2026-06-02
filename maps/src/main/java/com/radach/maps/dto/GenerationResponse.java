package com.radach.maps.dto;

import java.time.Instant;

public record GenerationResponse(
        Long id,
        Long itineraryId,
        String status,
        String paymentMethod,
        int amountCents,
        String checkoutUrl,
        Instant createdAt,
        Instant completedAt
) {}
