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

import com.radach.maps.dto.TrailPathResponse;
import com.radach.maps.model.TrailPathStatus;
import com.radach.maps.service.TrailPathService;

@RestController
@RequestMapping("/api/v1/admin/paths")
@PreAuthorize("hasAnyRole('ADMIN', 'SUPER_ADMIN')")
public class AdminTrailPathController {

    private final TrailPathService trailPathService;

    public AdminTrailPathController(TrailPathService trailPathService) {
        this.trailPathService = trailPathService;
    }

    @GetMapping("/pending")
    public List<TrailPathResponse> getPendingPaths() {
        return trailPathService.getPendingPaths();
    }

    @PatchMapping("/{id}/status")
    public TrailPathResponse updatePathStatus(@PathVariable Long id, @RequestParam TrailPathStatus status) {
        return trailPathService.updatePathStatus(id, status);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> deletePath(@PathVariable Long id) {
        trailPathService.deletePath(id, null, true);
        return ResponseEntity.ok(Map.of("message", "Trail path deleted successfully"));
    }
}
