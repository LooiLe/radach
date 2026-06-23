package com.radach.maps.repository;

import com.radach.maps.model.EventCategory;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface EventCategoryRepository extends JpaRepository<EventCategory, Long> {
    Optional<EventCategory> findByNameIgnoreCase(String name);
    boolean existsByNameIgnoreCase(String name);
}
