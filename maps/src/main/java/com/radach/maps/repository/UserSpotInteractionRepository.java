package com.radach.maps.repository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.Set;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.radach.maps.model.UserSpotInteraction;

public interface UserSpotInteractionRepository extends JpaRepository<UserSpotInteraction, Long> {

    Optional<UserSpotInteraction> findByUserIdAndSpotId(Long userId, Long spotId);

    List<UserSpotInteraction> findByUserId(Long userId);

    List<UserSpotInteraction> findByUserIdAndSavedTrue(Long userId);

    @Query("SELECT u.spotId FROM UserSpotInteraction u WHERE u.userId = :userId AND u.saved = true")
    Set<Long> findSavedSpotIdsByUserId(@Param("userId") Long userId);
    
    @Query("SELECT u.spotId FROM UserSpotInteraction u WHERE u.userId = :userId AND u.liked = true")
    Set<Long> findLikedSpotIdsByUserId(@Param("userId") Long userId);

    List<UserSpotInteraction> findBySpotIdInAndUserId(List<Long> spotIds, Long userId);

    @Query("SELECT u.spotId, u.userId, u.liked, u.saved FROM UserSpotInteraction u WHERE u.liked = true OR u.saved = true")
    List<Object[]> findAllActiveInteractions();

    /** Recent interactions by a set of user IDs — powers the friend activity feed. */
    @Query(value = """
            SELECT * FROM user_spot_interactions
            WHERE user_id IN :userIds AND (is_liked = true OR is_saved = true)
            ORDER BY updated_at DESC
            LIMIT :limit
            """, nativeQuery = true)
    List<UserSpotInteraction> findRecentByUserIds(
            @Param("userIds") Collection<Long> userIds,
            @Param("limit") int limit);
}
