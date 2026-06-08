package com.radach.maps.controller;

import java.util.Arrays;
import java.util.List;

import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.radach.maps.dto.SpotExplanation;
import com.radach.maps.dto.SpotResponse;
import com.radach.maps.service.ARService;
import com.radach.maps.service.AuthenticatedUserService;

@RestController
@RequestMapping("/api/v1/ar")
public class ARController {
    private final ARService arService;
    private final AuthenticatedUserService authenticatedUserService;

    public ARController(ARService arService, AuthenticatedUserService authenticatedUserService) {
        this.arService = arService;
        this.authenticatedUserService = authenticatedUserService;
    }

    @GetMapping("/nearby")
    public List<SpotResponse> nearby(
            @RequestParam double lat,
            @RequestParam double lng,
            @RequestParam(required = false) Integer radiusM,
            @RequestParam(required = false) String excludeIds
    ) {
        return arService.findNearbySpots(lat, lng, radiusM, parseIds(excludeIds));
    }

    @GetMapping("/alternatives")
    public List<SpotResponse> alternatives(
            @RequestParam Long spotId,
            @RequestParam double lat,
            @RequestParam double lng,
            @RequestParam(required = false) Integer radiusM
    ) {
        return arService.findAlternatives(spotId, lat, lng, radiusM);
    }

    @GetMapping("/explain")
    public SpotExplanation explain(
            @RequestParam Long spotId,
            @RequestParam(required = false) Long itineraryId,
            Authentication auth
    ) {
        return arService.buildExplanation(spotId, getUserIdOrNull(auth), itineraryId);
    }

    private Long getUserIdOrNull(Authentication auth) {
        if (auth == null || !auth.isAuthenticated() || "anonymousUser".equals(auth.getName())) {
            return null;
        }
        try {
            return authenticatedUserService.getUserId(auth);
        } catch (Exception ignored) {
            return null;
        }
    }

    private List<Long> parseIds(String rawIds) {
        if (rawIds == null || rawIds.isBlank()) {
            return List.of();
        }
        return Arrays.stream(rawIds.split(","))
                .map(String::trim)
                .filter(value -> !value.isBlank())
                .map(Long::parseLong)
                .toList();
    }
}
