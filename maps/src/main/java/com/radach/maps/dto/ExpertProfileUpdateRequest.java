package com.radach.maps.dto;

import jakarta.validation.constraints.Size;

public record ExpertProfileUpdateRequest(
        @Size(max = 500) String bio,
        Boolean privateAccount,
        @Size(max = 100) String professionalTitle,
        @Size(max = 100) String organization,
        Integer yearsExperience,
        @Size(max = 255) String specializations,
        @Size(max = 255) String portfolioUrl,
        @Size(max = 255) String profilePicture
) {}
