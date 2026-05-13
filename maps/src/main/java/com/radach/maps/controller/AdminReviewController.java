package com.radach.maps.controller;

import java.util.List;

import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.radach.maps.dto.ReviewResponse;
import com.radach.maps.model.Review.ReviewType;
import com.radach.maps.model.Review.Status;
import com.radach.maps.service.ReviewService;

@RestController
@RequestMapping("/api/v1/admin/reviews")
public class AdminReviewController {

    private final ReviewService reviewService;

    public AdminReviewController(ReviewService reviewService) {
        this.reviewService = reviewService;
    }

    @GetMapping("/pending")
    @PreAuthorize("hasAnyRole('ADMIN', 'SUPER_ADMIN')")
    public List<ReviewResponse> getPendingReviews() {
        return reviewService.getPendingReviews();
    }

    @PatchMapping("/{id}/status")
    @PreAuthorize("hasAnyRole('ADMIN', 'SUPER_ADMIN')")
    public ReviewResponse updateStatus(
            @PathVariable Long id,
            @RequestParam Status status,
            @RequestParam(required = false) ReviewType reviewType
    ) {
        return reviewService.updateStatus(id, status, reviewType);
    }
}
