package com.radach.maps.controller;

import java.util.List;
import java.util.Map;

import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.radach.maps.dto.SpotResponse;
import com.radach.maps.model.SpotStatus;
import com.radach.maps.service.SpotService;

@RestController
@RequestMapping("/api/v1/admin/spots")
@PreAuthorize("hasAnyRole('ADMIN', 'SUPER_ADMIN')")
public class AdminSpotController {

    private final SpotService spotService;

    public AdminSpotController(SpotService spotService) {
        this.spotService = spotService;
    }

    @GetMapping("/pending")
    public List<SpotResponse> getPendingSpots() {
        return spotService.getPendingSpots();
    }

    @PatchMapping("/{id}/status")
    public SpotResponse updateSpotStatus(@PathVariable Long id, @RequestParam SpotStatus status) {
        return spotService.updateStatus(id, status);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> deleteSpot(@PathVariable Long id) {
        spotService.deleteSpot(id);
        return ResponseEntity.ok(Map.of("message", "Spot deleted successfully"));
    }
}
