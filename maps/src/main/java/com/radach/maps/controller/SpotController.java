package com.radach.maps.controller;

import java.util.List;

import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.radach.maps.dto.SpotRequest;
import com.radach.maps.dto.SpotResponse;
import com.radach.maps.service.SpotService;

import jakarta.validation.Valid;

@RestController
@RequestMapping("/api/v1/spots")
public class SpotController {

    private final SpotService spotService;
    private final com.radach.maps.service.AuthenticatedUserService authenticatedUserService;

    public SpotController(SpotService spotService, com.radach.maps.service.AuthenticatedUserService authenticatedUserService) {
        this.spotService = spotService;
        this.authenticatedUserService = authenticatedUserService;
    }

    private Long getUserIdOrNull(org.springframework.security.core.Authentication auth) {
        if (auth != null && auth.isAuthenticated() && !auth.getName().equals("anonymousUser")) {
            try {
                return authenticatedUserService.getUserId(auth);
            } catch (org.springframework.web.server.ResponseStatusException e) {
                // If it's a 401, propagate it so the frontend catches it and logs out
                if (e.getStatusCode() == org.springframework.http.HttpStatus.UNAUTHORIZED) {
                    throw e;
                }
            } catch (Exception e) {
                // ignore
            }
        }
        return null;
    }

    @GetMapping
    public List<SpotResponse> getSpots(
            @RequestParam(required = false) Double lat,
            @RequestParam(required = false) Double lng,
            @RequestParam(required = false) Double radiusKm,
            @RequestParam(required = false, defaultValue = "popularity") String sortBy,
            org.springframework.security.core.Authentication auth
    ) {
        return spotService.findSpots(lat, lng, radiusKm, sortBy, getUserIdOrNull(auth));
    }

    @GetMapping("/trending")
    public List<SpotResponse> getTrending(
            @RequestParam(required = false) Double lat,
            @RequestParam(required = false) Double lng,
            @RequestParam(required = false) Double radiusKm,
            @RequestParam(required = false, defaultValue = "personalized") String type,
            org.springframework.security.core.Authentication auth) {
        return spotService.getTrending(getUserIdOrNull(auth), lat, lng, radiusKm, type);
    }

    @GetMapping("/search")
    public List<SpotResponse> searchSpots(
            @RequestParam String q,
            @RequestParam(required = false) Integer limit,
            org.springframework.security.core.Authentication auth
    ) {
        return spotService.search(q, limit, getUserIdOrNull(auth));
    }

    @GetMapping("/{id}")
    public SpotResponse getSpot(@PathVariable Long id, org.springframework.security.core.Authentication auth) {
        return spotService.findById(id, getUserIdOrNull(auth));
    }

    @GetMapping("/saved")
    @PreAuthorize("isAuthenticated()")
    public List<SpotResponse> getSavedSpots(org.springframework.security.core.Authentication auth) {
        Long userId = getUserIdOrNull(auth);
        if (userId == null) throw new org.springframework.web.server.ResponseStatusException(org.springframework.http.HttpStatus.UNAUTHORIZED, "Not authenticated");
        return spotService.getSavedSpots(userId);
    }

    @PostMapping("/{id}/like")
    @PreAuthorize("isAuthenticated()")
    public SpotResponse toggleLike(@PathVariable Long id, org.springframework.security.core.Authentication auth) {
        Long userId = getUserIdOrNull(auth);
        if (userId == null) throw new org.springframework.web.server.ResponseStatusException(org.springframework.http.HttpStatus.UNAUTHORIZED, "Not authenticated");
        return spotService.toggleLike(id, userId);
    }

    @PostMapping("/{id}/save")
    @PreAuthorize("isAuthenticated()")
    public SpotResponse toggleSave(@PathVariable Long id, org.springframework.security.core.Authentication auth) {
        Long userId = getUserIdOrNull(auth);
        if (userId == null) throw new org.springframework.web.server.ResponseStatusException(org.springframework.http.HttpStatus.UNAUTHORIZED, "Not authenticated");
        return spotService.toggleSave(id, userId);
    }

    @PostMapping
    @PreAuthorize("isAuthenticated()")
    public SpotResponse createSpot(@Valid @RequestBody SpotRequest request, org.springframework.security.core.Authentication auth) {
        boolean isAdmin = auth.getAuthorities().stream().anyMatch(a -> a.getAuthority().equals("ROLE_ADMIN") || a.getAuthority().equals("ROLE_SUPER_ADMIN"));
        return spotService.create(request, isAdmin, getUserIdOrNull(auth));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN', 'SUPER_ADMIN')")
    public SpotResponse updateSpot(@PathVariable Long id, @Valid @RequestBody SpotRequest request) {
        return spotService.update(id, request);
    }

    @org.springframework.web.bind.annotation.DeleteMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN', 'SUPER_ADMIN')")
    public org.springframework.http.ResponseEntity<Void> deleteSpot(@PathVariable Long id) {
        spotService.deleteSpot(id);
        return org.springframework.http.ResponseEntity.noContent().build();
    }
}
