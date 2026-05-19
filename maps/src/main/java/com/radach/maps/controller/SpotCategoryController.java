package com.radach.maps.controller;

import com.radach.maps.model.SpotCategory;
import com.radach.maps.repository.SpotCategoryRepository;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/v1")
public class SpotCategoryController {

    private final SpotCategoryRepository categoryRepository;

    public SpotCategoryController(SpotCategoryRepository categoryRepository) {
        this.categoryRepository = categoryRepository;
    }

    @GetMapping("/categories")
    public List<SpotCategory> getAllCategories() {
        return categoryRepository.findAll();
    }

    @PostMapping("/admin/categories")
    @PreAuthorize("hasAnyRole('ADMIN', 'SUPER_ADMIN')")
    public ResponseEntity<?> createCategory(@RequestBody Map<String, String> body) {
        String name = body.get("name");
        if (name == null || name.trim().isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("error", "Category name is required"));
        }
        name = name.trim();

        if (categoryRepository.existsByNameIgnoreCase(name)) {
            return ResponseEntity.badRequest().body(Map.of("error", "Category already exists"));
        }

        String iconUrl = body.get("iconUrl");
        if (iconUrl == null || iconUrl.trim().isEmpty()) {
            iconUrl = "/icons/stash--pin-location-light.svg";
        }

        SpotCategory category = new SpotCategory();
        category.setName(name);
        category.setIconUrl(iconUrl.trim());
        categoryRepository.save(category);

        return ResponseEntity.ok(category);
    }

    @PutMapping("/admin/categories/{id}/icon")
    @PreAuthorize("hasAnyRole('ADMIN', 'SUPER_ADMIN')")
    public ResponseEntity<?> updateCategoryIcon(@PathVariable Long id, @RequestBody Map<String, String> body) {
        SpotCategory category = categoryRepository.findById(id).orElse(null);
        if (category == null) {
            return ResponseEntity.notFound().build();
        }
        String iconUrl = body.get("iconUrl");
        if (iconUrl != null && !iconUrl.trim().isEmpty()) {
            category.setIconUrl(iconUrl.trim());
            categoryRepository.save(category);
        }
        return ResponseEntity.ok(category);
    }

    @DeleteMapping("/admin/categories/{id}")
    @PreAuthorize("hasAnyRole('ADMIN', 'SUPER_ADMIN')")
    public ResponseEntity<?> deleteCategory(@PathVariable Long id) {
        SpotCategory category = categoryRepository.findById(id).orElse(null);
        if (category == null) {
            return ResponseEntity.notFound().build();
        }
        if (category.getName().equalsIgnoreCase("Other")) {
            return ResponseEntity.badRequest().body(Map.of("error", "The 'Other' category cannot be deleted"));
        }
        categoryRepository.deleteById(id);
        return ResponseEntity.ok(Map.of("message", "Category deleted successfully"));
    }
}
