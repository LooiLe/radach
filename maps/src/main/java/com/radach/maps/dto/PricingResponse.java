package com.radach.maps.dto;

public record PricingResponse(
        int oneTimePriceCents,
        int creditPackSmallCents,
        int creditPackSmallQty,
        int creditPackLargeCents,
        int creditPackLargeQty,
        String proMonthlyPriceDisplay,
        int proGenerationsLimit,
        String unlimitedMonthlyPriceDisplay
) {}
