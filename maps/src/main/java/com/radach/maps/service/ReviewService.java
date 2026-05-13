package com.radach.maps.service;

import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.radach.maps.dto.ReviewRequest;
import com.radach.maps.dto.ReviewResponse;
import com.radach.maps.exception.ResourceNotFoundException;
import com.radach.maps.model.Review;
import com.radach.maps.model.Review.ReviewType;
import com.radach.maps.model.Review.Status;
import com.radach.maps.model.User;
import com.radach.maps.repository.ReviewRepository;
import com.radach.maps.repository.UserRepository;

@Service
public class ReviewService {

    private final ReviewRepository reviewRepository;
    private final UserRepository userRepository;
    private final com.radach.maps.repository.SpotRepository spotRepository;

    public ReviewService(ReviewRepository reviewRepository, UserRepository userRepository, com.radach.maps.repository.SpotRepository spotRepository) {
        this.reviewRepository = reviewRepository;
        this.userRepository = userRepository;
        this.spotRepository = spotRepository;
    }

    @Transactional
    public ReviewResponse create(Long spotId, Long authorId, ReviewType reviewType, ReviewRequest request) {
        Review review = new Review();
        review.setSpotId(spotId);
        review.setAuthorId(authorId);
        review.setReviewType(reviewType);
        review.setBody(request.body().trim());
        review.setRating(request.rating());
        // All reviews start as PENDING — admin decides type and approval
        review.setStatus(Status.PENDING);

        Review saved = reviewRepository.save(review);

        User author = userRepository.findById(authorId)
                .orElseThrow(() -> new ResourceNotFoundException("Author not found"));
        long approvedCount = reviewRepository.countByAuthorIdAndStatus(authorId, Status.APPROVED);
        return new ReviewResponse(saved, author.getName(), author.getEmail(), approvedCount);
    }

    public Page<ReviewResponse> getReviews(Long spotId, String type, int page, int size) {
        Pageable pageable = PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "createdAt"));

        Page<Review> reviews;
        if (type != null && !type.isBlank()) {
            ReviewType reviewType = ReviewType.valueOf(type.toUpperCase());
            reviews = reviewRepository.findBySpotIdAndStatusAndReviewType(
                    spotId, Status.APPROVED, reviewType, pageable);
        } else {
            reviews = reviewRepository.findBySpotIdAndStatus(spotId, Status.APPROVED, pageable);
        }

        return enrichReviews(reviews);
    }

    public Page<com.radach.maps.dto.UserReviewResponse> getUserReviews(Long authorId, int page, int size) {
        Pageable pageable = PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "createdAt"));
        Page<Review> reviews = reviewRepository.findByAuthorIdAndStatus(authorId, Status.APPROVED, pageable);

        if (reviews.isEmpty()) return Page.empty(pageable);

        Set<Long> spotIds = reviews.stream().map(Review::getSpotId).collect(Collectors.toSet());
        Map<Long, com.radach.maps.model.Spot> spotsById = spotRepository.findAllById(spotIds).stream()
                .collect(Collectors.toMap(com.radach.maps.model.Spot::getId, Function.identity()));

        return reviews.map(r -> {
            com.radach.maps.model.Spot spot = spotsById.get(r.getSpotId());
            String name = spot != null ? spot.getName() : "Unknown Spot";
            String type = spot != null ? spot.getType() : "Unknown";
            String address = spot != null ? spot.getAddress() : "";
            return new com.radach.maps.dto.UserReviewResponse(r, name, type, address);
        });
    }

    public List<ReviewResponse> getPendingReviews() {
        List<Review> reviews = reviewRepository.findByStatus(Status.PENDING);
        return enrichReviewsList(reviews);
    }

    @Transactional
    public ReviewResponse updateStatus(Long reviewId, Status status, ReviewType reviewType) {
        Review review = reviewRepository.findById(reviewId)
                .orElseThrow(() -> new ResourceNotFoundException("Review not found"));
        review.setStatus(status);
        if (reviewType != null) {
            review.setReviewType(reviewType);
        }
        Review saved = reviewRepository.save(review);

        User author = userRepository.findById(saved.getAuthorId())
                .orElseThrow(() -> new ResourceNotFoundException("Author not found"));
        long approvedCount = reviewRepository.countByAuthorIdAndStatus(saved.getAuthorId(), Status.APPROVED);
        return new ReviewResponse(saved, author.getName(), author.getEmail(), approvedCount);
    }

    /**
     * Batch-enrich a page of reviews with author info and approved counts — 2 queries instead of 2N.
     */
    private Page<ReviewResponse> enrichReviews(Page<Review> reviews) {
        if (reviews.isEmpty()) return reviews.map(r -> new ReviewResponse(r, "Unknown", "", 0));

        Set<Long> authorIds = reviews.stream().map(Review::getAuthorId).collect(Collectors.toSet());

        Map<Long, User> authorsById = userRepository.findAllById(authorIds).stream()
                .collect(Collectors.toMap(User::getId, Function.identity()));

        Map<Long, Long> approvedCounts = reviewRepository.countApprovedByAuthorIds(List.copyOf(authorIds))
                .stream()
                .collect(Collectors.toMap(
                        row -> (Long) row[0],
                        row -> (Long) row[1]
                ));

        return reviews.map(r -> {
            User author = authorsById.get(r.getAuthorId());
            String name = author != null ? author.getName() : "User #" + r.getAuthorId();
            String email = author != null ? author.getEmail() : "";
            long count = approvedCounts.getOrDefault(r.getAuthorId(), 0L);
            return new ReviewResponse(r, name, email, count);
        });
    }

    /** Same batch enrichment for List results. */
    private List<ReviewResponse> enrichReviewsList(List<Review> reviews) {
        if (reviews.isEmpty()) return List.of();

        Set<Long> authorIds = reviews.stream().map(Review::getAuthorId).collect(Collectors.toSet());

        Map<Long, User> authorsById = userRepository.findAllById(authorIds).stream()
                .collect(Collectors.toMap(User::getId, Function.identity()));

        Map<Long, Long> approvedCounts = reviewRepository.countApprovedByAuthorIds(List.copyOf(authorIds))
                .stream()
                .collect(Collectors.toMap(
                        row -> (Long) row[0],
                        row -> (Long) row[1]
                ));

        return reviews.stream().map(r -> {
            User author = authorsById.get(r.getAuthorId());
            String name = author != null ? author.getName() : "User #" + r.getAuthorId();
            String email = author != null ? author.getEmail() : "";
            long count = approvedCounts.getOrDefault(r.getAuthorId(), 0L);
            return new ReviewResponse(r, name, email, count);
        }).toList();
    }
}
