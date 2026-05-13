package com.radach.maps.repository;

import java.util.List;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.radach.maps.model.Review;
import com.radach.maps.model.Review.Status;

public interface ReviewRepository extends JpaRepository<Review, Long> {

    Page<Review> findBySpotIdAndStatus(Long spotId, Status status, Pageable pageable);

    Page<Review> findByAuthorIdAndStatus(Long authorId, Status status, Pageable pageable);

    Page<Review> findBySpotIdAndStatusAndReviewType(
            Long spotId, Status status, Review.ReviewType reviewType, Pageable pageable);

    List<Review> findBySpotIdAndStatus(Long spotId, Status status);

    List<Review> findByStatus(Status status);

    long countBySpotIdAndStatus(Long spotId, Status status);

    long countByAuthorIdAndStatus(Long authorId, Status status);

    @Query("SELECT COALESCE(AVG(r.rating), 0.0) FROM Review r WHERE r.spotId = :spotId AND r.status = 'APPROVED'")
    Double findAverageRatingBySpotId(@Param("spotId") Long spotId);

    /** Batch-fetch average ratings for a list of spot IDs — eliminates N+1 in list endpoints. */
    @Query("SELECT r.spotId, AVG(r.rating) FROM Review r WHERE r.status = 'APPROVED' AND r.spotId IN :spotIds GROUP BY r.spotId")
    List<Object[]> findAverageRatingsBySpotIds(@Param("spotIds") List<Long> spotIds);

    /** Batch-fetch approved review counts per author — eliminates N+1 in review listings. */
    @Query("SELECT r.authorId, COUNT(r) FROM Review r WHERE r.status = 'APPROVED' AND r.authorId IN :authorIds GROUP BY r.authorId")
    List<Object[]> countApprovedByAuthorIds(@Param("authorIds") List<Long> authorIds);

    /**
     * Returns [spotId, authorId, sumOfRatings] for approved reviews.
     * Using SUM(rating) instead of COUNT so that higher-rated reviews
     * contribute proportionally more to the trending score.
     */
    @Query("SELECT r.spotId, r.authorId, SUM(r.rating) FROM Review r WHERE r.status = 'APPROVED' GROUP BY r.spotId, r.authorId")
    List<Object[]> sumApprovedRatingsGroupedBySpotAndAuthor();

    /** Recent approved reviews by a set of author IDs — powers the friend activity feed. */
    @Query(value = """
            SELECT * FROM reviews
            WHERE author_id IN :authorIds AND status = 'APPROVED'
            ORDER BY created_at DESC
            LIMIT :limit
            """, nativeQuery = true)
    List<Review> findRecentByAuthorIds(
            @Param("authorIds") java.util.Collection<Long> authorIds,
            @Param("limit") int limit);

    void deleteBySpotId(Long spotId);
}
