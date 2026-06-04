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
}
