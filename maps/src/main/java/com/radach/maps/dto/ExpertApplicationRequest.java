package com.radach.maps.dto;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record ExpertApplicationRequest(
        @NotBlank @Size(max = 100) String professionalTitle,
        @Size(max = 100) String organization,
        @NotNull @Min(0) Integer yearsExperience,
        @Size(max = 255) String specializations,
        @Size(max = 255) String portfolioUrl,
        @NotBlank @Size(max = 500) String justification
) {}
