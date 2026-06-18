package com.radach.maps.repository;

import java.time.Instant;
import java.util.List;

import org.springframework.data.domain.Pageable;
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
            and status = 'ACTIVE'
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
            and status = 'ACTIVE'
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
            WHERE (search_vector @@ plainto_tsquery('english', :q)
               OR lower(name) LIKE lower(concat('%', :q, '%')))
              AND status = 'ACTIVE'
            ORDER BY
                ts_rank(search_vector, plainto_tsquery('english', :q)) DESC,
                rank_score DESC
            """, nativeQuery = true)
    List<Spot> searchByNameOrTag(@Param("q") String q);

    @Query(value = """
            SELECT * FROM spots
            WHERE (search_vector @@ plainto_tsquery('english', :q)
               OR lower(name) LIKE lower(concat('%', :q, '%')))
              AND status = 'ACTIVE'
            ORDER BY
                ts_rank(search_vector, plainto_tsquery('english', :q)) DESC,
                rank_score DESC
            LIMIT :limit
            """, nativeQuery = true)
    List<Spot> searchByNameOrTag(@Param("q") String q, @Param("limit") int limit);

    /** Find spots that have a specific tag (via the spot_tags join table). */
    @Query(value = """
            SELECT s.* FROM spots s
            JOIN spot_tags st ON st.spot_id = s.id
            WHERE st.tag_id = :tagId AND s.status = 'ACTIVE'
            ORDER BY s.rank_score DESC
            """, nativeQuery = true)
    List<Spot> findByTagId(@Param("tagId") Long tagId);

    /** Find spots that have any of the given tag IDs. */
    @Query(value = """
            SELECT DISTINCT s.* FROM spots s
            JOIN spot_tags st ON st.spot_id = s.id
            WHERE st.tag_id IN :tagIds AND s.status = 'ACTIVE'
            ORDER BY s.rank_score DESC
            """, nativeQuery = true)
    List<Spot> findByTagIds(@Param("tagIds") List<Long> tagIds);

    /** Find spots by vibe tag name (via the spot_vibe_tags + vibe_tag_definitions join). */
    @Query(value = """
            SELECT DISTINCT s.* FROM spots s
            JOIN spot_vibe_tags svt ON svt.spot_id = s.id
            JOIN vibe_tag_definitions vtd ON vtd.id = svt.vibe_tag_id
            WHERE LOWER(vtd.name) = LOWER(:vibeName) AND s.status = 'ACTIVE'
            ORDER BY svt.confidence DESC, s.rank_score DESC
            """, nativeQuery = true)
    List<Spot> findByVibeTagName(@Param("vibeName") String vibeName);

    @Query(value = """
            SELECT DISTINCT s.* FROM spots s
            JOIN spot_vibe_tags svt ON svt.spot_id = s.id
            JOIN vibe_tag_definitions vtd ON vtd.id = svt.vibe_tag_id
            WHERE LOWER(vtd.name) = LOWER(:vibeName) AND s.status = 'ACTIVE'
            ORDER BY svt.confidence DESC, s.rank_score DESC
            LIMIT :limit
            """, nativeQuery = true)
    List<Spot> findByVibeTagName(@Param("vibeName") String vibeName, @Param("limit") int limit);

    List<Spot> findTop20ByStatusOrderByRankScoreDesc(com.radach.maps.model.SpotStatus status);

    List<Spot> findAllByStatusOrderByRankScoreDesc(com.radach.maps.model.SpotStatus status);

    List<Spot> findAllByStatus(com.radach.maps.model.SpotStatus status);

    List<Spot> findByStatusOrderByRankScoreDesc(com.radach.maps.model.SpotStatus status, Pageable pageable);

    List<Spot> findByStatus(com.radach.maps.model.SpotStatus status, Pageable pageable);

    List<Spot> findByStatusOrderByCreatedAtAsc(com.radach.maps.model.SpotStatus status);

    @Query(value = """
            SELECT s.*
            FROM spots s
            WHERE s.status = 'ACTIVE'
            ORDER BY (
                COALESCE((SELECT COUNT(*) FROM spot_events e JOIN users u ON u.id = e.user_id WHERE e.spot_id = s.id AND e.event_type = 'VIEW' AND e.created_at >= :since AND u.is_expert = true), 0)
                + COALESCE((SELECT AVG(r.rating) FROM reviews r JOIN users u ON u.id = r.author_id WHERE r.spot_id = s.id AND r.status = 'APPROVED' AND u.is_expert = true), 0) * 10
                + COALESCE((SELECT AVG(r.rating) FROM reviews r JOIN users u ON u.id = r.author_id WHERE r.spot_id = s.id AND r.status = 'APPROVED' AND r.created_at >= :since AND u.is_expert = true), 0) * 20
                + COALESCE((SELECT COUNT(*) FROM user_spot_interactions ui JOIN users u ON u.id = ui.user_id WHERE ui.spot_id = s.id AND ui.is_liked = true AND ui.updated_at >= :since AND u.is_expert = true), 0) * 5
                + COALESCE((SELECT COUNT(*) FROM user_spot_interactions ui JOIN users u ON u.id = ui.user_id WHERE ui.spot_id = s.id AND ui.is_saved = true AND ui.updated_at >= :since AND u.is_expert = true), 0) * 10
            ) DESC, s.rank_score DESC
            """, nativeQuery = true)
    List<Spot> findExpertTrending(@Param("since") Instant since);

    @Query(value = """
            SELECT s.*
            FROM spots s
            WHERE s.status = 'ACTIVE'
              AND (
                  6371.0 * 2.0 * asin(
                      sqrt(
                          power(sin(radians(latitude - :lat) / 2.0), 2.0)
                          + cos(radians(:lat)) * cos(radians(latitude))
                          * power(sin(radians(longitude - :lng) / 2.0), 2.0)
                      )
                  )
              ) <= :radiusKm
            ORDER BY (
                COALESCE((SELECT COUNT(*) FROM spot_events e JOIN users u ON u.id = e.user_id WHERE e.spot_id = s.id AND e.event_type = 'VIEW' AND e.created_at >= :since AND u.is_expert = true), 0)
                + COALESCE((SELECT AVG(r.rating) FROM reviews r JOIN users u ON u.id = r.author_id WHERE r.spot_id = s.id AND r.status = 'APPROVED' AND u.is_expert = true), 0) * 10
                + COALESCE((SELECT AVG(r.rating) FROM reviews r JOIN users u ON u.id = r.author_id WHERE r.spot_id = s.id AND r.status = 'APPROVED' AND r.created_at >= :since AND u.is_expert = true), 0) * 20
                + COALESCE((SELECT COUNT(*) FROM user_spot_interactions ui JOIN users u ON u.id = ui.user_id WHERE ui.spot_id = s.id AND ui.is_liked = true AND ui.updated_at >= :since AND u.is_expert = true), 0) * 5
                + COALESCE((SELECT COUNT(*) FROM user_spot_interactions ui JOIN users u ON u.id = ui.user_id WHERE ui.spot_id = s.id AND ui.is_saved = true AND ui.updated_at >= :since AND u.is_expert = true), 0) * 10
            ) DESC, s.rank_score DESC
            """, nativeQuery = true)
    List<Spot> findExpertTrendingWithinRadius(@Param("lat") double lat, @Param("lng") double lng, @Param("radiusKm") double radiusKm, @Param("since") Instant since);

    @Query(value = """
            SELECT s.*
            FROM spots s
            WHERE s.status = 'ACTIVE'
            ORDER BY (
                COALESCE((SELECT AVG(r.rating * CASE WHEN r.author_id IN :firstDegree THEN 5 WHEN r.author_id IN :secondDegree THEN 4 ELSE 0 END) 
                          FROM reviews r WHERE r.spot_id = s.id AND r.status = 'APPROVED' AND (r.author_id IN :firstDegree OR r.author_id IN :secondDegree)), 0) * 10
                + COALESCE((SELECT AVG(r.rating * CASE WHEN r.author_id IN :firstDegree THEN 5 WHEN r.author_id IN :secondDegree THEN 4 ELSE 0 END) 
                            FROM reviews r WHERE r.spot_id = s.id AND r.status = 'APPROVED' AND r.created_at >= :since AND (r.author_id IN :firstDegree OR r.author_id IN :secondDegree)), 0) * 20
                + COALESCE((SELECT SUM(CASE WHEN ui.user_id IN :firstDegree THEN 5 WHEN ui.user_id IN :secondDegree THEN 4 ELSE 0 END) 
                            FROM user_spot_interactions ui WHERE ui.spot_id = s.id AND ui.is_liked = true AND ui.updated_at >= :since AND (ui.user_id IN :firstDegree OR ui.user_id IN :secondDegree)), 0) * 5
                + COALESCE((SELECT SUM(CASE WHEN ui.user_id IN :firstDegree THEN 5 WHEN ui.user_id IN :secondDegree THEN 4 ELSE 0 END) 
                            FROM user_spot_interactions ui WHERE ui.spot_id = s.id AND ui.is_saved = true AND ui.updated_at >= :since AND (ui.user_id IN :firstDegree OR ui.user_id IN :secondDegree)), 0) * 10
            ) DESC, s.rank_score DESC
            """, nativeQuery = true)
    List<Spot> findPersonalizedTrending(@Param("firstDegree") java.util.Collection<Long> firstDegree, @Param("secondDegree") java.util.Collection<Long> secondDegree, @Param("since") Instant since);

    @Query(value = """
            SELECT s.*
            FROM spots s
            WHERE s.status = 'ACTIVE'
              AND (
                  6371.0 * 2.0 * asin(
                      sqrt(
                          power(sin(radians(latitude - :lat) / 2.0), 2.0)
                          + cos(radians(:lat)) * cos(radians(latitude))
                          * power(sin(radians(longitude - :lng) / 2.0), 2.0)
                      )
                  )
              ) <= :radiusKm
            ORDER BY (
                COALESCE((SELECT AVG(r.rating * CASE WHEN r.author_id IN :firstDegree THEN 5 WHEN r.author_id IN :secondDegree THEN 4 ELSE 0 END) 
                          FROM reviews r WHERE r.spot_id = s.id AND r.status = 'APPROVED' AND (r.author_id IN :firstDegree OR r.author_id IN :secondDegree)), 0) * 10
                + COALESCE((SELECT AVG(r.rating * CASE WHEN r.author_id IN :firstDegree THEN 5 WHEN r.author_id IN :secondDegree THEN 4 ELSE 0 END) 
                            FROM reviews r WHERE r.spot_id = s.id AND r.status = 'APPROVED' AND r.created_at >= :since AND (r.author_id IN :firstDegree OR r.author_id IN :secondDegree)), 0) * 20
                + COALESCE((SELECT SUM(CASE WHEN ui.user_id IN :firstDegree THEN 5 WHEN ui.user_id IN :secondDegree THEN 4 ELSE 0 END) 
                            FROM user_spot_interactions ui WHERE ui.spot_id = s.id AND ui.is_liked = true AND ui.updated_at >= :since AND (ui.user_id IN :firstDegree OR ui.user_id IN :secondDegree)), 0) * 5
                + COALESCE((SELECT SUM(CASE WHEN ui.user_id IN :firstDegree THEN 5 WHEN ui.user_id IN :secondDegree THEN 4 ELSE 0 END) 
                            FROM user_spot_interactions ui WHERE ui.spot_id = s.id AND ui.is_saved = true AND ui.updated_at >= :since AND (ui.user_id IN :firstDegree OR ui.user_id IN :secondDegree)), 0) * 10
            ) DESC, s.rank_score DESC
            """, nativeQuery = true)
    List<Spot> findPersonalizedTrendingWithinRadius(@Param("lat") double lat, @Param("lng") double lng, @Param("radiusKm") double radiusKm, @Param("firstDegree") java.util.Collection<Long> firstDegree, @Param("secondDegree") java.util.Collection<Long> secondDegree, @Param("since") Instant since);

    @Query(value = """
            SELECT DISTINCT s.*
            FROM spots s
            JOIN reviews r ON r.spot_id = s.id
            WHERE r.author_id = :expertId
              AND r.status = 'APPROVED'
              AND s.status = 'ACTIVE'
              AND (
                  6371.0 * 2.0 * asin(
                      sqrt(
                          power(sin(radians(latitude - :lat) / 2.0), 2.0)
                          + cos(radians(:lat)) * cos(radians(latitude))
                          * power(sin(radians(longitude - :lng) / 2.0), 2.0)
                      )
                  )
              ) <= :radiusKm
            ORDER BY s.rank_score DESC
            """, nativeQuery = true)
    List<Spot> findSpotsReviewedByExpert(
            @Param("expertId") Long expertId,
            @Param("lat") double lat,
            @Param("lng") double lng,
            @Param("radiusKm") double radiusKm
    );

    /**
     * Single SQL to recompute all rank scores with weighted formula.
     * Reviews are weighted by their average rating (1-5).
     *
     *   - Views in last 7 days:          × 1  (baseline traffic signal)
     *   - Approved reviews avg (all-time): AVG(rating) × 10
     *   - Recent reviews avg (7 days):     AVG(rating) × 20
     *   - Likes in last 7 days:          × 5  (lightweight engagement)
     *   - Saves in last 7 days:          × 10 (stronger intent signal)
     */
    @Modifying
    @Query(value = """
            UPDATE spots SET rank_score = (
                COALESCE((SELECT COUNT(*) FROM spot_events e WHERE e.spot_id = spots.id AND e.event_type = 'VIEW' AND e.created_at >= :since), 0)
                + COALESCE((SELECT AVG(r.rating) FROM reviews r WHERE r.spot_id = spots.id AND r.status = 'APPROVED'), 0) * 10
                + COALESCE((SELECT AVG(r.rating) FROM reviews r WHERE r.spot_id = spots.id AND r.status = 'APPROVED' AND r.created_at >= :since), 0) * 20
                + COALESCE((SELECT COUNT(*) FROM user_spot_interactions u WHERE u.spot_id = spots.id AND u.is_liked = true AND u.updated_at >= :since), 0) * 5
                + COALESCE((SELECT COUNT(*) FROM user_spot_interactions u WHERE u.spot_id = spots.id AND u.is_saved = true AND u.updated_at >= :since), 0) * 10
            )
            """, nativeQuery = true)
    void updateAllRankScores(@Param("since") Instant since);
}
