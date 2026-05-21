package com.radach.maps.repository;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

import com.radach.maps.model.EventLike;

public interface EventLikeRepository extends JpaRepository<EventLike, Long> {

    boolean existsByUserIdAndEventId(Long userId, Long eventId);

    Optional<EventLike> findByUserIdAndEventId(Long userId, Long eventId);

    long countByEventId(Long eventId);

    List<EventLike> findByUserId(Long userId);

    void deleteByEventId(Long eventId);
}
