package com.radach.maps.controller;

import java.util.List;

import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.radach.maps.dto.VibeTagDTO;
import com.radach.maps.model.VibeTagDefinition;
import com.radach.maps.repository.VibeTagDefinitionRepository;
import com.radach.maps.service.VibeAnalysisService;

@RestController
@RequestMapping("/api/v1/vibe")
public class VibeController {

    private final VibeAnalysisService vibeService;
    private final VibeTagDefinitionRepository vibeDefRepo;

    public VibeController(VibeAnalysisService vibeService, VibeTagDefinitionRepository vibeDefRepo) {
        this.vibeService = vibeService;
        this.vibeDefRepo = vibeDefRepo;
    }

    /** Get all vibe tag definitions. */
    @GetMapping("/definitions")
    public List<VibeTagDefinition> getDefinitions() {
        return vibeDefRepo.findAll();
    }

    /** Trigger vibe analysis for a specific spot. */
    @PostMapping("/analyze/{spotId}")
    @PreAuthorize("hasAnyRole('ADMIN', 'SUPER_ADMIN')")
    public ResponseEntity<String> analyzeSpot(@PathVariable Long spotId) {
        vibeService.analyzeSpot(spotId);
        return ResponseEntity.ok("Vibe analysis complete for spot " + spotId);
    }

    /** Trigger vibe analysis for all spots with reviews. */
    @PostMapping("/analyze-all")
    @PreAuthorize("hasAnyRole('ADMIN', 'SUPER_ADMIN')")
    public ResponseEntity<String> analyzeAll() {
        vibeService.analyzeAllSpots();
        return ResponseEntity.ok("Vibe analysis queued for all spots.");
    }
}