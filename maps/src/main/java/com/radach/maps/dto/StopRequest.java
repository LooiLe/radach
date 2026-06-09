package com.radach.maps.dto;

public record StopRequest(
        Long spotId,
        int stopOrder,
        String startTime,
        String endTime,
        Integer durationMinutes,
        String notes,
        Integer dayNumber,
        Integer estimatedCostCents
) {
    public StopRequest(
            Long spotId,
            int stopOrder,
            String startTime,
            String endTime,
            Integer durationMinutes,
            String notes
    ) {
        this(spotId, stopOrder, startTime, endTime, durationMinutes, notes, 1, null);
    }
}
