package com.radach.maps.repository;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

import com.radach.maps.model.Itinerary;

public interface ItineraryRepository extends JpaRepository<Itinerary, Long> {

    List<Itinerary> findByUserIdOrderByCreatedAtDesc(Long userId);

    Optional<Itinerary> findByIdAndUserId(Long id, Long userId);
}
