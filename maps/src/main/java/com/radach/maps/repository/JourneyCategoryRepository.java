package com.radach.maps.repository;

import com.radach.maps.model.JourneyCategory;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface JourneyCategoryRepository extends JpaRepository<JourneyCategory, Long> {
    boolean existsByNameIgnoreCase(String name);
}