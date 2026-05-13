package com.radach.maps.dto;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.util.List;

import com.radach.maps.model.SpotStatus;

public record SpotRequest(
        @NotBlank String name,
        @NotBlank String type,
        @NotBlank String address,
        @NotNull @DecimalMin("-90.0") @DecimalMax("90.0") Double latitude,
        @NotNull @DecimalMin("-180.0") @DecimalMax("180.0") Double longitude,
        List<String> tags,
        @NotNull SpotStatus status
) {}
