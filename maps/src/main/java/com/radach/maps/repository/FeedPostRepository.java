package com.radach.maps.repository;

import com.radach.maps.model.FeedPost;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Collection;
import java.util.List;

@Repository
public interface FeedPostRepository extends JpaRepository<FeedPost, Long> {
    List<FeedPost> findByAuthorIdInOrderByCreatedAtDesc(Collection<Long> authorIds);
    List<FeedPost> findByAuthorIdOrderByCreatedAtDesc(Long authorId);
    List<FeedPost> findAllByOrderByCreatedAtDesc();

    @org.springframework.data.jpa.repository.Query(value = """
            SELECT fp.* FROM feed_posts fp
            JOIN spots s ON fp.spot_id = s.id
            WHERE fp.author_id IN :authorIds
              AND (6371.0 * 2.0 * asin(
                  sqrt(
                      power(sin(radians(s.latitude - :lat) / 2.0), 2.0)
                      + cos(radians(:lat)) * cos(radians(s.latitude))
                      * power(sin(radians(s.longitude - :lng) / 2.0), 2.0)
                  )
              )) <= :radiusKm
            ORDER BY fp.created_at DESC
            """, nativeQuery = true)
    List<FeedPost> findNearbyPostsByAuthorIds(
            @org.springframework.data.repository.query.Param("authorIds") Collection<Long> authorIds,
            @org.springframework.data.repository.query.Param("lat") double lat,
            @org.springframework.data.repository.query.Param("lng") double lng,
            @org.springframework.data.repository.query.Param("radiusKm") double radiusKm
    );
}
