package com.radach.maps.repository;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.radach.maps.model.ItineraryGeneration;

public interface ItineraryGenerationRepository extends JpaRepository<ItineraryGeneration, Long> {

    Optional<ItineraryGeneration> findByStripeSessionId(String stripeSessionId);

    Optional<ItineraryGeneration> findByItineraryId(Long itineraryId);

    List<ItineraryGeneration> findByUserIdOrderByCreatedAtDesc(Long userId);

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("update ItineraryGeneration g set g.itineraryId = null where g.itineraryId = :itineraryId")
    void clearItineraryReference(@Param("itineraryId") Long itineraryId);
}
