package com.radach.maps.repository;

import java.time.Instant;
import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;

import com.radach.maps.model.CalendarEntry;

public interface CalendarEntryRepository extends JpaRepository<CalendarEntry, Long> {

    List<CalendarEntry> findByUserId(Long userId);

    List<CalendarEntry> findByUserIdAndStartTimeBetweenOrderByStartTimeAsc(
            Long userId, Instant start, Instant end);

    boolean existsByUserIdAndEventId(Long userId, Long eventId);

    void deleteByEventId(Long eventId);
}
