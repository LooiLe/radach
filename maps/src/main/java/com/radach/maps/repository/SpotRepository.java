package com.radach.maps.repository;

import java.time.Instant;
import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.radach.maps.model.Spot;

public interface SpotRepository extends JpaRepository<Spot, Long> {

    @Query(value = """
            select *
            from spots
            where (
                6371.0 * 2.0 * asin(
                    sqrt(
                        power(sin(radians(latitude - :lat) / 2.0), 2.0)
                        + cos(radians(:lat)) * cos(radians(latitude))
                        * power(sin(radians(longitude - :lng) / 2.0), 2.0)
                    )
                )
            ) <= :radiusKm
            order by (
                6371.0 * 2.0 * asin(
                    sqrt(
                        power(sin(radians(latitude - :lat) / 2.0), 2.0)
                        + cos(radians(:lat)) * cos(radians(latitude))
                        * power(sin(radians(longitude - :lng) / 2.0), 2.0)
                    )
                )
            ) asc
            """, nativeQuery = true)
    List<Spot> findWithinRadius(
            @Param("lat") double lat,
            @Param("lng") double lng,
            @Param("radiusKm") double radiusKm
    );

    @Query(value = """
            select *
            from spots
            where (
                6371.0 * 2.0 * asin(
                    sqrt(
                        power(sin(radians(latitude - :lat) / 2.0), 2.0)
                        + cos(radians(:lat)) * cos(radians(latitude))
                        * power(sin(radians(longitude - :lng) / 2.0), 2.0)
                    )
                )
            ) <= :radiusKm
            order by rank_score desc
            """, nativeQuery = true)
    List<Spot> findWithinRadiusOrderByRankScoreDesc(
            @Param("lat") double lat,
            @Param("lng") double lng,
            @Param("radiusKm") double radiusKm
    );

    /**
     * Full-text search using PostgreSQL tsvector/tsquery.
     * Falls back to ILIKE for queries that tsquery can't parse (single chars, etc).
     * Results are ranked by ts_rank (relevance) then rank_score (popularity).
     */
    @Query(value = """
            SELECT * FROM spots
            WHERE search_vector @@ plainto_tsquery('english', :q)
               OR lower(name) LIKE lower(concat('%', :q, '%'))
            ORDER BY
                ts_rank(search_vector, plainto_tsquery('english', :q)) DESC,
                rank_score DESC
            """, nativeQuery = true)
    List<Spot> searchByNameOrTag(@Param("q") String q);

    /** Find spots that have a specific tag (via the spot_tags join table). */
    @Query(value = """
            SELECT s.* FROM spots s
            JOIN spot_tags st ON st.spot_id = s.id
            WHERE st.tag_id = :tagId
            ORDER BY s.rank_score DESC
            """, nativeQuery = true)
    List<Spot> findByTagId(@Param("tagId") Long tagId);

    /** Find spots that have any of the given tag IDs. */
    @Query(value = """
            SELECT DISTINCT s.* FROM spots s
            JOIN spot_tags st ON st.spot_id = s.id
            WHERE st.tag_id IN :tagIds
            ORDER BY s.rank_score DESC
            """, nativeQuery = true)
    List<Spot> findByTagIds(@Param("tagIds") List<Long> tagIds);

    List<Spot> findTop20ByOrderByRankScoreDesc();

    List<Spot> findAllByOrderByRankScoreDesc();

    /**
     * Single SQL to recompute all rank scores with weighted formula.
     * Reviews are weighted by their actual rating (1–5) via SUM(rating)
     * so a 5-star review contributes 5× more than a 1-star review.
     *
     *   - Views in last 7 days:          × 1  (baseline traffic signal)
     *   - Approved reviews (all-time):   SUM(rating) × 3  (5-star → 15 pts, 1-star → 3 pts)
     *   - Recent reviews (7 days):       SUM(rating) × 5  (5-star → 25 pts, 1-star → 5 pts)
     *   - Likes in last 7 days:          × 5  (lightweight engagement)
     *   - Saves in last 7 days:          × 10 (stronger intent signal)
     */
    @Modifying
    @Query(value = """
            UPDATE spots SET rank_score = (
                COALESCE((SELECT COUNT(*) FROM spot_events e WHERE e.spot_id = spots.id AND e.event_type = 'VIEW' AND e.created_at >= :since), 0)
                + COALESCE((SELECT SUM(r.rating) FROM reviews r WHERE r.spot_id = spots.id AND r.status = 'APPROVED'), 0) * 3
                + COALESCE((SELECT SUM(r.rating) FROM reviews r WHERE r.spot_id = spots.id AND r.status = 'APPROVED' AND r.created_at >= :since), 0) * 5
                + COALESCE((SELECT COUNT(*) FROM user_spot_interactions u WHERE u.spot_id = spots.id AND u.is_liked = true AND u.updated_at >= :since), 0) * 5
                + COALESCE((SELECT COUNT(*) FROM user_spot_interactions u WHERE u.spot_id = spots.id AND u.is_saved = true AND u.updated_at >= :since), 0) * 10
            )
            """, nativeQuery = true)
    void updateAllRankScores(@Param("since") Instant since);
}