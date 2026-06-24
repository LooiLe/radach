package com.radach.maps.controller;

import java.util.List;
import java.util.Map;

import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.radach.maps.dto.TopVibeTagDTO;
import com.radach.maps.dto.VibeTagDTO;
import com.radach.maps.model.VibeTagDefinition;
import com.radach.maps.repository.SpotVibeTagRepository;
import com.radach.maps.repository.VibeTagDefinitionRepository;
import com.radach.maps.service.VibeAnalysisService;

@RestController
@RequestMapping("/api/v1/vibe")
public class VibeController {

    private final VibeAnalysisService vibeService;
    private final VibeTagDefinitionRepository vibeDefRepo;
    private final SpotVibeTagRepository spotVibeRepo;

    public VibeController(VibeAnalysisService vibeService, VibeTagDefinitionRepository vibeDefRepo, SpotVibeTagRepository spotVibeRepo) {
        this.vibeService = vibeService;
        this.vibeDefRepo = vibeDefRepo;
        this.spotVibeRepo = spotVibeRepo;
    }

    /** Get all vibe tag definitions. */
    @GetMapping("/definitions")
    public List<VibeTagDefinition> getDefinitions() {
        return vibeDefRepo.findAll();
    }

    /** Get top vibe tags for a given category type. */
    @GetMapping("/top-tags")
    public List<TopVibeTagDTO> getTopTags(
            @RequestParam String type,
            @RequestParam(defaultValue = "8") int limit) {
        if (type == null || type.isBlank() || "all".equalsIgnoreCase(type.trim())) {
            List<Object[]> rows = spotVibeRepo.findTopVibeTags(limit);
            return mapRowsToDTO(rows);
        }

        List<String> dbTypes = new java.util.ArrayList<>();
        String[] tokens = type.split(",");
        for (String token : tokens) {
            dbTypes.addAll(normalizeTypes(token));
        }

        if (dbTypes.isEmpty()) {
            return List.of();
        }

        List<Object[]> rows = spotVibeRepo.findTopVibeTagsBySpotTypes(dbTypes, limit);
        return mapRowsToDTO(rows);
    }

    private List<TopVibeTagDTO> mapRowsToDTO(List<Object[]> rows) {
        return rows.stream().map(row -> new TopVibeTagDTO(
                ((Number) row[0]).longValue(),
                (String) row[1],
                row[2] != null ? (String) row[2] : "",
                row[3] != null ? (String) row[3] : "",
                ((Number) row[4]).longValue()
        )).toList();
    }


    private List<String> normalizeTypes(String type) {
        if (type == null || type.isBlank()) {
            return List.of();
        }
        String norm = type.trim().toLowerCase();
        switch (norm) {
            case "accommodations":
                return List.of("accommodations", "hotel");
            case "activities":
                return List.of("activity", "activities", "attraction", "attractions");
            case "children":
                return List.of("child", "children");
            case "viewpoint":
                return List.of("viewpoint", "viewpoints");
            case "restaurant":
                return List.of("restaurant", "food hall");
            case "cafe":
                return List.of("cafe", "café");
            default:
                return List.of(norm);
        }
    }

    /** Trigger vibe analysis for a specific spot. Manual tags are preserved. */
    @PostMapping("/analyze/{spotId}")
    @PreAuthorize("hasAnyRole('ADMIN', 'SUPER_ADMIN')")
    public ResponseEntity<String> analyzeSpot(@PathVariable Long spotId) {
        vibeService.analyzeSpot(spotId);
        return ResponseEntity.ok("Vibe analysis complete for spot " + spotId);
    }

    /** Trigger vibe analysis for all spots with reviews. Manual tags are preserved. */
    @PostMapping("/analyze-all")
    @PreAuthorize("hasAnyRole('ADMIN', 'SUPER_ADMIN')")
    public ResponseEntity<String> analyzeAll() {
        vibeService.analyzeAllSpots();
        return ResponseEntity.ok("Vibe analysis queued for all spots.");
    }

    /**
     * Admin: manually add a vibe tag to a spot. Idempotent: re-adding the
     * same tag updates its confidence and re-marks it as {@code source="manual"}
     * so it survives future re-analyses.
     *
     * Body: {@code { "vibeTagId": <long>, "confidence": <0..1 optional> }}
     */
    @PostMapping("/spot/{spotId}/tag")
    @PreAuthorize("hasAnyRole('ADMIN', 'SUPER_ADMIN')")
    public ResponseEntity<VibeTagDTO> addManualTag(
            @PathVariable Long spotId,
            @RequestBody Map<String, Object> body) {
        Long vibeTagId = ((Number) body.get("vibeTagId")).longValue();
        Float confidence = body.get("confidence") == null
                ? null
                : ((Number) body.get("confidence")).floatValue();
        var saved = vibeService.addManualTag(spotId, vibeTagId, confidence);
        var def = vibeDefRepo.findById(saved.getVibeTagId()).orElseThrow();
        VibeTagDTO dto = new VibeTagDTO(
                def.getId(),
                def.getName(),
                def.getEmoji(),
                def.getCategory(),
                saved.getConfidence(),
                saved.getSource()
        );
        return ResponseEntity.ok(dto);
    }

    /**
     * Admin: remove a specific vibe tag from a spot. Works for both auto-generated
     * and manual tags.
     */
    @DeleteMapping("/spot/{spotId}/tag/{vibeTagId}")
    @PreAuthorize("hasAnyRole('ADMIN', 'SUPER_ADMIN')")
    public ResponseEntity<Map<String, Object>> removeTag(
            @PathVariable Long spotId,
            @PathVariable Long vibeTagId) {
        boolean removed = vibeService.removeTag(spotId, vibeTagId);
        return ResponseEntity.ok(Map.of("removed", removed));
    }
}
