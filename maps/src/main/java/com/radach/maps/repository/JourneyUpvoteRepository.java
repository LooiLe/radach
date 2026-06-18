package com.radach.maps.repository;

import com.radach.maps.model.JourneyUpvote;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface JourneyUpvoteRepository extends JpaRepository<JourneyUpvote, Long> {

    Optional<JourneyUpvote> findByUserIdAndJourneyId(Long userId, Long journeyId);

    boolean existsByUserIdAndJourneyId(Long userId, Long journeyId);

    List<JourneyUpvote> findByUserId(Long userId);
}