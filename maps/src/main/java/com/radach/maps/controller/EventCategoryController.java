package com.radach.maps.controller;

import com.radach.maps.model.EventCategory;
import com.radach.maps.repository.EventCategoryRepository;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/v1")
public class EventCategoryController {

    private final EventCategoryRepository eventCategoryRepository;

    public EventCategoryController(EventCategoryRepository eventCategoryRepository) {
        this.eventCategoryRepository = eventCategoryRepository;
    }

    @GetMapping("/event-categories")
    public List<EventCategory> getAllEventCategories() {
        return eventCategoryRepository.findAll();
    }

    @PostMapping("/admin/event-categories")
    @PreAuthorize("hasAnyRole('ADMIN', 'SUPER_ADMIN')")
    public ResponseEntity<?> createEventCategory(@RequestBody Map<String, String> body) {
        String name = body.get("name");
        if (name == null || name.trim().isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("error", "Category name is required"));
        }
        name = name.trim();

        if (eventCategoryRepository.existsByNameIgnoreCase(name)) {
            return ResponseEntity.badRequest().body(Map.of("error", "Category already exists"));
        }

        String iconUrl = body.get("iconUrl");
        if (iconUrl == null || iconUrl.trim().isEmpty()) {
            iconUrl = "/icons/stash--pin-location-light.svg";
        }

        EventCategory category = new EventCategory();
        category.setName(name);
        category.setIconUrl(iconUrl.trim());
        eventCategoryRepository.save(category);

        return ResponseEntity.ok(category);
    }

    @PutMapping("/admin/event-categories/{id}/icon")
    @PreAuthorize("hasAnyRole('ADMIN', 'SUPER_ADMIN')")
    public ResponseEntity<?> updateEventCategoryIcon(@PathVariable Long id, @RequestBody Map<String, String> body) {
        EventCategory category = eventCategoryRepository.findById(id).orElse(null);
        if (category == null) {
            return ResponseEntity.notFound().build();
        }
        String iconUrl = body.get("iconUrl");
        if (iconUrl != null && !iconUrl.trim().isEmpty()) {
            category.setIconUrl(iconUrl.trim());
            eventCategoryRepository.save(category);
        }
        return ResponseEntity.ok(category);
    }

    @DeleteMapping("/admin/event-categories/{id}")
    @PreAuthorize("hasAnyRole('ADMIN', 'SUPER_ADMIN')")
    public ResponseEntity<?> deleteEventCategory(@PathVariable Long id) {
        EventCategory category = eventCategoryRepository.findById(id).orElse(null);
        if (category == null) {
            return ResponseEntity.notFound().build();
        }
        if (category.getName().equalsIgnoreCase("Other")) {
            return ResponseEntity.badRequest().body(Map.of("error", "The 'Other' category cannot be deleted"));
        }
        eventCategoryRepository.deleteById(id);
        return ResponseEntity.ok(Map.of("message", "Category deleted successfully"));
    }
}
