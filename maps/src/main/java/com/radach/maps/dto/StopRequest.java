package com.radach.maps.dto;

public record StopRequest(
        Long spotId,
        int stopOrder,
        String startTime,
        String endTime,
        Integer durationMinutes,
        String notes
) {}
