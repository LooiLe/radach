package com.radach.maps.controller;

import java.util.List;
import java.util.Map;

import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.radach.maps.dto.ARAnnotationRequest;
import com.radach.maps.dto.ARAnnotationResponse;
import com.radach.maps.service.ARService;

@RestController
@RequestMapping("/api/v1/admin/annotations")
@PreAuthorize("hasAnyRole('ADMIN', 'SUPER_ADMIN')")
public class AdminAnnotationController {

    private final ARService arService;

    public AdminAnnotationController(ARService arService) {
        this.arService = arService;
    }

    @GetMapping
    public List<ARAnnotationResponse> listAnnotations(@RequestParam(required = false) String status) {
        return arService.getAnnotationsByStatus(status);
    }

    @PutMapping("/{id}")
    public ARAnnotationResponse updateAnnotation(
            @PathVariable Long id,
            @RequestBody ARAnnotationRequest request
    ) {
        return arService.updateAnnotation(id, request);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> deleteAnnotation(@PathVariable Long id) {
        arService.deleteAnnotation(id);
        return ResponseEntity.ok(Map.of("message", "Annotation deleted successfully"));
    }
}
