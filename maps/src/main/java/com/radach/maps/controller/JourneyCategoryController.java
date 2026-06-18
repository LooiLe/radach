package com.radach.maps.controller;

import com.radach.maps.model.JourneyCategory;
import com.radach.maps.repository.JourneyCategoryRepository;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/v1")
public class JourneyCategoryController {

    private final JourneyCategoryRepository journeyCategoryRepository;

    public JourneyCategoryController(JourneyCategoryRepository journeyCategoryRepository) {
        this.journeyCategoryRepository = journeyCategoryRepository;
    }

    @GetMapping("/journey-categories")
    public List<JourneyCategory> getAllJourneyCategories() {
        return journeyCategoryRepository.findAll();
    }

    @PostMapping("/admin/journey-categories")
    @PreAuthorize("hasAnyRole('ADMIN', 'SUPER_ADMIN')")
    public ResponseEntity<?> createJourneyCategory(@RequestBody Map<String, String> body) {
        String name = body.get("name");
        if (name == null || name.trim().isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("error", "Category name is required"));
        }
        name = name.trim();

        if (journeyCategoryRepository.existsByNameIgnoreCase(name)) {
            return ResponseEntity.badRequest().body(Map.of("error", "Category already exists"));
        }

        String iconUrl = body.get("iconUrl");
        if (iconUrl == null || iconUrl.trim().isEmpty()) {
            iconUrl = "/icons/stash--pin-location-light.svg";
        }

        JourneyCategory category = new JourneyCategory();
        category.setName(name);
        category.setIconUrl(iconUrl.trim());
        journeyCategoryRepository.save(category);

        return ResponseEntity.ok(category);
    }

    @PutMapping("/admin/journey-categories/{id}/icon")
    @PreAuthorize("hasAnyRole('ADMIN', 'SUPER_ADMIN')")
    public ResponseEntity<?> updateJourneyCategoryIcon(@PathVariable Long id, @RequestBody Map<String, String> body) {
        JourneyCategory category = journeyCategoryRepository.findById(id).orElse(null);
        if (category == null) {
            return ResponseEntity.notFound().build();
        }
        String iconUrl = body.get("iconUrl");
        if (iconUrl != null && !iconUrl.trim().isEmpty()) {
            category.setIconUrl(iconUrl.trim());
            journeyCategoryRepository.save(category);
        }
        return ResponseEntity.ok(category);
    }

    @DeleteMapping("/admin/journey-categories/{id}")
    @PreAuthorize("hasAnyRole('ADMIN', 'SUPER_ADMIN')")
    public ResponseEntity<?> deleteJourneyCategory(@PathVariable Long id) {
        JourneyCategory category = journeyCategoryRepository.findById(id).orElse(null);
        if (category == null) {
            return ResponseEntity.notFound().build();
        }
        journeyCategoryRepository.deleteById(id);
        return ResponseEntity.ok(Map.of("message", "Category deleted successfully"));
    }
}