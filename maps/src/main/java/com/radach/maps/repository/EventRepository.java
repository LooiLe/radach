package com.radach.maps.repository;

import java.time.Instant;
import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.radach.maps.model.Event;
import com.radach.maps.model.EventStatus;

public interface EventRepository extends JpaRepository<Event, Long> {

    List<Event> findByStatusOrderByStartTimeAsc(EventStatus status);

    List<Event> findBySpotIdAndStatusOrderByStartTimeAsc(Long spotId, EventStatus status);

    @Query("SELECT e FROM Event e WHERE e.status = :status AND (e.startTime >= :from OR (e.recurrenceRule IS NOT NULL AND e.startTime < :from)) ORDER BY e.startTime ASC")
    List<Event> findUpcoming(@Param("status") EventStatus status, @Param("from") Instant from);

    @Query("""
            SELECT e FROM Event e
            WHERE e.status = :status
            AND ((e.startTime >= :rangeStart AND e.startTime < :rangeEnd) OR (e.recurrenceRule IS NOT NULL AND e.startTime < :rangeEnd))
            ORDER BY e.startTime ASC
            """)
    List<Event> findByStatusAndStartTimeBetween(
            @Param("status") EventStatus status,
            @Param("rangeStart") Instant rangeStart,
            @Param("rangeEnd") Instant rangeEnd);

    @Query(value = """
            SELECT e.* FROM events e
            JOIN spots s ON e.spot_id = s.id
            WHERE e.status = :status
            AND LOWER(s.address) LIKE LOWER(CONCAT('%', :city, '%'))
            AND ((e.start_time >= :rangeStart AND e.start_time < :rangeEnd) OR (e.recurrence_rule IS NOT NULL AND e.start_time < :rangeEnd))
            ORDER BY e.start_time ASC
            """, nativeQuery = true)
    List<Event> findByStatusAndCityAndTimeBetween(
            @Param("status") String status,
            @Param("city") String city,
            @Param("rangeStart") Instant rangeStart,
            @Param("rangeEnd") Instant rangeEnd);

    @Query("SELECT e FROM Event e WHERE e.status = 'PENDING' ORDER BY e.createdAt DESC")
    List<Event> findPending();

    @Query("SELECT e FROM Event e WHERE e.status = :status ORDER BY e.likeCount DESC, e.startTime ASC")
    List<Event> findByStatusOrderByLikeCountDesc(@Param("status") EventStatus status);

    List<Event> findBySubmittedByOrderByCreatedAtDesc(Long submittedBy);

    @Query(value = """
            SELECT e.* FROM events e
            JOIN spots s ON e.spot_id = s.id
            WHERE e.status = :status
            AND LOWER(s.address) LIKE LOWER(CONCAT('%', :city, '%'))
            AND ((e.start_time >= :rangeStart AND e.start_time < :rangeEnd) OR (e.recurrence_rule IS NOT NULL AND e.start_time < :rangeEnd))
            ORDER BY (
                COALESCE((SELECT COUNT(*) FROM event_likes el WHERE el.event_id = e.id AND el.created_at >= :since), 0) * 5
                + COALESCE((SELECT COUNT(*) FROM calendar_entries c WHERE c.event_id = e.id AND c.created_at >= :since), 0) * 10
            ) DESC, e.start_time ASC
            """, nativeQuery = true)
    List<Event> findByStatusAndCityAndTimeBetweenOrderByTrendingDesc(
            @Param("status") String status,
            @Param("city") String city,
            @Param("rangeStart") Instant rangeStart,
            @Param("rangeEnd") Instant rangeEnd,
            @Param("since") Instant since);

    @Query(value = """
            SELECT e.* FROM events e
            WHERE e.status = :status
            AND ((e.start_time >= :rangeStart AND e.start_time < :rangeEnd) OR (e.recurrence_rule IS NOT NULL AND e.start_time < :rangeEnd))
            ORDER BY (
                COALESCE((SELECT COUNT(*) FROM event_likes el WHERE el.event_id = e.id AND el.created_at >= :since), 0) * 5
                + COALESCE((SELECT COUNT(*) FROM calendar_entries c WHERE c.event_id = e.id AND c.created_at >= :since), 0) * 10
            ) DESC, e.start_time ASC
            """, nativeQuery = true)
    List<Event> findByStatusAndTimeBetweenOrderByTrendingDesc(
            @Param("status") String status,
            @Param("rangeStart") Instant rangeStart,
            @Param("rangeEnd") Instant rangeEnd,
            @Param("since") Instant since);

    @Query(value = """
            SELECT e.* FROM events e
            JOIN spots s ON e.spot_id = s.id
            WHERE e.status = :status
            AND LOWER(s.address) LIKE LOWER(CONCAT('%', :city, '%'))
            AND ((e.start_time >= :rangeStart AND e.start_time < :rangeEnd) OR (e.recurrence_rule IS NOT NULL AND e.start_time < :rangeEnd))
            ORDER BY (
                COALESCE((SELECT SUM(CASE WHEN el.user_id IN :firstDegree THEN 5 WHEN el.user_id IN :secondDegree THEN 4 ELSE 0 END) FROM event_likes el WHERE el.event_id = e.id AND el.created_at >= :since AND (el.user_id IN :firstDegree OR el.user_id IN :secondDegree)), 0) * 5
                + COALESCE((SELECT SUM(CASE WHEN c.user_id IN :firstDegree THEN 5 WHEN c.user_id IN :secondDegree THEN 4 ELSE 0 END) FROM calendar_entries c WHERE c.event_id = e.id AND c.created_at >= :since AND (c.user_id IN :firstDegree OR c.user_id IN :secondDegree)), 0) * 10
            ) DESC, e.start_time ASC
            """, nativeQuery = true)
    List<Event> findPersonalizedTrendingByStatusAndCityAndTimeBetween(
            @Param("status") String status,
            @Param("city") String city,
            @Param("rangeStart") Instant rangeStart,
            @Param("rangeEnd") Instant rangeEnd,
            @Param("firstDegree") java.util.Collection<Long> firstDegree,
            @Param("secondDegree") java.util.Collection<Long> secondDegree,
            @Param("since") Instant since);

    @Query(value = """
            SELECT e.* FROM events e
            WHERE e.status = :status
            AND ((e.start_time >= :rangeStart AND e.start_time < :rangeEnd) OR (e.recurrence_rule IS NOT NULL AND e.start_time < :rangeEnd))
            ORDER BY (
                COALESCE((SELECT SUM(CASE WHEN el.user_id IN :firstDegree THEN 5 WHEN el.user_id IN :secondDegree THEN 4 ELSE 0 END) FROM event_likes el WHERE el.event_id = e.id AND el.created_at >= :since AND (el.user_id IN :firstDegree OR el.user_id IN :secondDegree)), 0) * 5
                + COALESCE((SELECT SUM(CASE WHEN c.user_id IN :firstDegree THEN 5 WHEN c.user_id IN :secondDegree THEN 4 ELSE 0 END) FROM calendar_entries c WHERE c.event_id = e.id AND c.created_at >= :since AND (c.user_id IN :firstDegree OR c.user_id IN :secondDegree)), 0) * 10
            ) DESC, e.start_time ASC
            """, nativeQuery = true)
    List<Event> findPersonalizedTrendingByStatusAndTimeBetween(
            @Param("status") String status,
            @Param("rangeStart") Instant rangeStart,
            @Param("rangeEnd") Instant rangeEnd,
            @Param("firstDegree") java.util.Collection<Long> firstDegree,
            @Param("secondDegree") java.util.Collection<Long> secondDegree,
            @Param("since") Instant since);
}
