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

import com.radach.maps.dto.JourneyResponse;
import com.radach.maps.model.TrailPathStatus;
import com.radach.maps.service.JourneyService;

@RestController
@RequestMapping("/api/v1/admin/journeys")
@PreAuthorize("hasAnyRole('ADMIN', 'SUPER_ADMIN')")
public class AdminJourneyController {

    private final JourneyService journeyService;

    public AdminJourneyController(JourneyService journeyService) {
        this.journeyService = journeyService;
    }

    @GetMapping("/pending")
    public List<JourneyResponse> getPendingPaths() {
        return journeyService.getPendingPaths();
    }

    @PatchMapping("/{id}/status")
    public JourneyResponse updatePathStatus(@PathVariable Long id, @RequestParam TrailPathStatus status) {
        return journeyService.updatePathStatus(id, status);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> deletePath(@PathVariable Long id) {
        journeyService.deletePath(id, null, true);
        return ResponseEntity.ok(Map.of("message", "Journey deleted successfully"));
    }
}