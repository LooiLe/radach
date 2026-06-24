package com.radach.maps.repository;

import java.util.Collection;
import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import org.springframework.transaction.annotation.Transactional;

import com.radach.maps.model.SpotVibeTag;

public interface SpotVibeTagRepository extends JpaRepository<SpotVibeTag, Long> {
    List<SpotVibeTag> findBySpotId(Long spotId);
    
    List<SpotVibeTag> findBySpotIdIn(java.util.Collection<Long> spotIds);
    
    @Modifying
    @Transactional
    @Query("DELETE FROM SpotVibeTag svt WHERE svt.spotId = :spotId")
    void deleteBySpotId(@Param("spotId") Long spotId);

    /**
     * Delete every tag for a spot whose {@code source} is NOT in the supplied
     * preserve set (typically just {@code "manual"}). Used by the vibe
     * orchestrator so admin-applied manual tags survive re-analysis.
     */
    @Modifying
    @Transactional
    @Query("DELETE FROM SpotVibeTag svt WHERE svt.spotId = :spotId AND svt.source NOT IN :preserveSources")
    void deleteBySpotIdAndSourceNotIn(@Param("spotId") Long spotId,
                                      @Param("preserveSources") Collection<String> preserveSources);

    boolean existsBySpotIdAndVibeTagId(Long spotId, Long vibeTagId);

    @Query(value = """
            SELECT vtd.id, vtd.name, vtd.emoji, vtd.category, COUNT(svt.spot_id) AS cnt
            FROM spot_vibe_tags svt
            JOIN vibe_tag_definitions vtd ON vtd.id = svt.vibe_tag_id
            JOIN spots s ON s.id = svt.spot_id
            WHERE LOWER(s.type) IN (:types) AND s.status = 'ACTIVE'
            GROUP BY vtd.id, vtd.name, vtd.emoji, vtd.category
            ORDER BY cnt DESC
            LIMIT :limit
            """, nativeQuery = true)
    List<Object[]> findTopVibeTagsBySpotTypes(@Param("types") List<String> types, @Param("limit") int limit);

    @Query(value = """
            SELECT vtd.id, vtd.name, vtd.emoji, vtd.category, COUNT(svt.spot_id) AS cnt
            FROM spot_vibe_tags svt
            JOIN vibe_tag_definitions vtd ON vtd.id = svt.vibe_tag_id
            JOIN spots s ON s.id = svt.spot_id
            WHERE s.status = 'ACTIVE'
            GROUP BY vtd.id, vtd.name, vtd.emoji, vtd.category
            ORDER BY cnt DESC
            LIMIT :limit
            """, nativeQuery = true)
    List<Object[]> findTopVibeTags(@Param("limit") int limit);
}

