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

import jakarta.persistence.EntityManager;
import com.radach.maps.dto.ReviewRequest;
import com.radach.maps.dto.ReviewResponse;
import com.radach.maps.exception.ResourceNotFoundException;
import com.radach.maps.model.Review;
import com.radach.maps.model.Review.ReviewType;
import com.radach.maps.model.Review.Status;
import com.radach.maps.model.User;
import com.radach.maps.repository.ReviewRepository;
import com.radach.maps.repository.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

@Service
public class ReviewService {

    private static final Logger log = LoggerFactory.getLogger(ReviewService.class);

    private final ReviewRepository reviewRepository;
    private final UserRepository userRepository;
    private final com.radach.maps.repository.SpotRepository spotRepository;
    private final VibeAnalysisService vibeService;
    private final EntityManager entityManager;

    public ReviewService(ReviewRepository reviewRepository, UserRepository userRepository, com.radach.maps.repository.SpotRepository spotRepository, VibeAnalysisService vibeService, EntityManager entityManager) {
        this.reviewRepository = reviewRepository;
        this.userRepository = userRepository;
        this.spotRepository = spotRepository;
        this.vibeService = vibeService;
        this.entityManager = entityManager;
    }

    @Transactional
    public ReviewResponse create(Long spotId, Long authorId, ReviewRequest request) {
        // Auto-determine review type from author's expert status
        User author = userRepository.findById(authorId)
                .orElseThrow(() -> new ResourceNotFoundException("Author not found"));
        ReviewType reviewType = author.isExpert() ? ReviewType.EXPERT : ReviewType.USER;

        Review review = new Review();
        review.setSpotId(spotId);
        review.setAuthorId(authorId);
        review.setReviewType(reviewType);
        review.setBody(request.body().trim());
        review.setRating(request.rating().doubleValue());

        // Expert reviews are auto-approved, user reviews go to moderation
        if (author.isExpert()) {
            review.setStatus(Status.APPROVED);
            Review saved = reviewRepository.save(review);
            // Flush and trigger vibe analysis immediately
            entityManager.flush();
            try {
                vibeService.analyzeSpot(spotId);
            } catch (Exception e) {
                log.error("Vibe analysis failed for expert review on spot {}", spotId, e);
            }
            long approvedCount = reviewRepository.countByAuthorIdAndStatus(authorId, Status.APPROVED);
            return new ReviewResponse(saved, author.getName(), author.getEmail(), approvedCount, true, author.getProfilePicture());
        } else {
            review.setStatus(Status.PENDING);
            Review saved = reviewRepository.save(review);
            long approvedCount = reviewRepository.countByAuthorIdAndStatus(authorId, Status.APPROVED);
            return new ReviewResponse(saved, author.getName(), author.getEmail(), approvedCount, false, author.getProfilePicture());
        }
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

    /**
     * Recompute vibe tags for the spot this review belongs to,
     * using ALL approved reviews for that spot.
     */
    private void recomputeVibes(Review review) {
        try {
            vibeService.analyzeSpot(review.getSpotId());
        } catch (Exception e) {
            log.error("Vibe analysis failed for spot {}", review.getSpotId(), e);
        }
    }

    @Transactional
    public ReviewResponse updateStatus(Long reviewId, Status status) {
        Review review = reviewRepository.findById(reviewId)
                .orElseThrow(() -> new ResourceNotFoundException("Review not found"));
        boolean wasApproved = review.getStatus() == Status.APPROVED;
        review.setStatus(status);
        Review saved = reviewRepository.save(review);
        
        // Flush so the status change is visible to the vibe analysis query
        entityManager.flush();

        // Trigger vibe analysis when a review becomes approved OR was approved and got un-approved
        if (status == Status.APPROVED || wasApproved) {
            try {
                recomputeVibes(saved);
            } catch (Exception e) {
                log.warn("Failed to recompute vibe tags for spot {} after review {} status change: {}", 
                    saved.getSpotId(), saved.getId(), e.getMessage());
            }
        }

        // Author may have been deleted; handle gracefully
        User author = userRepository.findById(saved.getAuthorId()).orElse(null);
        String authorName = author != null ? author.getName() : "Deleted User";
        String authorEmail = author != null ? author.getEmail() : "";
        boolean isExpert = author != null && author.isExpert();
        String profilePicture = author != null ? author.getProfilePicture() : null;
        long approvedCount = reviewRepository.countByAuthorIdAndStatus(saved.getAuthorId(), Status.APPROVED);
        return new ReviewResponse(saved, authorName, authorEmail, approvedCount, isExpert, profilePicture);
    }

    /** Edit an existing review. */
    @Transactional
    public ReviewResponse updateReview(Long reviewId, Long requesterId, ReviewRequest request) {
        Review review = reviewRepository.findById(reviewId)
                .orElseThrow(() -> new ResourceNotFoundException("Review not found"));
        if (!review.getAuthorId().equals(requesterId)) {
            throw new org.springframework.security.access.AccessDeniedException("You can only edit your own reviews");
        }
        review.setBody(request.body().trim());
        review.setRating(request.rating().doubleValue());
        Review saved = reviewRepository.save(review);

        // Recompute vibes if this review was already approved
        if (saved.getStatus() == Status.APPROVED) {
            recomputeVibes(saved);
        }

        User author = userRepository.findById(saved.getAuthorId())
                .orElseThrow(() -> new ResourceNotFoundException("Author not found"));
        long approvedCount = reviewRepository.countByAuthorIdAndStatus(saved.getAuthorId(), Status.APPROVED);
        return new ReviewResponse(saved, author.getName(), author.getEmail(), approvedCount, author.isExpert(), author.getProfilePicture());
    }

    /** Delete a review. */
    @Transactional
    public void deleteReview(Long reviewId, Long requesterId) {
        Review review = reviewRepository.findById(reviewId)
                .orElseThrow(() -> new ResourceNotFoundException("Review not found"));
        if (!review.getAuthorId().equals(requesterId)) {
            throw new org.springframework.security.access.AccessDeniedException("You can only delete your own reviews");
        }
        Long spotId = review.getSpotId();
        boolean wasApproved = review.getStatus() == Status.APPROVED;
        reviewRepository.delete(review);

        // Recompute vibes since an approved review was removed — use spotId captured before delete
        if (wasApproved) {
            vibeService.analyzeSpot(spotId);
        }
    }

    /**
     * Batch-enrich a page of reviews with author info and approved counts — 2 queries instead of 2N.
     */
    private Page<ReviewResponse> enrichReviews(Page<Review> reviews) {
        if (reviews.isEmpty()) return reviews.map(r -> new ReviewResponse(r, "Unknown", "", 0, false, null));

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
            boolean isExpert = author != null && author.isExpert();
            String profilePic = author != null ? author.getProfilePicture() : null;
            return new ReviewResponse(r, name, email, count, isExpert, profilePic);
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
            boolean isExpert = author != null && author.isExpert();
            String profilePic = author != null ? author.getProfilePicture() : null;
            return new ReviewResponse(r, name, email, count, isExpert, profilePic);
        }).toList();
    }
}
