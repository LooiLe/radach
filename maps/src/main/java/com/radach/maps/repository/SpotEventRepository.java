package com.radach.maps.repository;

import java.time.Instant;
import java.util.Collection;
import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.radach.maps.model.SpotEvent;
import com.radach.maps.model.SpotEvent.EventType;

public interface SpotEventRepository extends JpaRepository<SpotEvent, Long> {

    long countBySpotIdAndEventType(Long spotId, EventType eventType);

    @Query("""
            select count(e) from SpotEvent e
            where e.spotId = :spotId
            and e.eventType = :eventType
            and e.createdAt >= :since
            """)
    long countBySpotIdAndEventTypeSince(
            @Param("spotId") Long spotId,
            @Param("eventType") EventType eventType,
            @Param("since") Instant since);

    void deleteBySpotId(Long spotId);

    /** Recent events by a set of user IDs — powers the friend activity feed. */
    @Query(value = """
            SELECT * FROM spot_events
            WHERE user_id IN :userIds
            ORDER BY created_at DESC
            LIMIT :limit
            """, nativeQuery = true)
    List<SpotEvent> findRecentByUserIds(
            @Param("userIds") Collection<Long> userIds,
            @Param("limit") int limit);

    @Query("SELECT e.spotId, COUNT(e) FROM SpotEvent e WHERE e.userId IN :expertIds AND e.eventType = 'VIEW' GROUP BY e.spotId")
    List<Object[]> countViewsByExpertIds(@Param("expertIds") Collection<Long> expertIds);
}