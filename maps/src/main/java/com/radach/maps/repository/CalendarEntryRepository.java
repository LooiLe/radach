package com.radach.maps.repository;

import java.time.Instant;
import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;

import com.radach.maps.model.CalendarEntry;

import org.springframework.transaction.annotation.Transactional;

public interface CalendarEntryRepository extends JpaRepository<CalendarEntry, Long> {

    List<CalendarEntry> findByUserId(Long userId);

    List<CalendarEntry> findByEventId(Long eventId);

    @org.springframework.data.jpa.repository.Query("SELECT c FROM CalendarEntry c WHERE c.userId = :userId AND ((c.startTime BETWEEN :start AND :end) OR (c.recurrenceRule IS NOT NULL AND c.startTime <= :end)) ORDER BY c.startTime ASC")
    List<CalendarEntry> findEntriesWithinRange(
            @org.springframework.data.repository.query.Param("userId") Long userId,
            @org.springframework.data.repository.query.Param("start") Instant start,
            @org.springframework.data.repository.query.Param("end") Instant end);

    boolean existsByUserIdAndEventId(Long userId, Long eventId);

    @Transactional
    void deleteByEventId(Long eventId);

    @Transactional
    void deleteByUserIdAndEventId(Long userId, Long eventId);
}
