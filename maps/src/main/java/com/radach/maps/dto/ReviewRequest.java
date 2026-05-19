package com.radach.maps.dto;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public record ReviewRequest(@NotBlank String body, @NotNull @DecimalMin(value = "1.0", inclusive = true) @DecimalMax(value = "5.0", inclusive = true) Double rating) {}