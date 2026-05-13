package com.radach.maps.controller;

import org.springframework.data.domain.Page;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import com.radach.maps.dto.ReviewRequest;
import com.radach.maps.dto.ReviewResponse;
import com.radach.maps.model.Review.ReviewType;
import com.radach.maps.service.AuthenticatedUserService;
import com.radach.maps.service.ReviewService;

import jakarta.validation.Valid;

@RestController
@RequestMapping("/api/v1/spots/{spotId}/reviews")
public class ReviewController {

    private final ReviewService reviewService;
    private final AuthenticatedUserService authenticatedUserService;

    public ReviewController(ReviewService reviewService, AuthenticatedUserService authenticatedUserService) {
        this.reviewService = reviewService;
        this.authenticatedUserService = authenticatedUserService;
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public ReviewResponse createReview(
            @PathVariable Long spotId,
            @Valid @RequestBody ReviewRequest request,
            Authentication authentication
    ) {
        Long authorId = authenticatedUserService.getUserId(authentication);
        // All reviews start as USER type, pending admin review
        return reviewService.create(spotId, authorId, ReviewType.USER, request);
    }

    @GetMapping
    public Page<ReviewResponse> getReviews(
            @PathVariable Long spotId,
            @RequestParam(required = false) String type,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size
    ) {
        return reviewService.getReviews(spotId, type, page, size);
    }
}